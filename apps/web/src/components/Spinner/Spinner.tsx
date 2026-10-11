import styles from './Spinner.module.scss';

/** Indeterminate activity indicator. Decorative; pair it with a text status. */
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return <span className={`${styles.spinner} ${styles[size]}`} aria-hidden="true" />;
}
