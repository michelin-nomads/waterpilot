import { useEffect, useId, useRef } from 'react';

import { Icon } from '../Icon/Icon';
import styles from './ErrorSummary.module.scss';

export interface FieldError {
  /** id of the control to focus (the id `Field` passes to its control). */
  fieldId: string;
  /** Same actionable text as the inline error, optionally prefixed with the field name. */
  message: string;
}

interface ErrorSummaryProps {
  errors: readonly FieldError[];
  title?: string;
}

/**
 * Lists form errors after a submit. Takes focus when it appears so keyboard and
 * screen-reader users hear the problem; each link moves focus to its field.
 */
export function ErrorSummary({ errors, title = 'Check these fields' }: ErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const hasErrors = errors.length > 0;

  useEffect(() => {
    if (hasErrors) ref.current?.focus();
  }, [hasErrors]);

  if (!hasErrors) return null;

  return (
    <div ref={ref} className={styles.summary} tabIndex={-1} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.title}>
        <Icon name="alert-circle" size="sm" />
        {title}
      </h2>
      <ul className={styles.list}>
        {errors.map((error) => (
          <li key={error.fieldId}>
            <a
              href={`#${error.fieldId}`}
              onClick={(event) => {
                const field = document.getElementById(error.fieldId);
                if (!field) return;
                event.preventDefault();
                field.focus();
              }}
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
