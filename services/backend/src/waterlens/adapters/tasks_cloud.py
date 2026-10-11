"""Cloud Tasks job runner (cloud mode): one HTTP task per run request.

Each task POSTs ``{"jobId", "dispatchSeq"}`` to the private worker's run path with an
OIDC token minted for the dispatch service account and the worker audience; the worker
verifies both (Cloud Run IAM also requires the invoker role). Task names are
deterministic, so a repeated dispatch is answered ``ALREADY_EXISTS`` and treated as
delivered. Delivery retries/backoff after a non-2xx worker answer come from the queue's
retry configuration (deployment assets, Prompt 25); the job's own attempt and dispatch
limits bound the total regardless.
"""

from __future__ import annotations

import json
import re
from datetime import timedelta
from typing import Protocol
from urllib.parse import urlsplit

from google.api_core import exceptions as gexc
from google.cloud import tasks_v2

from waterlens.application.ports import DispatchError, TaskRequest
from waterlens.worker.paths import RUN_PATH

QUEUE_PATH = re.compile(
    r"projects/[a-z][a-z0-9-]{4,28}[a-z0-9]/locations/[a-z0-9-]+/queues/[A-Za-z0-9-]{1,100}"
)
DISPATCH_DEADLINE = timedelta(minutes=10)
CREATE_TIMEOUT_SECONDS = 10.0


class _TasksClient(Protocol):
    def create_task(self, *, parent: str, task: tasks_v2.Task, timeout: float) -> tasks_v2.Task: ...


def validate_queue_path(value: str) -> str:
    if not QUEUE_PATH.fullmatch(value):
        raise ValueError("expected projects/<project>/locations/<location>/queues/<queue>")
    return value


def validate_worker_url(value: str) -> str:
    parts = urlsplit(value)
    if parts.scheme != "https" or not parts.hostname or parts.path not in ("", "/") or parts.query:
        raise ValueError("expected the worker's https origin, e.g. https://worker-xyz.a.run.app")
    return value.rstrip("/")


class CloudTasksJobRunner:
    def __init__(
        self,
        client: _TasksClient,
        *,
        queue_path: str,
        worker_url: str,
        service_account: str,
        audience: str,
    ) -> None:
        self._client = client
        self._queue = validate_queue_path(queue_path)
        self._url = validate_worker_url(worker_url) + RUN_PATH
        self._service_account = service_account
        self._audience = audience

    @classmethod
    def create(
        cls, *, queue_path: str, worker_url: str, service_account: str, audience: str
    ) -> CloudTasksJobRunner:
        return cls(
            tasks_v2.CloudTasksClient(),
            queue_path=queue_path,
            worker_url=worker_url,
            service_account=service_account,
            audience=audience,
        )

    def build_task(self, task: TaskRequest) -> tasks_v2.Task:
        body = json.dumps({"jobId": task.job_id, "dispatchSeq": task.dispatch_seq}).encode()
        built = tasks_v2.Task(
            name=f"{self._queue}/tasks/{task.name}",
            http_request=tasks_v2.HttpRequest(
                http_method=tasks_v2.HttpMethod.POST,
                url=self._url,
                headers={"Content-Type": "application/json"},
                body=body,
                oidc_token=tasks_v2.OidcToken(
                    service_account_email=self._service_account, audience=self._audience
                ),
            ),
            dispatch_deadline=DISPATCH_DEADLINE,
        )
        if task.not_before is not None:
            built.schedule_time = task.not_before
        return built

    def enqueue(self, task: TaskRequest) -> None:
        try:
            self._client.create_task(
                parent=self._queue, task=self.build_task(task), timeout=CREATE_TIMEOUT_SECONDS
            )
        except gexc.AlreadyExists:
            return  # the same run request was dispatched before
        except (gexc.GoogleAPIError, OSError) as err:
            raise DispatchError(f"Cloud Tasks rejected the task: {type(err).__name__}") from err
