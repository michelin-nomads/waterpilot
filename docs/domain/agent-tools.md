# Agent tools (Prompt 16, ADR 0017)

The planning agent reaches the product only through a typed tool layer. Tools run under an
identity taken **only** from the verified run context, route through the same authorized
application services as the GraphQL API, are bounded, and never perform a meaningful or
irreversible action — they _prepare_ it for an explicit UI confirmation.

No language model is wired here. Tools are tested by calling them directly with the arguments a
model _would_ produce (including hostile ones), which is exactly how a hallucinated or injected
call reaches the runtime.

## Where it lives

- `application/agent/context.py` — `RunContext`: the verified `ctx` (its principal is the only
  identity) and the run's own `session_id`/`run_id`. Assembled on the server.
- `application/agent/registry.py` — the tool catalogue: typed argument models (extra fields
  rejected), result formatters, and each tool's kind (`READ`/`EDIT`/`PREPARE`).
- `application/agent/actions.py` — `PreparedAction`, `AgentActionKind`, `ConfirmActionInput`
  and the `confirmation_token` that binds an action to its resource's current version and
  parameters.
- `application/agent/runtime.py` — `AgentToolRuntime` (identity stripping, step/expiry/budget/
  loop/fan-out enforcement, dispatch) and `AgentActionService.confirm` (the UI-invoked,
  token-bound, version-fresh confirmation path).
- `adapters/adk_tools.py` — exposes the catalogue to the real `google-adk` as `BaseTool`s whose
  identity is bound on the server, not taken from the ADK call.

## The catalogue

| Tool                         | Kind    | Service it reuses                                     |
| ---------------------------- | ------- | ----------------------------------------------------- |
| `resolve_location`           | read    | `LocationService.resolve` (candidates; chooses none)  |
| `inspect_coverage`           | read    | `ReadinessService.coverage` + `assess`                |
| `inspect_baseline`           | read    | `BaselineService.baseline`                            |
| `check_goal`                 | read    | `GoalService.check`                                   |
| `explain_goal_fit`           | read    | `GoalService.assessment`                              |
| `list_interventions`         | read    | `GoalService.catalogue`                               |
| `preview_scenario`           | read    | `OptionService.preview_scenario`                      |
| `compare_options`            | read    | `OptionService.assessed`                              |
| `explain_option`             | read    | `OptionService.assessed`                              |
| `inspect_returns`            | read    | `OptionService.assessed` (economics)                  |
| `check_impact_summary`       | read    | `OptionService.assessed` + `check_narrative`          |
| `find_funding`               | read    | `FundingService.schemes` + `matches` (never submits)  |
| `proposal_preview`           | read    | `ReportService.get` (assembles facts; drafts nothing) |
| `view_report`                | read    | `ReportService.get`                                   |
| `view_community`             | read    | `CommunityService.get`/`viewer_membership`/`members`  |
| `inspect_progress`           | read    | `TrackingService.project`/`milestones`/`observations` |
| `confirm_location`           | edit    | `LocationService.confirm` (idempotent; private area)  |
| `set_area`                   | edit    | `SessionService.update` (current version)             |
| `set_goal`                   | edit    | `SessionService.update` (current version)             |
| `update_constraints`         | edit    | `SessionService.update` (current version)             |
| `select_option`              | edit    | `SessionService.update` (current version)             |
| `prepare_finalize_report`    | prepare | → `ReportService.finalize` on confirm                 |
| `prepare_archive_report`     | prepare | → `ReportService.archive` on confirm                  |
| `prepare_create_community`   | prepare | → `CommunityService.create` on confirm                |
| `prepare_join_community`     | prepare | → `CommunityService.join` on confirm                  |
| `prepare_leave_community`    | prepare | → `CommunityService.leave` on confirm                 |
| `prepare_archive_community`  | prepare | → `CommunityService.archive` on confirm               |
| `prepare_start_project`      | prepare | → `TrackingService.start` on confirm                  |
| `prepare_update_milestone`   | prepare | → `TrackingService.update_milestone` on confirm       |
| `prepare_record_observation` | prepare | → `TrackingService.record_observation` on confirm     |

## Safety model

- **Identity is not an argument.** `RunContext` supplies the person and the session. The
  runtime refuses any identity-bearing key (`uid`, `owner*`, `user*`, `principal`, `admin`,
  `role(s)`, `impersonate`, `session_id`, `run_id`, …) anywhere in the arguments, before the
  call touches anything. Resource ids the model supplies are authorized by the service; a
  forged one is `NOT_FOUND`.
- **Untrusted data stays data.** Retrieved documents and user text arrive as tool arguments
  (e.g. a search query, an impact summary to check). They cannot redefine permissions or
  trigger another action.
- **Prepare, don't perform.** Meaningful/irreversible actions return a `PreparedAction` bound
  to the resource's current version. The UI confirms with an explicit action; `confirm`
  re-checks the token and the live version (stale confirmations refused) and routes through the
  authorized service, which still applies its own permission and compare-and-set checks.
- **Bounds.** Run wall-clock `expires_at`, a durable monotonic `step_seq` with `max_tool_steps`,
  `max_tool_fanout` per turn and `max_tool_repeats` for identical calls. Expiry and old-step
  rejection are judged from the run record alone — independent of any TTL cleanup (ADR 0016 §8).

## The Koramangala example

For _“I stay in Koramangala; help improve water in my region,”_ `resolve_location` returns the
candidate places (Koramangala, Koramangala 1st Block, …) and **chooses nothing**; the person
picks one, which `confirm_location`/`set_area` then save (reversible). `inspect_coverage` and
`inspect_baseline` report real coverage/baseline for that area; the agent asks only for a
missing goal/constraints and sets them with `set_goal`/`update_constraints`; then it drives the
workspace from real `compare_options`/`inspect_returns`/`find_funding` results. Finalizing a
report or joining a community is only ever _prepared_ for the person to confirm.

## Acceptance evidence

`tests/agent/test_agent_tools.py` and `tests/agent/test_adk_tools.py` (fake inference only)
cover: identity-override arguments (incl. nested) refused before any step; a run driven only by
its owner; forged ids → `NOT_FOUND`; ambiguous location clarified and nothing chosen;
prompt-injection text treated as data; unknown/malformed/extra arguments rejected;
replayed/old steps refused from the durable cursor; identical calls bounded; expired runs
refused and stopped without a sweep; step budget and fan-out bounded; PREPARE tools non-mutating
and confirmation-required; confirmation executes through the authorized service; stale and
tampered confirmations refused; confirmation still subject to the service's own permission and
compare-and-set; and the ADK adapter exposing typed declarations and surfacing refusals as data.

## Rollout

Blocked as in ADR 0016: the agent loop is not wired to a model here, no live Vertex call is
made, nothing runs against a real project. AI stays disabled; ordinary planning never touches
the agent.
