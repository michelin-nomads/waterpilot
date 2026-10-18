"""Local-only deterministic tool dialogue. No network or live model."""

import json
import re
from collections.abc import Callable

from waterpilot.adapters.model_fake import response
from waterpilot.application.ports import ModelCancelled, ModelRequest, ModelResponse


class LocalAgentProvider:
    available = True
    agent_protocol = True

    def __init__(self, model_id: str) -> None:
        self.model_id = model_id

    def generate(
        self, request: ModelRequest, *, is_cancelled: Callable[[], bool] | None = None
    ) -> ModelResponse:
        if is_cancelled and is_cancelled():
            raise ModelCancelled()
        if request.task == "area_assumptions":
            # Deliberately fixed fake values, never purported city-specific measurements.
            return response(
                json.dumps(
                    {
                        "residents_per_home": 4,
                        "per_capita_lpd": {"low": "80", "value": "100", "high": "135"},
                        "delivered_supply_lpd": {"low": "20000", "value": "30000", "high": "40000"},
                        "tanker_supply_lpd": {"low": "5000", "value": "10000", "high": "15000"},
                        "rationale": "Fixed fake example; not city research or real records.",
                    }
                ),
                input_tokens=600,
                output_tokens=250,
            )
        conversation, _, raw_workspace = request.prompt.partition("Authoritative workspace:")
        try:
            workspace = json.loads(raw_workspace) if raw_workspace else {}
        except (ValueError, TypeError):
            workspace = {}
        stage = workspace.get("stage", "understand").lower()
        area = workspace.get("area_id")
        tool = "inspect_coverage"
        if raw_workspace:
            if not area or stage in {"understand", "goal", "review"}:
                tool = "inspect_planning_state"
            elif stage.startswith("baseline"):
                tool = "inspect_baseline"
            elif stage == "compare" and workspace.get("goal"):
                tool = "compare_options"
        last_user = conversation.rfind("user:")
        last_response = conversation.rfind("function_response:")
        continuing = conversation[last_user:].startswith(
            "user: Continue from the saved conversation"
        )
        latest_text = conversation[last_user + len("user:") :].split("\n", 1)[0].strip()
        args: dict[str, object] = {}
        goal_command = re.fullmatch(
            r"set (?:my )?goal to reduce (?:water )?shortage[.!]?", latest_text, re.I
        )
        homes_command = re.fullmatch(
            r"set occupied homes to ([1-9][0-9]{0,5})[.!]?", latest_text, re.I
        )
        scripted_edit = False
        if (
            area
            and (
                workspace.get("baseline_reviewed")
                or workspace.get("goal")
                or (workspace.get("scenario") or {}).get("confirmed")
            )
            and goal_command
        ):
            tool, args, scripted_edit = "set_goal", {"goal": {"kind": "reduce_shortage"}}, True
        elif area and homes_command:
            tool, args, scripted_edit = (
                "update_site_profile",
                {"occupied_homes": int(homes_command[1])},
                True,
            )
        if last_response < last_user and not (continuing and last_response >= 0):
            text = json.dumps({"tool": tool, "args": args})
        else:
            if scripted_edit:
                text = (
                    "The requested change was processed by the workspace tool. "
                    "Check its result and the saved workspace."
                )
            elif raw_workspace and not area:
                text = (
                    "Choose and save a location in the workspace first. "
                    "No local water assessment has been calculated."
                )
            else:
                text = (
                    f"Reviewed the saved {stage.replace('_', ' ')} workspace. "
                    "See the structured tool result for recorded values and missing information."
                )
            text += (
                " Local fake inference: only explicit demo commands for occupied homes and "
                "reducing shortage are supported; other edits use workspace controls."
            )

        return response(text, input_tokens=120, output_tokens=40)
