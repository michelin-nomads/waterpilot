import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, ErrorSummary, Field, Input, Notice, StepActions } from '../../components';
import { MutationFailure, newIdempotencyKey, unwrapPayload } from '../../graphql/client';
import {
  RecordManualInputDocument,
  type RecordManualInputInput,
} from '../../graphql/generated/graphql';
import { useGraphQLMutation } from '../../graphql/hooks';
import { usePlanningSession } from '../../session/sessionContext';
import { calculatePopulationEstimate } from './populationEstimateMath';
import styles from './PopulationEstimate.module.scss';

interface Props {
  sessionId: string;
}

function today(): string {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function PopulationEstimateHelper({ sessionId }: Props) {
  const navigate = useNavigate();
  const { coordinator } = usePlanningSession();
  const mutation = useGraphQLMutation('recordManualInput', RecordManualInputDocument);
  const [homes, setHomes] = useState('');
  const [residentsPerHome, setResidentsPerHome] = useState('');
  const [litresPerPerson, setLitresPerPerson] = useState('');
  const [asOf, setAsOf] = useState(today);
  const [source, setSource] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const ids = {
    homes: 'estimate-homes',
    residents: 'estimate-residents',
    need: 'estimate-need',
    date: 'estimate-date',
    source: 'estimate-source',
  };
  const estimate = calculatePopulationEstimate(homes, residentsPerHome, litresPerPerson);
  const intent = useRef<{ signature: string; populationKey: string; needKey: string } | null>(null);
  const homesError =
    attempted &&
    (!/^\d{1,8}$/.test(homes.trim()) || Number(homes) < 1 || Number(homes) > 10_000_000)
      ? 'Enter at least one occupied home as a whole number.'
      : null;
  const residentValueValid =
    /^\d+(?:\.\d{1,3})?$/.test(residentsPerHome.trim()) && Number(residentsPerHome) > 0;
  const useValueValid =
    /^\d+(?:\.\d{1,3})?$/.test(litresPerPerson.trim()) && Number(litresPerPerson) > 0;
  const residentsError =
    attempted &&
    (!residentValueValid || (residentValueValid && useValueValid && !homesError && !estimate))
      ? 'Enter residents per occupied home; the resulting population must be a whole number.'
      : null;
  const needError =
    attempted && !useValueValid ? 'Enter a daily water need greater than zero.' : null;
  const dateError = attempted && !asOf ? 'Enter the date these assumptions describe.' : null;
  const sourceError =
    attempted && source.trim().length < 3 ? 'Describe the source or assumption.' : null;
  const fieldErrors = [
    homesError && { fieldId: ids.homes, message: homesError },
    residentsError && { fieldId: ids.residents, message: residentsError },
    needError && { fieldId: ids.need, message: needError },
    dateError && { fieldId: ids.date, message: dateError },
    sourceError && { fieldId: ids.source, message: sourceError },
  ].filter((error): error is { fieldId: string; message: string } => Boolean(error));

  const setValue = (setter: (value: string) => void) => (value: string) => {
    intent.current = null;
    setFailure(null);
    setter(value);
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    setFailure(null);
    if (!estimate || !asOf || source.trim().length < 3) return;
    const signature = JSON.stringify([
      homes,
      residentsPerHome,
      litresPerPerson,
      asOf,
      source.trim(),
    ]);
    if (intent.current?.signature !== signature) {
      intent.current = {
        signature,
        populationKey: newIdempotencyKey(),
        needKey: newIdempotencyKey(),
      };
    }
    const note = `Estimate from ${source.trim()}; ${homes} occupied homes × ${residentsPerHome} residents/home; ${litresPerPerson} L/person/day; estimated demand ${estimate.dailyDemandLitres} L/day.`;
    try {
      const populationInput: RecordManualInputInput = {
        sessionId,
        input: 'POPULATION',
        value: estimate.population,
        unit: 'COUNT',
        asOf,
        note,
        idempotencyKey: intent.current.populationKey,
      };
      const populationResult = await mutation.mutateAsync(populationInput);
      unwrapPayload(populationResult.recordManualInput);
      const needInput: RecordManualInputInput = {
        sessionId,
        input: 'PER_CAPITA_STANDARD',
        value: litresPerPerson.trim(),
        unit: 'LITRES_PER_DAY',
        asOf,
        note,
        idempotencyKey: intent.current.needKey,
      };
      const needResult = await mutation.mutateAsync(needInput);
      unwrapPayload(needResult.recordManualInput);
      intent.current = null;
      void coordinator?.refresh();
      navigate('/baseline');
    } catch (error) {
      setFailure(
        error instanceof MutationFailure
          ? error.message
          : 'Could not save the estimate. Retry to finish with the same safe request keys.',
      );
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void save(event)} noValidate>
      <Notice kind="caution" title="This is an estimate, not a measurement" announce={false}>
        WaterLens will label the accepted values as estimates based on your assumptions. Nothing is
        inferred from the PDF examples or from the location alone.
      </Notice>
      <div className={styles.fields}>
        <Field
          id={ids.homes}
          label="Occupied homes"
          hint="Whole homes receiving water."
          error={homesError}
          required
        >
          {(props) => (
            <Input
              {...props}
              maxLength={8}
              inputMode="numeric"
              value={homes}
              onChange={(event) => setValue(setHomes)(event.target.value)}
            />
          )}
        </Field>
        <Field
          id={ids.residents}
          label="Residents per occupied home"
          hint="Your average assumption; up to three decimal places."
          error={residentsError}
          required
        >
          {(props) => (
            <Input
              {...props}
              maxLength={12}
              inputMode="decimal"
              value={residentsPerHome}
              onChange={(event) => setValue(setResidentsPerHome)(event.target.value)}
            />
          )}
        </Field>
        <Field
          id={ids.need}
          label="Daily use per person (L/day)"
          hint="Use a documented standard or your own stated assumption."
          error={needError}
          required
        >
          {(props) => (
            <Input
              {...props}
              maxLength={12}
              inputMode="decimal"
              value={litresPerPerson}
              onChange={(event) => setValue(setLitresPerPerson)(event.target.value)}
            />
          )}
        </Field>
        <Field id={ids.date} label="As of" error={dateError} required>
          {(props) => (
            <Input
              {...props}
              type="date"
              max={today()}
              value={asOf}
              onChange={(event) => setValue(setAsOf)(event.target.value)}
            />
          )}
        </Field>
      </div>
      <Field
        id={ids.source}
        label="Source and assumptions"
        hint="For example, a housing register plus a published occupancy assumption."
        error={sourceError}
        required
      >
        {(props) => (
          <Input
            {...props}
            maxLength={500}
            value={source}
            onChange={(event) => setValue(setSource)(event.target.value)}
          />
        )}
      </Field>
      <details className={styles.method}>
        <summary>How calculated</summary>
        <p>
          Estimated population = occupied homes × residents per home. Estimated daily domestic
          demand = population × daily use per person.
        </p>
        <p>
          Fractional people are rejected rather than rounded. The estimate excludes non-domestic
          demand and does not establish water availability or catchment conditions.
        </p>
      </details>
      {estimate && (
        <section
          className={styles.result}
          aria-live="polite"
          aria-label="Estimated baseline result"
        >
          <h2>Estimated daily demand</h2>
          <p>
            <strong>{estimate.population}</strong> people ·{' '}
            <strong>{estimate.dailyDemandLitres}</strong> L/day
          </p>
          <p>Based on the assumptions above. It is not measured data.</p>
        </section>
      )}
      <ErrorSummary errors={fieldErrors} />
      {failure && (
        <p role="alert" className={styles.error}>
          {failure}
        </p>
      )}
      <StepActions
        secondary={
          <Button
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => navigate('/baseline')}
          >
            Back
          </Button>
        }
        primary={
          <Button
            type="submit"
            disabled={!estimate || mutation.isPending}
            loading={mutation.isPending}
          >
            Accept estimate
          </Button>
        }
      />
    </form>
  );
}
