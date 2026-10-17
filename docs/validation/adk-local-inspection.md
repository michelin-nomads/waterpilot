# ADK local inspection — 2026-10-17

Inspection only: no application code, running AI settings, credentials, infrastructure
or dependencies changed. No live model/embedding calls, deployment or provisioning.
The running API remains AI-disabled. Tests below inject fake providers into local
in-memory runtimes; they are not manual browser or Firestore-emulator acceptance.

## Existing implementation

- Installed runtime: `google-adk==2.11.0`, `google-genai==2.29.0` (locked environment).
- `application/agent/conversation.py`: actual ADK `Runner` and `LlmAgent`, shared
  `AgentToolRuntime`, authoritative workspace context, durable conversation sessions,
  45-second leases and deadline-limited execution segments.
- `adapters/adk_gateway_llm.py`: model calls go through `AiGateway`; gateway covers
  reservations, kill switch, tester access, deduplication, bounded retries, cancellation,
  expiry and conservative accounting after ambiguous dispatch.
- `application/agent/registry.py`: 30 typed read/edit/prepare tools covering location,
  coverage, baseline, goals, scenarios, options, economics, impact, funding, reports,
  communities and tracking. Meaningful actions use prepared envelopes and explicit UI
  confirmation through the shared application services.
- `api/agent_routes.py` and `features/planning/agentTransport.ts`: authenticated fetch
  SSE, Authorization header tokens, ordered IDs, reconnect cursor, history reset,
  heartbeat, idle timeout, refreshed authentication, cancel and Continue endpoints.
  Reconnecting reads the existing run; it does not start inference.
- `AgentConversation.tsx`: structured result cards, affected-cache invalidation,
  workspace reconciliation after manual edits, explicit action confirmation and focus
  navigation. Backend public text excludes ADK thought parts.

## Concrete gaps

1. **Fake dialogue is intentionally narrow.** `LocalAgentProvider` calls
   `inspect_coverage`, then returns a fixed explanatory response. It does not demonstrate
   arbitrary natural-language planning, baseline edits or a complete planning journey.
2. **Live structured tool calling is not wired.** `GatewayLlm._prompt_text` flattens
   text and tool responses, omits tool declarations/function-call parts, and calls
   `complete_text`. `ModelRequest`/`ModelResponse` currently expose text rather than a
   structured tool-call exchange. `VertexModelProvider` submits `request.prompt` and
   returns `result.text`. Only the fake JSON protocol is converted back into ADK
   function calls. Supplying live credentials alone cannot complete this agent loop.
3. **New input editing is absent from the tool catalogue.** Manual baseline inputs
   (`ReadinessService.record_manual_input`) and session `site_profile` updates exist in
   application services but have no corresponding agent tools. Reuse their authorization,
   exact units, source/date validation and concurrency rules when adding them.
4. **Public streaming is buffered-text chunking.** Provider token streaming is not
   implemented: complete responses are emitted in 40-character public chunks. Tool and
   lifecycle events are real incremental events; neither is private reasoning.
5. **Conversation activation is local-only.** Factory wiring requires
   `agent_fake_inference` and non-pilot mode; the UI conversation is also local-only.
   These guards are intentional and should remain until live wiring is separately
   authorized and verified. The local demo needs `WP_AGENT_FAKE_INFERENCE=true`,
   `WP_AI_ENABLED=true`, explicit tester access and a positive budget allowance even
   though fake inference makes no billable call.
6. Some earlier adapter/session documentation still says local runtimes never construct
   ADK adapters. The later fake-conversation path does construct them; reconcile those
   descriptions when implementing the next change.

## Executed checks

From `services/backend`, using installed locked Python dependencies:

```bash
.venv/bin/pytest tests/agent/test_conversation.py \
  tests/agent/test_adk_tools.py tests/agent/test_agent_tools.py \
  tests/api/test_agent_conversation_http.py tests/test_ai_gateway.py
# 65 passed; one existing Starlette/httpx deprecation warning

.venv/bin/pytest tests/adk/test_runner_local.py tests/adk/test_gateway_llm.py
# 12 passed
```

Using pinned Node 24.21.0 / npm 11.19.0 from the repository root:

```bash
npm -w apps/web run test -- \
  src/features/planning/agentConversation.test.tsx \
  src/features/planning/agentTransport.test.ts \
  src/features/planning/agentPanel.test.tsx
# 11 passed (three files)
```

The existing checks include actual Runner execution over fake inference, tool reuse,
ordered events/reconnect, cancellation, Continue, manual edits during inference,
lease/restart recovery, explicit confirmation, ownership and budget/replay controls.
They do not establish manual desktop acceptance or live Vertex compatibility.
No new test suite or unrelated full regression/build was run for this inspection.

## Recommended next bounded implementation

First complete a richer local fake dialogue through the existing Runner: inspect current
coverage/baseline, collect a sourced manual input, apply a version-checked workspace edit,
then return deterministic results in the existing UI. Add the two missing input-editing
capabilities through existing services and retain confirmations for meaningful actions.
Reuse the above tests with a small regression for the new service/tool path.

Then preserve structured model requests/responses through the same budget gateway,
verifying the protocol with an injected fake SDK/provider. Do not bypass accounting by
constructing ADK's direct Gemini client. Live model access remains separately authorized;
real society evidence, scientific review and non-INR reference economics remain pending.
