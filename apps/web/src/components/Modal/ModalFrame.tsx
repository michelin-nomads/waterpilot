import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { Icon } from '../Icon/Icon';
import styles from './ModalFrame.module.scss';
import { useModalLayer } from './useModalLayer';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Element to focus on open; defaults to the first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

interface ModalFrameProps extends ModalProps {
  variant: 'dialog' | 'drawer';
  size?: 'sm' | 'md' | 'lg';
}

export function ModalFrame({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  initialFocusRef,
  variant,
  size = 'md',
}: ModalFrameProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useModalLayer({ open, onClose, panelRef, initialFocusRef });

  if (!open) return null;

  return createPortal(
    <div className={`${styles.layer} ${styles[variant]}`} data-modal-layer="">
      <div className={styles.backdrop} aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`${styles.panel} ${styles[size]}`}
      >
        <header className={styles.header}>
          <div className={styles.headings}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            )}
          </div>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
