import { ChartFrame } from './ChartFrame';
import { ValueAxis } from './ValueAxis';
import styles from './charts.module.scss';
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  CHART_WIDTH,
  formatChartValue,
  linearScale,
  niceTicks,
  valueDomain,
  type ChartData,
} from './scale';

/** Line chart; unavailable points break the line instead of dropping to zero. */
export function LineChart({
  data,
  includeZero = true,
}: {
  data: ChartData;
  includeZero?: boolean;
}) {
  return (
    <ChartFrame
      data={data}
      renderChart={(descriptionId) => (
        <LineSvg data={data} includeZero={includeZero} descriptionId={descriptionId} />
      )}
    />
  );
}

function segments(points: ReadonlyArray<readonly [number, number] | null>): string[] {
  const paths: string[] = [];
  let current: string[] = [];
  for (const point of points) {
    if (point === null) {
      if (current.length) paths.push(current.join(' '));
      current = [];
    } else {
      current.push(`${current.length ? 'L' : 'M'}${point[0].toFixed(1)},${point[1].toFixed(1)}`);
    }
  }
  if (current.length) paths.push(current.join(' '));
  return paths;
}

function LineSvg({
  data,
  includeZero,
  descriptionId,
}: {
  data: ChartData;
  includeZero: boolean;
  descriptionId: string;
}) {
  const [min, max] = valueDomain(data.series, includeZero);
  const ticks = niceTicks(min, max);
  const y = linearScale(
    [ticks[0] ?? 0, ticks[ticks.length - 1] ?? 1],
    [CHART_HEIGHT - CHART_MARGIN.bottom, CHART_MARGIN.top],
  );
  const plotWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const band = plotWidth / Math.max(1, data.categories.length);
  const x = (index: number) => CHART_MARGIN.left + index * band + band / 2;

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label={data.title}
      aria-describedby={data.description ? descriptionId : undefined}
    >
      <ValueAxis ticks={ticks} y={y} format={(v) => formatChartValue(data, v)} />
      {data.categories.map((category, index) => (
        <text
          key={category}
          x={x(index)}
          y={CHART_HEIGHT - CHART_MARGIN.bottom + 20}
          className={styles.axisLabel}
          textAnchor="middle"
        >
          {category}
        </text>
      ))}
      {data.series.map((series, si) => {
        const seriesClass = styles[`series${(si % 4) + 1}`];
        const points = series.values.map((value, index) =>
          value === null ? null : ([x(index), y(value)] as const),
        );
        return (
          <g key={series.id} className={seriesClass}>
            {segments(points).map((d) => (
              <path key={d} d={d} className={`${styles.line} ${styles[`dash${(si % 4) + 1}`]}`} />
            ))}
            {points.map((point, index) =>
              point === null ? null : (
                <circle key={index} cx={point[0]} cy={point[1]} r={3.5} className={styles.point} />
              ),
            )}
          </g>
        );
      })}
    </svg>
  );
}
