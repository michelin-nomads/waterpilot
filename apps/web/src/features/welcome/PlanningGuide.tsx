import { Icon, type IconName } from '../../components/Icon/Icon';
import styles from './PlanningGuide.module.scss';

const STEPS: ReadonlyArray<{ icon: IconName; title: string; description: string }> = [
  {
    icon: 'map',
    title: 'Understand your water',
    description: 'See what is known about water where you live, including gaps in the data.',
  },
  {
    icon: 'layers',
    title: 'Compare your options',
    description: 'Explore practical plans, with the assumptions behind every figure.',
  },
  {
    icon: 'chart',
    title: 'Put your plan into action',
    description: 'When work starts, track results against the goal you set.',
  },
];

/** Optional orientation and account guidance, shared by both ways into planning. */
export function PlanningGuide() {
  return (
    <section className={styles.guide} aria-label="About planning with WaterPilot">
      <details className={styles.details}>
        <summary className={styles.summary}>
          <span className={styles.title}>How WaterPilot works</span>
          <span className={styles.chevron}>
            <Icon name="chevron-down" size="sm" />
          </span>
        </summary>
        <ol className={styles.steps}>
          {STEPS.map((step) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepIcon}>
                <Icon name={step.icon} />
              </span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.description}>{step.description}</p>
            </li>
          ))}
        </ol>
      </details>
      <div className={styles.notes}>
        <p className={styles.accountNote}>
          <span className={styles.reassurance}>
            <Icon name="check" size="sm" />
            No account needed to explore
          </span>
          <span className={styles.separator} aria-hidden="true">
            ·
          </span>
          <span>Sign in to save your first report.</span>
        </p>
        <p className={styles.coverage}>
          Coverage varies by location. We show what is known and where information is missing.
        </p>
      </div>
    </section>
  );
}
