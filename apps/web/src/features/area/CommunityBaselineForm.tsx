import { useState, type FormEvent } from 'react';
import {
  Button,
  Field,
  Input,
  Select,
  Textarea,
  Badge,
  Icon,
  Tooltip,
  Dialog,
} from '../../components';
import type { CommunityBaselineInput } from '../../graphql/generated/graphql';
import { usePlanningSession } from '../../session/sessionContext';
import { WaterSupplyFields, NO_SOURCE_RECORD } from './WaterSupplyFields';
import { CommunityProfile } from './CommunityProfile';
import { DailyUseEstimate } from './DailyUseEstimate';
import { shiftDecimalLeft, shiftDecimalRight } from '../../lib/format';
import styles from './CommunityBaseline.module.scss';

const CONCERNS = [
  'Unreliable water supply',
  'Tanker dependence',
  'High water costs',
  'Groundwater dependence',
  'Seasonal shortages',
];
export function CommunityBaselineForm({
  onReview,
  saving,
  estimating = false,
  onEstimateChange,
}: {
  onReview: (data: CommunityBaselineInput, homes: number | null) => Promise<void>;
  saving: boolean;
  estimating?: boolean;
  onEstimateChange: (open: boolean) => void;
}) {
  const { view } = usePlanningSession();
  const existing =
    view?.communityBaseline?.areaId === view?.areaId ? view?.communityBaseline : null;
  const [data, setData] = useState<CommunityBaselineInput>(
    () =>
      existing ?? {
        areaId: view?.areaId ?? '',
        concern: '',
        notes: '',
        residents: null,
        dailyUse: null,
        demandEstimated: false,
        demandSource: '',
        asOf: new Date().toLocaleDateString('en-CA'),
        supplyComplete: false,
        sources: [],
      },
  );
  const savedHomes = String(view?.siteProfile?.occupiedHomes ?? '');
  const [previousHomes, setPreviousHomes] = useState(savedHomes);
  const [homes, setHomes] = useState(savedHomes);
  if (savedHomes !== previousHomes) {
    setPreviousHomes(savedHomes);
    if (homes === previousHomes) setHomes(savedHomes);
  }
  const [concern, setConcern] = useState(
    existing?.concern ? (CONCERNS.includes(existing.concern) ? existing.concern : 'other') : '',
  );
  const [useUnit, setUseUnit] = useState('L/day');
  const [failure, setFailure] = useState('');
  const edit = (patch: Partial<CommunityBaselineInput>) =>
    setData((current) => ({ ...current, ...patch }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure('');
    try {
      await onReview(
        {
          ...data,
          dailyUse: data.dailyUse?.trim() || null,
          asOf: new Date().toLocaleDateString('en-CA'),
          demandSource: data.dailyUse
            ? data.demandSource ||
              'User-entered daily water use; no supporting record or observation date supplied.'
            : '',
          sources: data.sources.map((source) => ({
            ...source,
            source: source.source.trim() || NO_SOURCE_RECORD,
          })),
        },
        homes ? Number(homes) : null,
      );
    } catch {
      setFailure(
        'Could not save your baseline. Your entries are kept. Check the values and connection, then try again.',
      );
    }
  }
  const showEstimate = (open: boolean) => {
    onEstimateChange(open);
  };

  return (
    <>
      <form
        onSubmit={(event) => void submit(event)}
        onInvalidCapture={(event) => {
          let ancestor = (event.target as HTMLElement).parentElement;
          while (ancestor) {
            if (ancestor.tagName === 'DETAILS') ancestor.setAttribute('open', '');
            ancestor = ancestor.parentElement;
          }
        }}
        className={styles.form}
      >
        <div className={styles.editorLayout}>
          <fieldset disabled={saving} className={styles.fields}>
            <details className={styles.supplyAccordion}>
              <summary className={styles.supplyHeading}>
                <h2 id="community-details-title" className={styles.cardTitle}>
                  <Icon name="users" />
                  Community details
                </h2>
                <Icon name="chevron-down" />
              </summary>
              <div className={styles.sectionBody}>
                <div className={styles.grid}>
                  <CommunityProfile />
                  <Field id="baseline-homes" label="Occupied homes">
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
                  <Field id="baseline-residents" label="Residents">
                    {(p) => (
                      <Input
                        {...p}
                        type="number"
                        min={1}
                        max={100000000}
                        step={1}
                        value={data.residents ?? ''}
                        onChange={(e) =>
                          edit({ residents: e.target.value ? Number(e.target.value) : null })
                        }
                      />
                    )}
                  </Field>
                  <Field id="baseline-concern" label="Primary water concern">
                    {(p) => (
                      <Select
                        {...p}
                        value={concern}
                        onChange={(e) => {
                          setConcern(e.target.value);
                          edit({ concern: e.target.value === 'other' ? '' : e.target.value });
                        }}
                      >
                        <option value="">Not sure yet</option>
                        {CONCERNS.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                        <option value="other">Other — describe your concern</option>
                      </Select>
                    )}
                  </Field>
                  {concern === 'other' && (
                    <Field id="baseline-custom-concern" label="Your water concern" required>
                      {(p) => (
                        <Input
                          {...p}
                          maxLength={500}
                          value={data.concern}
                          onChange={(e) => edit({ concern: e.target.value })}
                        />
                      )}
                    </Field>
                  )}
                </div>
                <Field
                  id="baseline-notes"
                  label="Community notes"
                  labelAction={
                    <Tooltip label="About community notes">
                      Add context that affects water use, such as seasonal shortages, occupancy
                      changes or supply interruptions.
                    </Tooltip>
                  }
                >
                  {(p) => (
                    <Textarea
                      {...p}
                      rows={2}
                      maxLength={1000}
                      value={data.notes}
                      onChange={(e) => edit({ notes: e.target.value })}
                    />
                  )}
                </Field>
              </div>
            </details>
            <details className={styles.supplyAccordion}>
              <summary className={styles.supplyHeading}>
                <h2 id="daily-use-title" className={styles.cardTitle}>
                  <Icon name="droplet" />
                  Daily water use
                </h2>
                {data.dailyUse != null && data.dailyUse !== '' && (
                  <Badge tone="accent">
                    {data.demandEstimated ? 'Estimated' : 'User provided'}
                  </Badge>
                )}
                <Icon name="chevron-down" />
              </summary>
              <div className={styles.sectionBody}>
                <p>
                  Enter your community’s average daily use from a meter or water bill, or estimate
                  it from households.
                </p>
                <div className={styles.dailyEntry}>
                  <Field id="baseline-use" label="Daily water use">
                    {(p) => (
                      <Input
                        {...p}
                        type="number"
                        min="0.001"
                        step="0.001"
                        max="1000000000000"
                        placeholder="Enter daily water use"
                        value={
                          data.dailyUse == null
                            ? ''
                            : useUnit === 'kL/day'
                              ? shiftDecimalLeft(data.dailyUse, 3)
                              : data.dailyUse
                        }
                        onChange={(e) =>
                          edit({
                            dailyUse: e.target.value
                              ? useUnit === 'kL/day'
                                ? shiftDecimalRight(e.target.value, 3)
                                : e.target.value
                              : null,
                            demandEstimated: false,
                            ...(data.demandEstimated ? { demandSource: '' } : {}),
                          })
                        }
                      />
                    )}
                  </Field>
                  <Field id="baseline-use-unit" label="Unit">
                    {(p) => (
                      <Select {...p} value={useUnit} onChange={(e) => setUseUnit(e.target.value)}>
                        <option value="L/day">litres / day</option>
                        <option value="kL/day">kilolitres / day</option>
                      </Select>
                    )}
                  </Field>
                </div>
                <div className={styles.row}>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={data.dailyUse == null}
                      onChange={(e) =>
                        edit({
                          dailyUse: e.target.checked ? null : '',
                          demandEstimated: false,
                          demandSource: '',
                        })
                      }
                    />
                    I don’t know my daily use yet
                  </label>
                  {data.dailyUse == null && (
                    <Button
                      size="sm"
                      variant="secondary"
                      startIcon="chart"
                      onClick={() => showEstimate(true)}
                    >
                      Help me estimate daily use
                    </Button>
                  )}
                </div>
              </div>
            </details>
            <WaterSupplyFields data={data} edit={edit} />
          </fieldset>
        </div>
        {failure && <p role="alert">{failure}</p>}
        <div className={styles.actions}>
          <span>Review demand, supply and any missing information before choosing a goal.</span>
          <Button type="submit" loading={saving} disabled={saving} endIcon="arrow-right">
            Review Baseline
          </Button>
        </div>
      </form>
      <Dialog
        open={estimating}
        onClose={() => showEstimate(false)}
        title="Estimate daily water use"
        description="Calculate daily use from your household assumptions."
        size="lg"
      >
        {estimating && (
          <DailyUseEstimate
            initialHomes={homes}
            saving={saving}
            onBack={() => showEstimate(false)}
            onAccept={(estimate) => {
              setHomes(estimate.homes);
              edit({
                dailyUse: estimate.dailyUse,
                demandEstimated: true,
                residents: estimate.residents,
                demandSource: estimate.source,
              });
              setUseUnit('L/day');
              showEstimate(false);
            }}
          />
        )}
      </Dialog>
    </>
  );
}
