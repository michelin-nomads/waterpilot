import { useId, useState, type ReactNode } from 'react';

import { Icon } from '../Icon/Icon';
import styles from './charts.module.scss';
import { formatChartValue, type ChartData } from './scale';

interface ChartFrameProps {
  data: ChartData;
  /** Renders the SVG; receives the id of the hidden description for aria-describedby. */
  renderChart: (descriptionId: string) => ReactNode;
}

/**
 * Figure with title, legend and a chart/table toggle. The table is the accessible
 * alternative and shows unavailable values as "Unavailable", never as 0.
 */
export function ChartFrame({ data, renderChart }: ChartFrameProps) {
  const id = useId();
  const [showTable, setShowTable] = useState(false);
  const titleId = `${id}-title`;
  const descriptionId = `${id}-desc`;

  return (
    <figure className={styles.figure} aria-labelledby={titleId}>
      <div className={styles.figureHeader}>
        <figcaption id={titleId} className={styles.title}>
          {data.title} <span className={styles.unit}>({data.unit})</span>
        </figcaption>
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={showTable}
          onClick={() => setShowTable((value) => !value)}
        >
          <Icon name={showTable ? 'chart' : 'table'} size="sm" />
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>
      {data.description && (
        <p id={descriptionId} className={styles.description}>
          {data.description}
        </p>
      )}
      {showTable ? <ChartTable data={data} /> : renderChart(descriptionId)}
      {!showTable && (
        <ul className={styles.legend} aria-label="Legend">
          {data.series.map((series, index) => (
            <li key={series.id}>
              <span
                className={`${styles.swatch} ${styles[`series${(index % 4) + 1}`]}`}
                aria-hidden="true"
              />
              {series.label}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

function ChartTable({ data }: { data: ChartData }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.caption}>
          {data.title} ({data.unit})
        </caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            {data.series.map((series) => (
              <th key={series.id} scope="col">
                {series.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.categories.map((category, row) => (
            <tr key={category}>
              <th scope="row">{category}</th>
              {data.series.map((series) => {
                const value = series.values[row] ?? null;
                const text = series.display?.[row] ?? null;
                return (
                  <td key={series.id} data-unavailable={value === null || undefined}>
                    {value === null ? 'Unavailable' : (text ?? formatChartValue(data, value))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
