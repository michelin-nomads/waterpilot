import styles from './charts.module.scss';
import { CHART_MARGIN, CHART_WIDTH } from './scale';

interface ValueAxisProps {
  ticks: readonly number[];
  y: (value: number) => number;
  format: (value: number) => string;
}

/** Horizontal gridlines with value labels; the zero line is emphasised. */
export function ValueAxis({ ticks, y, format }: ValueAxisProps) {
  return (
    <g aria-hidden="true">
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={CHART_MARGIN.left}
            x2={CHART_WIDTH - CHART_MARGIN.right}
            y1={y(tick)}
            y2={y(tick)}
            className={tick === 0 ? styles.zeroLine : styles.gridLine}
          />
          <text
            x={CHART_MARGIN.left - 8}
            y={y(tick)}
            dy="0.32em"
            textAnchor="end"
            className={styles.axisLabel}
          >
            {format(tick)}
          </text>
        </g>
      ))}
    </g>
  );
}
