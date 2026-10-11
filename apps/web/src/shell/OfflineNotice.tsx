import { useEffect, useRef, useState } from 'react';

import { Notice } from '../components/Notice/Notice';
import { VisuallyHidden } from '../components/VisuallyHidden/VisuallyHidden';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import styles from './OfflineNotice.module.scss';

/**
 * Global offline banner under the header. A persistent live region announces both going
 * offline and coming back, since the visible banner disappears when the connection returns.
 */
export function OfflineNotice() {
  const online = useOnlineStatus();
  const wasOnline = useRef(online);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (wasOnline.current === online) return;
    wasOnline.current = online;
    setAnnouncement(
      online ? 'Back online.' : "You're offline. Actions that need the server are paused.",
    );
  }, [online]);

  return (
    <>
      <VisuallyHidden>
        <span role="status">{announcement}</span>
      </VisuallyHidden>
      {!online && (
        <div className={styles.wrap}>
          <Notice kind="offline" title="You're offline" announce={false}>
            What's on screen stays available. Actions that need the server are paused until the
            connection returns.
          </Notice>
        </div>
      )}
    </>
  );
}
