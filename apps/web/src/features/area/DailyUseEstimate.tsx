import { useState, type FormEvent } from 'react';
import { Badge, Button, Field, Icon, Input, Tooltip } from '../../components';
import { calculatePopulationEstimate } from './populationEstimateMath';
import styles from './CommunityBaseline.module.scss';

interface AcceptedEstimate {
  homes: string;
  residents: number;
  dailyUse: string;
  source: string;
}

/** Optional calculator: accepting the displayed assumptions supplies their provenance. */
export function DailyUseEstimate({
  initialHomes,
  saving,
  onBack,
  onAccept,
}: {
  initialHomes: string;
  saving: boolean;
  onBack: () => void;
  onAccept: (estimate: AcceptedEstimate) => void;
}) {
  const [homes, setHomes] = useState(initialHomes);
  const [people, setPeople] = useState('');
  const [use, setUse] = useState('');
  const estimate =
    Number(homes) <= 1000000 ? calculatePopulationEstimate(homes, people, use) : null;
  function accept(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!estimate) return;
    onAccept({
      homes,
      residents: Number(estimate.population),
      dailyUse: estimate.dailyDemandLitres,
      source: `${homes} homes × ${people} residents × ${use} litres/person/day.`,
    });
  }
  return (
    <form className={`${styles.form} ${styles.estimateForm}`} onSubmit={accept}>
      <div className={`${styles.estimateLayout} ${!estimate ? styles.emptyEstimate : ''}`}>
        <section className={styles.card} aria-labelledby="household-assumptions">
          <h2 id="household-assumptions" className={styles.cardTitle}>
            <Icon name="users" />
            Household assumptions
            <Tooltip label="About household assumptions">
              Estimate daily use from occupied homes, residents per home and litres used per person
              per day. Review each assumption before accepting.
            </Tooltip>
          </h2>
          <div className={styles.assumptionRow}>
            <Field hintPosition="after" id="helper-homes" label="Occupied homes" required>
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min={1}
                  max={1000000}
                  step={1}
                  value={homes}
                  onChange={(e) => setHomes(e.target.value)}
                />
              )}
            </Field>
            <span>homes</span>
          </div>
          <div className={styles.assumptionRow}>
            <Field hintPosition="after" id="helper-people" label="Residents per home" required>
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                />
              )}
            </Field>
            <span>people / home</span>
          </div>
          <div className={styles.assumptionRow}>
            <Field hintPosition="after" id="helper-use" label="Litres per person per day" required>
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={use}
                  onChange={(e) => setUse(e.target.value)}
                />
              )}
            </Field>
            <span>litres / person / day</span>
          </div>
        </section>
        {estimate && (
          <section
            className={`${styles.card} ${styles.estimateResult}`}
            aria-label="Estimated daily water use"
            aria-live="polite"
          >
            <p>Estimated daily water use</p>
            <strong className={styles.estimateValue}>
              {estimate
                ? Number(estimate.dailyDemandLitres).toLocaleString('en-IN', {
                    maximumFractionDigits: 3,
                  })
                : '—'}
            </strong>
            <span>litres / day</span>
            <Badge tone="info">Estimated</Badge>
            <p>Based on your household assumptions.</p>
          </section>
        )}
      </div>
      <div className={styles.formula} aria-live="polite">
        {estimate
          ? `${homes} homes × ${people} residents × ${use} litres = ${estimate.dailyDemandLitres} litres / day`
          : 'Daily use = occupied homes × residents per home × litres per person'}
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onBack}>
          Cancel
        </Button>
        <div className={styles.primaryAction}>
          <Button type="submit" disabled={!estimate || saving} endIcon="arrow-right">
            Accept estimate
          </Button>
        </div>
      </div>
    </form>
  );
}
