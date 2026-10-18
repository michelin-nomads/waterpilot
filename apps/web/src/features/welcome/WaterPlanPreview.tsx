import { useId, useRef, useState, type KeyboardEvent } from 'react';

import { Button } from '../../components/Button/Button';
import styles from './Welcome.module.scss';

const AREAS = [
  { name: 'Garden Heights', demand: 60, supply: 42, gains: [14, 22, 30] },
  { name: 'Lakeview', demand: 90, supply: 65, gains: [12, 20, 29] },
  { name: 'Hillview', demand: 45, supply: 29, gains: [10, 13, 19] },
];
const PLANS = [
  {
    name: 'Rainwater harvesting',
    description: 'Capture rooftop rainwater · Seasonal supply',
    cost: '₹4–6 lakh',
    time: '2–3 months',
  },
  {
    name: 'Water reuse',
    description: 'Treat and reuse water · Non-drinking needs',
    cost: '₹8–12 lakh',
    time: '3–5 months',
  },
  {
    name: 'Harvesting + reuse',
    description: 'Combine both approaches · Broader coverage',
    cost: '₹12–17 lakh',
    time: '4–6 months',
  },
];
const TABS = ['Understand', 'Compare', 'Take action'];

/** An isolated, illustrative product walkthrough; never creates a real planning session. */
export function WaterPlanPreview() {
  const id = useId();
  const body = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(0);
  const [areaIndex, setArea] = useState<number | null>(null);
  const [planIndex, setPlan] = useState<number | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [saved, setSaved] = useState(false);
  const area = areaIndex === null ? null : AREAS[areaIndex];
  const plan = planIndex === null ? null : PLANS[planIndex];
  const gain = area && planIndex !== null ? area.gains[planIndex] : 0;
  const gap = area ? Math.max(0, area.demand - area.supply - gain) : 0;
  const go = (next: number) => {
    setTab(next);
    body.current?.scrollTo?.({ top: 0 });
  };
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % 3;
    else if (event.key === 'ArrowLeft') next = (index + 2) % 3;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 2;
    else return;
    event.preventDefault();
    go(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };
  const report =
    area && plan
      ? `WaterPilot — Community water plan\n\nCommunity: ${area.name}\nSelected plan: ${plan.name}\nDemand: ${area.demand} kL/day\nSupply: ${area.supply} kL/day\nPotential additional supply: ${gain} kL/day\nRemaining gap: ${gap} kL/day\nIndicative cost: ${plan.cost}\nTimeline: ${plan.time}\nNext: site feasibility assessment and community review.\n`
      : '';
  return (
    <aside className={styles.preview} aria-label="Your community water plan">
      <header className={styles.previewHeader}>
        <p className={styles.eyebrow}>What you’ll work towards</p>
        <h2>Your community water plan</h2>
        <p>A clearer picture. Practical options. Next steps.</p>
      </header>
      <div className={styles.tabs} role="tablist" aria-label="Explore your water plan">
        {TABS.map((label, index) => (
          <button
            key={label}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-controls={`${id}-panel`}
            aria-selected={tab === index}
            tabIndex={tab === index ? 0 : -1}
            onKeyDown={(event) => onTabKeyDown(event, index)}
            onClick={() => go(index)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        ref={body}
        className={styles.previewBody}
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${tab}`}
        tabIndex={0}
      >
        {tab === 0 && (
          <>
            <h3>Where is your community?</h3>
            <p>Select a pin to explore the area’s water situation.</p>
            <div className={styles.map} role="group" aria-label="Choose a community on the map">
              <svg viewBox="0 0 360 166" preserveAspectRatio="none" aria-hidden="true">
                <path
                  className={styles.river}
                  d="M280 -15 C210 30 290 60 233 108 S244 158 200 190"
                />
                <g className={styles.blocks}>
                  {[
                    [12, 10, 55, 31],
                    [83, 7, 60, 34],
                    [162, 8, 41, 33],
                    [17, 66, 78, 27],
                    [112, 63, 72, 31],
                    [10, 116, 56, 38],
                    [83, 116, 86, 35],
                    [285, 119, 60, 32],
                  ].map(([x, y, width, height]) => (
                    <rect key={`${x}-${y}`} x={x} y={y} width={width} height={height} rx="5" />
                  ))}
                </g>
                <path
                  className={styles.roads}
                  d="M0 53 H360 M0 104 H360 M74 0 V166 M153 0 V166 M315 0 V166"
                />
              </svg>
              {AREAS.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  className={styles.pin}
                  aria-pressed={areaIndex === index}
                  onClick={() => {
                    setArea(index);
                    setPlan(null);
                    setReviewed(false);
                    setSaved(false);
                  }}
                >
                  <span aria-hidden="true">⌖</span> {item.name}
                </button>
              ))}
            </div>
            <div aria-live="polite">
              {area ? (
                <>
                  <h3>{area.name} · Area analysis</h3>
                  <div className={styles.metrics}>
                    {[
                      ['Demand', area.demand],
                      ['Supply', area.supply],
                      ['Water gap', area.demand - area.supply],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                        <small>kL / day</small>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className={styles.empty}>Choose a location above to see its area analysis.</p>
              )}
            </div>
            <Button
              fullWidth
              size="sm"
              disabled={!area}
              onClick={() => go(1)}
              className={styles.next}
            >
              Compare plans →
            </Button>
          </>
        )}
        {tab === 1 &&
          (area ? (
            <>
              <h3>Choose a plan for {area.name}</h3>
              <p>Current gap: {area.demand - area.supply} kL/day</p>
              {PLANS.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  className={styles.planOption}
                  aria-pressed={planIndex === index}
                  onClick={() => {
                    setPlan(index);
                    setReviewed(false);
                    setSaved(false);
                  }}
                >
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                  <span>
                    +{area.gains[index]} kL/day potential · {item.cost}
                  </span>
                  <span className={styles.radio} aria-hidden="true" />
                </button>
              ))}
              <Button
                size="sm"
                fullWidth
                disabled={!plan}
                onClick={() => go(2)}
                className={styles.next}
              >
                Review selected plan →
              </Button>
            </>
          ) : (
            <>
              <h3>Start with your community</h3>
              <p className={styles.empty}>Select a location on the map before comparing plans.</p>
              <Button size="sm" fullWidth onClick={() => go(0)}>
                Choose a location →
              </Button>
            </>
          ))}
        {tab === 2 &&
          (area && plan ? (
            <>
              <h3>Review your water plan</h3>
              <p>Review your plan before saving.</p>
              <div className={styles.review}>
                <p className={styles.eyebrow}>Community water report</p>
                <dl>
                  {[
                    ['Community', area.name],
                    ['Selected plan', plan.name],
                    ['Potential extra supply', `${gain} kL/day`],
                    ['Remaining gap', `${gap} kL/day`],
                    ['Cost / timeline', `${plan.cost} · ${plan.time}`],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <p>Next: site assessment and community review.</p>
              </div>
              <label className={styles.confirm}>
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(event) => setReviewed(event.target.checked)}
                />
                I’ve reviewed my water plan.
              </label>
              <Button size="sm" fullWidth disabled={!reviewed} onClick={() => setSaved(true)}>
                {saved ? '✓ Report saved' : 'Save report'}
              </Button>
              <div aria-live="polite">
                {saved && (
                  <a
                    className={styles.download}
                    download="waterpilot-report.txt"
                    href={`data:text/plain;charset=utf-8,${encodeURIComponent(report)}`}
                  >
                    Download report ↓
                  </a>
                )}
              </div>
            </>
          ) : (
            <>
              <h3>Your report starts with a plan</h3>
              <p className={styles.empty}>Choose a community and a plan to review your report.</p>
              <Button size="sm" fullWidth onClick={() => go(area ? 1 : 0)}>
                {area ? 'Compare plans' : 'Choose a location'} →
              </Button>
            </>
          ))}
      </div>
      <footer className={styles.previewFooter}>
        Understand your area. Choose a plan. Take action.
      </footer>
    </aside>
  );
}
