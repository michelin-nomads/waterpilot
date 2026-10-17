import { ButtonLink, Notice } from '../../components';
import { shiftDecimalLeft } from '../../lib/format';
import { currencyExponent } from '../goals/goalDraft';
import { PageHeader } from '../../shell/PageHeader';
import result from '../../../../../docs/data/examples/sjr-parkway-homes-simulation/calculation-results.synthetic.json';
import styles from '../goals/Goals.module.scss';

/** Read-only local fixture viewer: deliberately never writes the planning session. */
export default function SocietySimulation() {
  const option = result.comparison.options[0];
  const economics = option.economics;
  const money = (value: { minor_units: string; currency: string }) => {
    const exponent = currencyExponent(value.currency);
    return exponent === null
      ? `${value.currency} ${value.minor_units} minor units`
      : `${value.currency} ${shiftDecimalLeft(value.minor_units, exponent)}`;
  };
  const percent = (value: string) => (Number(value) * 100).toFixed(3);
  const tariff = result.inputs.goal.water_tariff;
  return (
    <div className={styles.page}>
      <PageHeader
        title="SJR Parkway Homes simulation"
        eyebrow="Local synthetic example"
        subtitle="Rayasandra, Bengaluru · illustrative calculations, not society operating records"
        actions={
          <ButtonLink to="/area" variant="secondary">
            Return to your plan
          </ButtonLink>
        }
      />
      <Notice kind="caution" title="SYNTHETIC — invented operational data">
        Every water, occupancy, cost and performance input here is an assumption. This example does
        not change your location, saved plan, evidence or reports. It cannot be finalized as a real
        society report.
      </Notice>
      <section className={styles.panel} aria-labelledby="simulation-assumptions">
        <h2 id="simulation-assumptions">Declared assumptions</h2>
        <p>{result.inputs.assumptions_note}</p>
        <p>
          Period: {result.inputs.start} to {result.inputs.end_exclusive} (exclusive), Asia/Kolkata.
          Delivered supply already includes tanker deliveries.
        </p>
        <p>
          The developer describes 9.5 acres and seven G+14 blocks. These publisher-reported facts do
          not establish population, water use or a surveyed boundary.{' '}
          <a href="https://sjrprime.com/projects/parkway_homes" target="_blank" rel="noreferrer">
            Developer project page
          </a>
          .
        </p>
      </section>
      <section className={styles.panel} aria-labelledby="simulation-baseline">
        <h2 id="simulation-baseline">Deterministic baseline</h2>
        <dl>
          {result.baseline.metrics.map((metric) => (
            <div key={metric.metric}>
              <dt>
                {metric.metric.replaceAll('_', ' ')} ({metric.unit})
              </dt>
              <dd>{metric.value ? metric.value.exact : `Unknown: ${metric.reason}`}</dd>
            </div>
          ))}
        </dl>
        <p>
          Fractions above are exact; ratios are shares, not percentages. Reliable-supply deficit
          differs from average supply. Calculation ID: <code>{result.calculation_id}</code>.
        </p>
        <p>
          CSV SHA-256: <code>{result.csv_sha256}</code>. Engines: {result.baseline_engine_version},{' '}
          {result.economics_engine_version}.
        </p>
      </section>
      <section className={styles.panel} aria-labelledby="simulation-option">
        <h2 id="simulation-option">Illustrative fixture option and economics</h2>
        <p>
          {option.name}: {option.water_low.exact}–{option.water_high.exact} L/day assumed saving.
          Average-day tanker share becomes about {percent(option.optimistic.decimal)}–
          {percent(option.pessimistic.decimal)}%, compared with the assumed{' '}
          {percent(result.comparison.target_level.decimal)}% target. Percentages are rounded for
          display. Savings displace tankers first; this is an explicit modelling assumption.
        </p>
        <dl>
          <dt>Upfront cost including {percent(economics.contingency.ratio)}% contingency</dt>
          <dd>
            {money(economics.upfront_total.low)} – {money(economics.upfront_total.high)}
          </dd>
          <dt>Annual maintenance</dt>
          <dd>
            {money(economics.recurring_annual.low)} – {money(economics.recurring_annual.high)}
          </dd>
          <dt>Net annual operating benefit</dt>
          <dd>
            {money(economics.net_annual.low)} – {money(economics.net_annual.high)}
          </dd>
          <dt>Approved funding</dt>
          <dd>{money(economics.funding.approved)}</dd>
          <dt>Simple payback</dt>
          <dd>
            {economics.payback.optimistic_days}–{economics.payback.pessimistic_days} days
          </dd>
        </dl>
        <p>
          Tariff assumes {money(tariff.price)} per {tariff.volume.value} {tariff.volume.unit}. Flat
          365-day years; no inflation or discounting. No domain review, measured performance or real
          funding approval is implied. Groundwater, water quality, STP operation, rainfall and
          roof/boundary data remain unknown.
        </p>
      </section>
      <section className={styles.panel}>
        <h2>Reproduce or change the assumptions locally</h2>
        <p>
          The CSV calculation CLI uses the same versioned baseline, scenario, option and economics
          engines as the application. Edit the separate synthetic input pack, run the documented
          command, then refresh this viewer. No model or live service is used.
        </p>
        <p>
          Instructions: <code>docs/data/examples/sjr-parkway-homes-simulation/README.md</code>.
          Scientific definitions and non-INR intervention reference prices remain outstanding.
        </p>
      </section>
    </div>
  );
}
