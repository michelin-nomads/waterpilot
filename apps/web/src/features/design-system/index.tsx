import { useId, useRef, useState, type ReactNode } from 'react';

import {
  Accordion,
  Badge,
  BarChart,
  Button,
  Dialog,
  Drawer,
  ChoiceCards,
  EmptyState,
  ErrorState,
  ErrorSummary,
  EvidenceBadge,
  Field,
  Input,
  LineChart,
  LoadingRegion,
  MetricCard,
  Notice,
  PermissionState,
  Select,
  Skeleton,
  StaleBanner,
  StepActions,
  SuggestionChips,
  Tabs,
  Tooltip,
  useToast,
} from '../../components';
import { formatInrPaise, formatMldFromLitresPerDay } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { useDisplayPreferences } from '../../theme/displayPreferencesContext';
import styles from './DesignSystem.module.scss';
import {
  FIXTURE_BAR_CHART,
  FIXTURE_FORMAT_SAMPLES,
  FIXTURE_LINE_CHART,
  FIXTURE_SUGGESTIONS,
} from './fixtures';

const BUDGET_FIELD_ID = 'ds-budget';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Local-only gallery of the shared components with labelled UI fixtures. */
export default function DesignSystemPage() {
  const { preferences, resolvedTheme } = useDisplayPreferences();
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scenario, setScenario] = useState('');
  const [budget, setBudget] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [mode, setMode] = useState<'traditional' | 'assistant' | null>('traditional');
  const dialogConfirmRef = useRef<HTMLButtonElement>(null);
  const budgetError =
    submitted && !budget ? 'Budget: choose a range so plans can be checked against it.' : undefined;
  const formErrors = budgetError ? [{ fieldId: BUDGET_FIELD_ID, message: budgetError }] : [];

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Local development only"
        title="Design system"
        subtitle="Shared components rendered with UI fixtures."
      />
      <p className={styles.fixtureBanner} role="note">
        <strong>UI FIXTURE</strong> — every value on this page is illustrative. None of it is
        WaterPilot data or derived from any source.
      </p>
      <p className={styles.current}>
        Showing the <strong>{resolvedTheme}</strong> theme (preference: {preferences.theme}). Change
        it from Display in the header.
      </p>

      <Section title="Buttons">
        <Button variant="secondary" iconOnly startIcon="edit">
          Edit example
        </Button>
        <div className={styles.row}>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button endIcon="arrow-right">Continue</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Fields and suggestions">
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
          }}
        >
          <ErrorSummary errors={formErrors} />
          <SuggestionChips
            label="Try a suggestion (fills the field; runs nothing)"
            suggestions={FIXTURE_SUGGESTIONS}
            onSelect={setScenario}
          />
          <Field
            label="Describe a scenario"
            hint="Suggestions only fill this field. You can edit it before using it."
          >
            {(control) => (
              <Input {...control} value={scenario} onChange={(e) => setScenario(e.target.value)} />
            )}
          </Field>
          <Field id={BUDGET_FIELD_ID} label="Budget" required error={budgetError}>
            {(control) => (
              <Select {...control} value={budget} onChange={(e) => setBudget(e.target.value)}>
                <option value="">Select…</option>
                <option value="500000">Up to ₹5 lakh</option>
                <option value="1000000">Up to ₹10 lakh</option>
              </Select>
            )}
          </Field>
          <div>
            <Button type="submit">Validate</Button>
          </div>
        </form>
      </Section>

      <Section title="Choice cards and step actions">
        <ChoiceCards
          legend="How do you want to plan?"
          hint="You can switch at any time; both use the same session."
          value={mode}
          onChange={setMode}
          options={[
            {
              value: 'traditional',
              title: 'Traditional',
              icon: 'list',
              description: 'Work through each step yourself.',
            },
            {
              value: 'assistant',
              title: 'With the assistant',
              icon: 'sparkle',
              description:
                'Ask questions and let the assistant fill in the same steps. Every number still comes from the same calculations.',
              disabledReason: 'The assistant is not connected in this build.',
            },
          ]}
        />
        <StepActions
          back={<Button variant="ghost">Back</Button>}
          secondary={<Button variant="secondary">View details</Button>}
          primary={<Button endIcon="arrow-right">Continue</Button>}
          note={<p>One primary action per step, placed at the foot of the result it acts on.</p>}
        />
      </Section>

      <Section title="Metric cards">
        <div className={styles.grid}>
          <MetricCard
            label="Example rate"
            icon="droplet"
            metric={{
              availability: 'available',
              value: formatMldFromLitresPerDay(FIXTURE_FORMAT_SAMPLES.litresPerDay),
              caption: 'Formatted from canonical L/day',
            }}
            evidence="synthetic"
            definition="Demonstrates the card layout. Values come from labelled UI fixtures."
            delta={{ text: '−0.2 MLD vs example baseline', sentiment: 'improves' }}
          />
          <MetricCard
            label="Example cost"
            icon="chart"
            tone="info"
            metric={{
              availability: 'provisional',
              value: formatInrPaise(FIXTURE_FORMAT_SAMPLES.paise, 'compact'),
              caption: `Exact: ${formatInrPaise(FIXTURE_FORMAT_SAMPLES.paise)}`,
            }}
            evidence="synthetic"
          />
          <MetricCard
            label="Water quality"
            icon="alert"
            tone="warning"
            metric={{
              availability: 'unavailable',
              reason: 'Needs local measurements; none are recorded for this example.',
            }}
            definition="Water quality cannot be inferred from imagery alone."
          />
        </div>
      </Section>

      <Section title="Badges and tooltip">
        <div className={styles.row}>
          <Badge tone="accent">Recommended</Badge>
          <Badge tone="success">Eligible</Badge>
          <Badge tone="warning">Needs verification</Badge>
          <Badge tone="danger">Expired</Badge>
          <Badge tone="info">Open now</Badge>
          <EvidenceBadge quality="validated" />
          <EvidenceBadge quality="synthetic" />
          <span className={styles.inline}>
            Shortage days{' '}
            <Tooltip label="About shortage days">
              Count of days in the window where supply was below demand.
            </Tooltip>
          </span>
        </div>
      </Section>

      <Section title="Accordion">
        <Accordion
          numbered
          defaultExpanded={['funding']}
          items={[
            {
              id: 'included',
              icon: 'list',
              title: "What's included",
              summary: 'Interventions in the plan',
              content: <p>Example content.</p>,
            },
            {
              id: 'funding',
              icon: 'chart',
              title: 'Funding options',
              summary: 'Schemes from a curated catalogue',
              content: <p>Example content shown expanded.</p>,
            },
            {
              id: 'assumptions',
              icon: 'info',
              title: 'Assumptions & confidence',
              content: <p>Example content.</p>,
            },
          ]}
        />
      </Section>

      <Section title="Tabs">
        <Tabs
          label="Example details"
          items={[
            { id: 'summary', label: 'Summary', content: <p>Summary panel (UI fixture).</p> },
            {
              id: 'sources',
              label: 'Data sources',
              content: <p>Data sources panel (UI fixture).</p>,
            },
            {
              id: 'assumptions',
              label: 'Assumptions',
              content: <p>Assumptions panel (UI fixture).</p>,
            },
          ]}
        />
      </Section>

      <Section title="Dialog, drawer and toasts">
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            Open drawer
          </Button>
          <Button
            variant="ghost"
            onClick={() => toast.show({ message: 'Example saved (UI fixture).', tone: 'success' })}
          >
            Success toast
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              toast.show({
                message:
                  'Example failure: the request timed out. Check your connection and try again.',
                tone: 'error',
                action: {
                  label: 'Retry',
                  onAction: () => toast.show({ message: 'Retry requested (UI fixture).' }),
                },
              })
            }
          >
            Error toast
          </Button>
        </div>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Example dialog"
          description="Focus is trapped here. Escape or Close returns focus to the button that opened it."
          initialFocusRef={dialogConfirmRef}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button ref={dialogConfirmRef} onClick={() => setDialogOpen(false)}>
                Confirm
              </Button>
            </>
          }
        >
          <Field label="Example field in a dialog">{(control) => <Input {...control} />}</Field>
        </Dialog>
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Example drawer"
          description="Side sheet for details such as a funding source."
        >
          <p>Drawer content (UI fixture).</p>
        </Drawer>
      </Section>

      <Section title="Loading, empty, stale, permission and error states">
        <div className={styles.grid}>
          <LoadingRegion label="Loading example profile">
            <Skeleton shape="title" width="half" />
            <Skeleton />
            <Skeleton width="three-quarters" />
            <Skeleton shape="block" />
          </LoadingRegion>
          <EmptyState title="No plans yet" headingLevel={3}>
            <p>Set a goal first; plans are calculated from it.</p>
          </EmptyState>
          <PermissionState headingLevel={3}>
            <p>
              Only community coordinators can finalize reports. Ask a coordinator, or start your own
              session.
            </p>
          </PermissionState>
          <ErrorState
            headingLevel={3}
            requestId="req-example-0001"
            onRetry={() => toast.show({ message: 'Retry requested (UI fixture).' })}
          >
            <p>The example service did not respond. Your inputs are kept; try again.</p>
          </ErrorState>
        </div>
        <StaleBanner onRefresh={() => toast.show({ message: 'Refresh requested (UI fixture).' })}>
          Showing example results from an earlier calculation; inputs have changed since.
        </StaleBanner>
      </Section>

      <Section title="Notices (state catalogue)">
        <div className={styles.stack}>
          <Notice kind="partial" title="2 of 4 measures are available here" announce={false}>
            The others need sources that are not yet available for this example location.
          </Notice>
          <Notice kind="offline" title="You're offline" announce={false}>
            What&apos;s on screen stays available. Actions that need the server are paused until the
            connection returns.
          </Notice>
          <Notice
            kind="auth-cancelled"
            announce={false}
            action={
              <Button variant="secondary" size="sm">
                Try again
              </Button>
            }
          >
            Sign-in was cancelled. Nothing was finalized and your session is unchanged.
          </Notice>
          <Notice kind="archived" announce={false}>
            This example community is archived. You can read its reports; joining and new plans are
            closed.
          </Notice>
          <Notice
            kind="budget"
            title="Assistant paused"
            announce={false}
            action={
              <Button variant="secondary" size="sm" startIcon="list">
                Use Traditional mode
              </Button>
            }
          >
            The assistant has reached today&apos;s usage limit. Traditional mode and every
            calculation keep working.
          </Notice>
          <Notice kind="restored" announce={false}>
            Restored your example session from 11:42.
          </Notice>
        </div>
      </Section>

      <Section title="Charts with table alternatives">
        <div className={styles.grid2}>
          <BarChart data={FIXTURE_BAR_CHART} />
          <LineChart data={FIXTURE_LINE_CHART} includeZero={false} />
        </div>
      </Section>
    </div>
  );
}
