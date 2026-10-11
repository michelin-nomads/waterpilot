import { forwardRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

import { Icon, type IconName } from '../Icon/Icon';
import { Spinner } from '../Spinner/Spinner';
import styles from './Button.module.scss';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  startIcon?: IconName;
  endIcon?: IconName;
  fullWidth?: boolean;
  children: ReactNode;
}

function classNames(variant: Variant, size: Size, fullWidth: boolean, extra?: string): string {
  return [styles.button, styles[variant], styles[size], fullWidth && styles.full, extra]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps
  extends CommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Keeps the button focusable but inert and announces busy state. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    startIcon,
    endIcon,
    fullWidth = false,
    loading = false,
    type = 'button',
    className,
    children,
    onClick,
    ...rest
  },
  ref,
) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading || rest['aria-disabled'] === true || rest['aria-disabled'] === 'true') {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={classNames(variant, size, fullWidth, className)}
      aria-busy={loading || undefined}
      aria-disabled={loading || rest['aria-disabled'] || undefined}
      onClick={handleClick}
    >
      {loading ? <Spinner size="sm" /> : startIcon && <Icon name={startIcon} size="sm" />}
      <span>{children}</span>
      {endIcon && <Icon name={endIcon} size="sm" />}
    </button>
  );
});

export interface ButtonLinkProps extends CommonProps, Omit<LinkProps, 'children'> {}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  startIcon,
  endIcon,
  fullWidth = false,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={classNames(variant, size, fullWidth, className)} {...rest}>
      {startIcon && <Icon name={startIcon} size="sm" />}
      <span>{children}</span>
      {endIcon && <Icon name={endIcon} size="sm" />}
    </Link>
  );
}
