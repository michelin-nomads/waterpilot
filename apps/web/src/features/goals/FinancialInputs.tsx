import { Button, Field, Input, Select, Tooltip } from '../../components';
import type { FundingStatus } from '../../graphql/generated/graphql';
import type { DraftErrors, GoalDraft } from './goalDraft';
import styles from './Goals.module.scss';

export function FinancialInputs({
  draft,
  onChange,
  errors,
  fid,
}: {
  draft: GoalDraft;
  onChange: (d: GoalDraft) => void;
  errors: DraftErrors;
  fid: (key: string) => string;
}) {
  const tariffStarted = Boolean(draft.tariffAmount.trim() || draft.tariffLitres.trim());
  const text = (
    key: 'tariffAmount' | 'tariffLitres' | 'tariffCurrency' | 'tariffNote' | 'contingencyPercent',
    label: string,
  ) => (
    <Field
      id={fid(key)}
      label={label}
      error={errors[key]}
      required={tariffStarted && ['tariffAmount', 'tariffCurrency', 'tariffLitres'].includes(key)}
      labelAction={
        key === 'contingencyPercent' ? (
          <Tooltip label="About contingency">
            Extra allowance for unexpected implementation costs. For example, 10% adds 10 to every
            100 of capital cost.
          </Tooltip>
        ) : undefined
      }
    >
      {(p) => (
        <Input
          {...p}
          value={key === 'tariffCurrency' ? draft[key] || draft.currency : draft[key]}
          onChange={(e) => onChange({ ...draft, [key]: e.target.value })}
        />
      )}
    </Field>
  );
  return (
    <div className={styles.stack}>
      <section className={styles.financeSection} aria-label="Water costs">
        <h4>Water costs</h4>
        <div className={styles.grid}>
          {text('tariffAmount', 'Tanker price (currency amount)')}
          {text('tariffCurrency', 'Tanker price currency')}
          {text('tariffLitres', 'Litres purchased for that price')}
          {text('contingencyPercent', 'Contingency (%)')}
        </div>
        {text('tariffNote', 'Tanker price source, date and assumptions')}
      </section>
      <section className={styles.financeSection} aria-label="Funding">
        <div className={styles.fundingHeader}>
          <div>
            <h4>Funding sources</h4>
            <p className={styles.muted}>
              Only approved funding reduces the gap. Expected/proposed amounts are shown separately;
              entering a status does not verify an approval.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            startIcon="plus"
            disabled={draft.funding.length >= 10}
            onClick={() =>
              onChange({
                ...draft,
                funding: [
                  ...draft.funding,
                  { label: '', amount: '', currency: draft.currency, status: 'PROPOSED', note: '' },
                ],
              })
            }
          >
            Add funding source
          </Button>
        </div>
        {draft.funding.map((f, i) => (
          <fieldset key={i} className={styles.estimate}>
            <legend>Funding source {i + 1}</legend>
            <div className={styles.grid}>
              {(['label', 'amount', 'currency', 'note'] as const).map((key) => (
                <Field
                  key={key}
                  id={fid(`funding.${i}.${key}`)}
                  label={
                    {
                      label: 'Funding description',
                      amount: 'Funding amount',
                      currency: 'Funding currency',
                      note: 'Funding evidence and date',
                    }[key]
                  }
                  required={key !== 'note'}
                  error={errors[`funding.${i}.${key}`]}
                >
                  {(p) => (
                    <Input
                      {...p}
                      value={f[key]}
                      onChange={(e) =>
                        onChange({
                          ...draft,
                          funding: draft.funding.map((x, j) =>
                            j === i ? { ...x, [key]: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  )}
                </Field>
              ))}
              <Field id={fid(`funding.${i}.status`)} label="Funding status" required>
                {(p) => (
                  <Select
                    {...p}
                    value={f.status}
                    onChange={(e) =>
                      onChange({
                        ...draft,
                        funding: draft.funding.map((x, j) =>
                          j === i ? { ...x, status: e.target.value as FundingStatus } : x,
                        ),
                      })
                    }
                  >
                    <option value="PROPOSED">Proposed</option>
                    <option value="EXPECTED">Expected</option>
                    <option value="APPROVED">Approved</option>
                  </Select>
                )}
              </Field>
            </div>
            <Button
              variant="ghost"
              size="sm"
              startIcon="minus"
              className={styles.removeAction}
              onClick={() =>
                onChange({ ...draft, funding: draft.funding.filter((_, j) => j !== i) })
              }
            >
              Remove funding source {i + 1}
            </Button>
          </fieldset>
        ))}
      </section>
    </div>
  );
}
