"""Cloud Tasks and Cloud Storage adapters against in-process fakes (no network, no
credentials). Live behaviour is verified only in the gated deployment phase."""

from __future__ import annotations

import base64
import hashlib
from dataclasses import dataclass, field
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import pytest
from google.api_core import exceptions as gexc
from google.cloud import tasks_v2

from waterlens.adapters.storage_gcs import GcsObjectStorage, PublicBucketError, validate_key
from waterlens.adapters.tasks_cloud import (
    CloudTasksJobRunner,
    validate_queue_path,
    validate_worker_url,
)
from waterlens.application.ports import (
    DispatchError,
    ObjectConflictError,
    ObjectNotFoundError,
    ObjectTooLargeError,
    StorageKeyError,
    TaskRequest,
)

QUEUE = "projects/waterlens-pilot/locations/asia-south1/queues/waterlens-jobs"
WORKER = "https://worker-abc.a.run.app"
SA = "waterlens-dispatch@waterlens-pilot.iam.gserviceaccount.com"


@dataclass
class FakeTasksClient:
    created: list[tasks_v2.Task] = field(default_factory=list)
    error: Exception | None = None

    def create_task(self, *, parent: str, task: tasks_v2.Task, timeout: float) -> tasks_v2.Task:
        assert parent == QUEUE and timeout <= 30
        if self.error is not None:
            raise self.error
        if any(t.name == task.name for t in self.created):
            raise gexc.AlreadyExists("task exists")
        self.created.append(task)
        return task


def runner(client: FakeTasksClient) -> CloudTasksJobRunner:
    return CloudTasksJobRunner(
        client, queue_path=QUEUE, worker_url=WORKER, service_account=SA, audience=WORKER
    )


def test_cloud_task_targets_the_private_worker_with_an_oidc_token() -> None:
    client = FakeTasksClient()
    when = datetime(2026, 10, 10, 6, 0, 30, tzinfo=UTC)
    runner(client).enqueue(TaskRequest("abc-job_X-2", "job_X", 2, when))
    (task,) = client.created
    assert task.name == f"{QUEUE}/tasks/abc-job_X-2"
    request = task.http_request
    assert request.url == WORKER + "/internal/jobs/run"
    assert request.http_method == tasks_v2.HttpMethod.POST
    assert request.body == b'{"jobId": "job_X", "dispatchSeq": 2}'
    assert request.oidc_token.service_account_email == SA
    assert request.oidc_token.audience == WORKER
    assert task.schedule_time.timestamp() == when.timestamp()
    assert task.dispatch_deadline.total_seconds() == 600


def test_repeated_dispatch_is_treated_as_delivered() -> None:
    client = FakeTasksClient()
    r = runner(client)
    r.enqueue(TaskRequest("same", "job_X", 1))
    r.enqueue(TaskRequest("same", "job_X", 1))
    assert len(client.created) == 1


@pytest.mark.parametrize(
    "error", [gexc.ServiceUnavailable("down"), gexc.PermissionDenied("no"), OSError("net")]
)
def test_queue_errors_become_dispatch_errors(error: Exception) -> None:
    with pytest.raises(DispatchError):
        runner(FakeTasksClient(error=error)).enqueue(TaskRequest("t", "job_X", 1))


def test_queue_path_and_worker_url_are_validated() -> None:
    assert validate_queue_path(QUEUE) == QUEUE
    for bad in (
        "queues/q",
        "projects/x/locations/l/queues/q/tasks/t",
        "projects/UP/locations/l/queues/q",
    ):
        with pytest.raises(ValueError):
            validate_queue_path(bad)
    assert validate_worker_url(WORKER + "/") == WORKER
    for bad in ("http://worker.run.app", "https://worker.run.app/path", "https://w.app/?q=1", "x"):
        with pytest.raises(ValueError):
            validate_worker_url(bad)


# --- Cloud Storage ----------------------------------------------------------------------


@dataclass
class FakeBlob:
    bucket: FakeBucket
    name: str
    size: int | None = None
    md5_hash: str | None = None
    generation: int | None = None

    def upload_from_string(
        self, data: bytes, *, content_type: str, if_generation_match: int
    ) -> None:
        assert if_generation_match == 0
        if self.name in self.bucket.objects:
            raise gexc.PreconditionFailed("exists")
        self.bucket.objects[self.name] = (data, content_type)

    def download_as_bytes(self, *, if_generation_match: int | None) -> bytes:
        assert if_generation_match == 1
        return self.bucket.objects[self.name][0]

    def exists(self) -> bool:
        return self.name in self.bucket.objects


@dataclass
class FakeBucket:
    name: str = "waterlens-artifacts"
    objects: dict[str, tuple[bytes, str]] = field(default_factory=dict)
    iam_configuration: Any = field(
        default_factory=lambda: SimpleNamespace(
            public_access_prevention="enforced", uniform_bucket_level_access_enabled=True
        )
    )

    def blob(self, name: str) -> FakeBlob:
        return FakeBlob(self, name)

    def get_blob(self, name: str) -> FakeBlob | None:
        if name not in self.objects:
            return None
        data = self.objects[name][0]
        md5 = base64.b64encode(hashlib.md5(data, usedforsecurity=False).digest()).decode()
        return FakeBlob(self, name, len(data), md5, 1)

    def reload(self) -> None:
        pass


def test_gcs_objects_are_create_only_with_identical_retries() -> None:
    bucket = FakeBucket()
    storage = GcsObjectStorage(bucket)
    storage.put("proposals/a/p/x.pdf", b"%PDF-1", content_type="application/pdf")
    storage.put("proposals/a/p/x.pdf", b"%PDF-1", content_type="application/pdf")
    with pytest.raises(ObjectConflictError):
        storage.put("proposals/a/p/x.pdf", b"%PDF-2", content_type="application/pdf")
    assert bucket.objects["proposals/a/p/x.pdf"] == (b"%PDF-1", "application/pdf")
    assert storage.exists("proposals/a/p/x.pdf")


def test_gcs_reads_check_size_before_download() -> None:
    bucket = FakeBucket()
    storage = GcsObjectStorage(bucket)
    storage.put("k/x", b"0123456789", content_type="application/json")
    assert storage.get("k/x", max_bytes=10) == b"0123456789"
    with pytest.raises(ObjectTooLargeError):
        storage.get("k/x", max_bytes=9)
    with pytest.raises(ObjectNotFoundError):
        storage.get("k/missing", max_bytes=9)


def test_gcs_refuses_a_bucket_that_could_be_public() -> None:
    GcsObjectStorage(FakeBucket()).check_private()
    for config in (
        {"public_access_prevention": "inherited", "uniform_bucket_level_access_enabled": True},
        {"public_access_prevention": "enforced", "uniform_bucket_level_access_enabled": False},
    ):
        with pytest.raises(PublicBucketError):
            GcsObjectStorage(
                FakeBucket(iam_configuration=SimpleNamespace(**config))
            ).check_private()


@pytest.mark.parametrize(
    "key", ["", "/abs", "a//b", "a/../b", "./a", "a/.", "ü/x", "a\nb", "x" * 1025]
)
def test_gcs_keys_are_validated_before_any_request(key: str) -> None:
    with pytest.raises(StorageKeyError):
        validate_key(key)
