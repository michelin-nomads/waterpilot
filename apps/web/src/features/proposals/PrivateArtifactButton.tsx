import { useState } from 'react';

import { Button } from '../../components/Button/Button';
import { apiClient, getAuthToken } from '../../lib/apiClient';

export function PrivateArtifactButton({
  path,
  label,
  preview = false,
}: {
  path: string;
  label: string;
  preview?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const open = async () => {
    const previewWindow = preview ? window.open('about:blank', '_blank') : null;
    setBusy(true);
    setError(false);
    try {
      const request = (token: string | null) =>
        apiClient.get<Blob>(path, {
          responseType: 'blob',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      let response;
      try {
        response = await request(await getAuthToken());
      } catch (cause) {
        if (
          !('response' in (cause as object)) ||
          (cause as { response?: { status?: number } }).response?.status !== 401
        )
          throw cause;
        response = await request(await getAuthToken({ forceRefresh: true }));
      }
      const url = URL.createObjectURL(response.data);
      if (preview) {
        if (!previewWindow) throw new Error('A preview tab could not be opened.');
        previewWindow.opener = null;
        previewWindow.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = path.endsWith('/preview') ? 'proposal-review.html' : 'proposal.pdf';
        anchor.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      previewWindow?.close();
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span>
      <Button variant="secondary" loading={busy} onClick={() => void open()}>
        {label}
      </Button>
      {error && <span role="alert"> Could not open this private file. Try again.</span>}
    </span>
  );
}
