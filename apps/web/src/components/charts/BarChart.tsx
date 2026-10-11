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

/** Grouped vertical bar chart with an accessible table alternative. */
export function BarChart({ data }: { data: ChartData }) {
  return (
    <ChartFrame
      data={data}
      renderChart={(descriptionId) => <BarSvg data={data} descriptionId={descriptionId} />}
    />
  );
}

function BarSvg({ data, descriptionId }: { data: ChartData; descriptionId: string }) {
  const [min, max] = valueDomain(data.series, true);
  const ticks = niceTicks(min, max);
  const y = linearScale(
    [ticks[0] ?? 0, ticks[ticks.length - 1] ?? 1],
    [CHART_HEIGHT - CHART_MARGIN.bottom, CHART_MARGIN.top],
  );
  const plotWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const band = plotWidth / Math.max(1, data.categories.length);
  const groupWidth = band * 0.72;
  const barWidth = groupWidth / Math.max(1, data.series.length);
  const zero = y(0);

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label={data.title}
      aria-describedby={data.description ? descriptionId : undefined}
    >
      <ValueAxis ticks={ticks} y={y} format={(v) => formatChartValue(data, v)} />
      {data.categories.map((category, ci) => {
        const groupX = CHART_MARGIN.left + ci * band + (band - groupWidth) / 2;
        return (
          <g key={category}>
            {data.series.map((series, si) => {
              const value = series.values[ci] ?? null;
              const x = groupX + si * barWidth;
              if (value === null) {
                return (
                  <text
                    key={series.id}
                    x={x + barWidth / 2}
                    y={zero - 4}
                    className={styles.unavailableMark}
                    textAnchor="middle"
                  >
                    n/a
                  </text>
                );
              }
              const top = Math.min(y(value), zero);
              return (
                <rect
                  key={series.id}
                  x={x + 1}
                  y={top}
                  width={Math.max(1, barWidth - 2)}
                  height={Math.max(1, Math.abs(zero - y(value)))}
                  rx={3}
                  className={styles[`series${(si % 4) + 1}`]}
                />
              );
            })}
            <text
              x={CHART_MARGIN.left + ci * band + band / 2}
              y={CHART_HEIGHT - CHART_MARGIN.bottom + 20}
              className={styles.axisLabel}
              textAnchor="middle"
            >
              {category}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
