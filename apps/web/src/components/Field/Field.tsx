import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { Icon, type IconName } from '../Icon/Icon';
import styles from './Field.module.scss';

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  required?: boolean;
}

interface FieldProps {
  /** Stable control id, needed when an ErrorSummary links to this field. */
  id?: string;
  label: ReactNode;
  hint?: ReactNode;
  hintPosition?: 'before' | 'after';
  /** Optional contextual help beside the label, outside its click target. */
  labelAction?: ReactNode;
  /** Actionable message: say what is wrong and how to fix it. */
  error?: ReactNode;
  required?: boolean;
  /** Keep the label for assistive technology only (the control carries a placeholder). */
  hideLabel?: boolean;
  /** Receives the id/ARIA wiring for the control so label, hint and error stay linked. */
  children: (control: FieldControlProps) => ReactNode;
}

export function Field({
  id: idProp,
  label,
  hint,
  hintPosition = 'before',
  labelAction,
  error,
  required = false,
  hideLabel = false,
  children,
}: FieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const fieldLabel = (
    <label
      className={[styles.label, hideLabel && styles.hidden].filter(Boolean).join(' ')}
      htmlFor={id}
    >
      {label}
      {required && (
        <span className={styles.required} aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </label>
  );
  return (
    <div className={styles.field}>
      {labelAction ? (
        <div className={styles.labelRow}>
          {fieldLabel}
          {labelAction}
        </div>
      ) : (
        fieldLabel
      )}
      {hint && hintPosition === 'before' && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required: required || undefined,
      })}
      {hint && hintPosition === 'after' && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={[styles.control, className].filter(Boolean).join(' ')}
        {...rest}
      />
    );
  },
);

interface AdornedInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Decorative icon at the start of the control. */
  icon: IconName;
  /** Control at the end, such as a show/hide button. */
  end?: ReactNode;
}

/** An input with a leading icon and an optional trailing control. */
export const AdornedInput = forwardRef<HTMLInputElement, AdornedInputProps>(function AdornedInput(
  { icon, end, ...rest },
  ref,
) {
  return (
    <span className={styles.adorned}>
      <Icon name={icon} className={styles.adornedIcon} />
      <Input ref={ref} className={styles.adornedControl} {...rest} />
      {end && <span className={styles.adornedEnd}>{end}</span>}
    </span>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={[styles.control, className].filter(Boolean).join(' ')}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={[styles.control, styles.textarea, className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});
