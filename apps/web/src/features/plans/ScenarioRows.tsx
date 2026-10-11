import type { ScenarioComparisonFieldsFragment } from '../../graphql/generated/graphql';
import { formatChange, formatMetric } from './plansFormat';
import styles from './Plans.module.scss';

/** A what-if beside the same baseline, with the engine's notes. Unknown stays unknown. */
export function ScenarioRows({ comparison }: { comparison: ScenarioComparisonFieldsFragment }) {
  return (
    <>
      <table className={styles.table}>
        <caption className={styles.caption}>Against the same baseline</caption>
        <thead>
          <tr>
            <th scope="col">Quantity</th>
            <th scope="col">Baseline</th>
            <th scope="col">What-if</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              {r.reason ? (
                <td colSpan={3} className={styles.muted}>
                  {r.reason}
                </td>
              ) : (
                <>
                  <td>{formatMetric(r.baseline, r.unit)}</td>
                  <td>{formatMetric(r.scenario, r.unit)}</td>
                  <td>{formatChange(r.change, r.unit)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {comparison.notes.length > 0 && (
        <ul className={styles.list}>
          {comparison.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </>
  );
}
