import { SignInForm } from '../../auth/SignInDialog';
import { ButtonLink } from '../../components/Button/Button';
import { Icon, type IconName } from '../../components/Icon/Icon';
import styles from './SignInScreen.module.scss';

const POINTS: ReadonlyArray<{ icon: IconName; lines: [string, string] }> = [
  { icon: 'chart', lines: ['Understand', 'your water situation'] },
  { icon: 'bulb', lines: ['Explore practical', 'improvements'] },
  { icon: 'users', lines: ['Plan for a more', 'water secure community'] },
];

interface SignInScreenProps {
  /** Runs once the person holds a permanent account. */
  onSignedIn: () => void;
}

/**
 * Sign in, or carry on as a guest. Signing in leads to the main screen; a guest goes there
 * without an account and chooses how to plan.
 */
export function SignInScreen({ onSignedIn }: SignInScreenProps) {
  return (
    <div className={styles.screen}>
      <svg
        className={styles.waves}
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className={styles.waveBack}
          d="M0 120C140 60 260 70 380 150s250 150 420 130 300-140 440-150c80-6 140 6 200 30v240H0Z"
        />
        <path
          className={styles.waveMid}
          d="M0 210C120 150 240 160 360 230s240 120 400 110 320-110 450-120c90-7 160 8 230 40v140H0Z"
        />
        <path
          className={styles.waveFront}
          d="M0 300c130-50 250-40 380 10s250 70 400 40 330-90 660-30v80H0Z"
        />
        <path
          className={styles.waveLine}
          d="M0 120C140 60 260 70 380 150s250 150 420 130 300-140 440-150c80-6 140 6 200 30"
        />
      </svg>

      <svg className={styles.drop} viewBox="0 0 260 300" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="sign-in-drop-clip">
            <path d="M130 10S40 118 40 188a90 90 0 0 0 180 0C220 118 130 10 130 10Z" />
          </clipPath>
          <linearGradient id="sign-in-drop-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.1" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.32" />
          </linearGradient>
        </defs>
        <path
          className={styles.cloud}
          d="M6 66a12 12 0 0 1 12-12 17 17 0 0 1 32 2 10 10 0 0 1 3 20H18A10 10 0 0 1 6 66Z"
        />
        <path
          className={styles.cloud}
          d="M214 38a7 7 0 0 1 7-7 10 10 0 0 1 19 1 6 6 0 0 1 1 12h-21a6 6 0 0 1-6-6Z"
        />
        <path
          className={styles.dropShape}
          d="M130 10S40 118 40 188a90 90 0 0 0 180 0C220 118 130 10 130 10Z"
        />
        <g clipPath="url(#sign-in-drop-clip)">
          <g className={styles.far}>
            <rect x="74" y="150" width="16" height="50" />
            <rect x="170" y="158" width="18" height="42" />
          </g>
          <g className={styles.skyline}>
            <rect x="88" y="136" width="24" height="70" />
            <rect x="116" y="112" width="26" height="94" />
            <rect x="146" y="144" width="22" height="62" />
          </g>
          <g className={styles.windows}>
            <path d="M94 148h4m6 0h2M94 160h4m6 0h2M94 172h4m6 0h2M94 184h4m6 0h2M122 124h4m6 0h4M122 136h4m6 0h4M122 148h4m6 0h4M122 160h4m6 0h4M122 172h4m6 0h4M152 156h4m6 0h2M152 168h4m6 0h2M152 180h4m6 0h2" />
          </g>
          <path className={styles.hillBack} d="M30 212c36-26 74-22 110-12s62 8 100-8v70H30Z" />
          <g className={styles.trees}>
            <circle cx="64" cy="204" r="12" />
            <circle cx="84" cy="210" r="9" />
            <circle cx="108" cy="208" r="10" />
            <circle cx="176" cy="206" r="11" />
            <circle cx="196" cy="212" r="8" />
          </g>
          <path className={styles.hillFront} d="M30 226c40-14 80-6 120-2s56 2 80-8v80H30Z" />
        </g>
        <path
          className={styles.dropOutline}
          d="M130 10S40 118 40 188a90 90 0 0 0 180 0C220 118 130 10 130 10Z"
        />
        <path className={styles.wave} d="M58 234q18-9 36 0t36 0 36 0 36 0" />
        <path className={styles.wave} d="M70 252q16-8 32 0t32 0 32 0 32 0" />
      </svg>

      <section className={styles.card} aria-labelledby="welcome-title">
        <h1 id="welcome-title" className={styles.title}>
          Welcome to WaterPilot
        </h1>
        <p className={styles.subtitle}>
          Sign in to save your work and get the most out of water planning for your community.
        </p>

        <SignInForm onDone={onSignedIn} />

        <div className={styles.guest}>
          <ButtonLink
            to="/"
            variant="secondary"
            fullWidth
            size="lg"
            className={styles.guestButton}
            startIcon="user"
            endIcon="arrow-right"
          >
            Continue as guest
          </ButtonLink>
          <p className={styles.footnote}>
            An account is only needed to finalize and save your plan.
          </p>
        </div>
      </section>

      <ul className={styles.points}>
        {POINTS.map((point) => (
          <li key={point.icon} className={styles.point}>
            <Icon name={point.icon} size="lg" className={styles.pointIcon} />
            <span>
              {point.lines[0]}
              <br />
              {point.lines[1]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
