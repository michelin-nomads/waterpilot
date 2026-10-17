import { expect, test, type Page } from '@playwright/test';

// Job progress in a real browser, against the local API and the Firebase emulators
// (`npm run test:e2e:emulator`): the real SSE stream through the shared Axios client,
// restore by id after a refresh, and owner scoping. The job document is written straight
// into the Firestore emulator (no renderer exists until Prompt 20, and no worker runs
// here), then advanced the way the worker would advance it.
const AUTH_EMULATOR = 'http://127.0.0.1:9099';
const FIRESTORE = 'http://127.0.0.1:8080/v1/projects/demo-waterpilot/databases/(default)/documents';
const API = 'http://127.0.0.1:8000';

async function servicesUp(): Promise<boolean> {
  try {
    const [auth, api] = await Promise.all([
      fetch(`${AUTH_EMULATOR}/emulator/v1/projects/demo-waterpilot/config`),
      fetch(`${API}/healthz`),
    ]);
    return auth.ok && api.ok;
  } catch {
    return false;
  }
}

test.beforeEach(async () => {
  const up = await servicesUp();
  if (!up && process.env.WP_REQUIRE_AUTH_EMULATOR === '1') {
    throw new Error('Auth emulator or local API not running (WP_REQUIRE_AUTH_EMULATOR=1)');
  }
  test.skip(!up, 'Auth emulator or local API not running');
});

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const randomId = (prefix: string) =>
  `${prefix}_${Array.from({ length: 26 }, () => ALPHABET[Math.floor(Math.random() * 32)]).join('')}`;

/** Signs up a fresh account; returns its uid, read from the bearer token the browser sends. */
async function startAsGuest(page: Page): Promise<string> {
  const token = page
    .waitForRequest((r) => r.url().endsWith('/graphql') && !!r.headers()['authorization'])
    .then((r) => r.headers()['authorization']!.split(' ')[1]!);
  await page.goto('/signin');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel(/^Email/).fill(`jobs-${Date.now()}@example.org`);
  await page.getByLabel(/^Password/).fill('secret-pass');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/$/);
  const payload = JSON.parse(Buffer.from((await token).split('.')[1]!, 'base64url').toString()) as {
    user_id: string;
  };
  return payload.user_id;
}

type JobFields = {
  version: number;
  status: string;
  stage: string | null;
  attempts: number;
  errorCode?: string | null;
};

/** Write the job as the backend stores it (a JSON dump of `JobRecord`). */
async function writeJob(id: string, ownerUid: string, fields: JobFields) {
  const now = new Date().toISOString();
  const value = (v: string | number | null) =>
    v === null
      ? { nullValue: null }
      : typeof v === 'number'
        ? { integerValue: String(v) }
        : { stringValue: v };
  const record: Record<string, string | number | null> = {
    id,
    version: fields.version,
    created_at: '2026-10-10T06:00:00Z',
    updated_at: now,
    owner_uid: ownerUid,
    kind: 'proposal_generation',
    status: fields.status,
    stage: fields.stage,
    attempts: fields.attempts,
    max_attempts: 3,
    resource_id: randomId('prp'),
    error_code: fields.errorCode ?? null,
    dispatch_seq: 1,
  };
  const response = await fetch(`${FIRESTORE}/jobs/${id}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: Object.fromEntries(Object.entries(record).map(([k, v]) => [k, value(v)])),
    }),
  });
  expect(response.ok).toBe(true);
}

test('follows a job live, restores it by id after a refresh, and stops at the end', async ({
  page,
}) => {
  const uid = await startAsGuest(page);
  const jobId = randomId('job');
  await writeJob(jobId, uid, { version: 1, status: 'queued', stage: null, attempts: 0 });

  const streams: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith(`/v1/jobs/${jobId}/events`)) streams.push(r.url());
  });

  await page.goto(`/jobs/${jobId}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Task progress' })).toBeVisible();
  await expect(page.getByText('Waiting to start')).toBeVisible();
  await expect(page.getByText('Live updates on.')).toBeVisible();

  await writeJob(jobId, uid, { version: 2, status: 'running', stage: 'rendering', attempts: 1 });
  await expect(page.getByText('Preparing the document.')).toBeVisible();
  await expect(page.getByText('In progress')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Preparing the document.')).toBeVisible();
  await expect(page.getByText('Live updates on.')).toBeVisible();

  await writeJob(jobId, uid, {
    version: 3,
    status: 'failed',
    stage: 'failed',
    attempts: 1,
    errorCode: 'SERVICE_UNAVAILABLE',
  });
  await expect(page.getByText('Could not finish')).toBeVisible();
  await expect(page.getByText(/cannot be produced in this version yet/i)).toBeVisible();
  await expect(page.getByText('Attempt 1 of 3')).toBeVisible();
  const opened = streams.length;
  await page.waitForTimeout(1_500);
  expect(streams.length).toBe(opened);
});

test('another account cannot see the job', async ({ page }) => {
  const jobId = randomId('job');
  await writeJob(jobId, 'someone-else', {
    version: 1,
    status: 'running',
    stage: 'rendering',
    attempts: 1,
  });
  await startAsGuest(page);
  await page.goto(`/jobs/${jobId}`);
  await expect(page.getByText('We could not find this task')).toBeVisible();
  await expect(page.getByText('Preparing the document.')).toHaveCount(0);
});
