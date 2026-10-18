import { useEffect, useMemo, useState } from 'react';

import {
  Button,
  ButtonLink,
  Icon,
} from '../../components';
import {
  AreaLocationDocument,
  PlanComparisonDocument,
} from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { usePlanningSession } from '../../session/sessionContext';
import type { SessionState } from '../../session/sessionState';
import { StagePage } from '../planning/StagePage';
import { createFeasibleComparison } from '../plans/feasibleComparisonFallback';
import styles from './Matches.module.scss';

import { exportProposalPDF, exportProposalWord } from './proposalExport';
import { apiClient } from '../../lib/apiClient';
import { env } from '../../config/env';

export interface SchemeData {
  id: string;
  name: string;
  funder: string;
  kind: 'Government' | 'Corporate / CSR' | 'Foundation';
  icon: 'bank' | 'leaf' | 'users';
  amount: string;
  maxAmountNum: number;
  status: 'Meets listed rules' | 'Needs information';
  tone: 'green' | 'amber';
  why: string;
  checked: string;
  window: string;
  eligible: boolean;
  checks: [string, string][];
  sourceUrl?: string;
  officialSource?: boolean;
}

export default function FundingPage() {
  const { state } = usePlanningSession();
  const session = state.server;
  const sessionId = session?.id ?? '';

  const [screen, setScreen] = useState<'discover' | 'proposal' | 'ready'>('discover');
  const [filter, setFilter] = useState<'All sources' | 'Government' | 'Corporate / CSR' | 'Foundation'>('All sources');
  const [applicantType, setApplicantType] = useState('Registered resident association');
  const [showApplicantEdit, setShowApplicantEdit] = useState(false);
  const [showGoalContext, setShowGoalContext] = useState(false);
  const [showQuoteEdit, setShowQuoteEdit] = useState(false);
  const [customQuote, setCustomQuote] = useState<string>('');
  const [customOwnContribution, setCustomOwnContribution] = useState<number | null>(null);
  const [showOwnEdit, setShowOwnEdit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingSchemes, setLoadingSchemes] = useState(true);
  const [schemesError, setSchemesError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  // Dynamic public schemes state (loaded exclusively via public API endpoint)
  const [schemes, setSchemes] = useState<SchemeData[]>([]);

  // Drawer & Selection state
  const [drawerScheme, setDrawerScheme] = useState<SchemeData | null>(null);
  const [selectedScheme, setSelectedScheme] = useState<SchemeData | null>(null);
  const [customRequestedAmount, setCustomRequestedAmount] = useState<number | null>(null);

  // Proposal state
  const [applicantName, setApplicantName] = useState('Parkway Homes Residents Association');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [projectTitle, setProjectTitle] = useState('Community rainwater harvesting & recharge at Parkway Homes');
  const [funderNotes, setFunderNotes] = useState('');
  const [reviewedCheck, setReviewedCheck] = useState(true);

  // Fetch schemes dynamically from the public API endpoint
  const loadSchemesFromPublicApi = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoadingSchemes(true);
      setSchemesError(null);

      let data: SchemeData[] | null = null;
      try {
        const response = await apiClient.get<SchemeData[]>('/v1/public/funding-schemes', {
          headers: { Accept: 'application/json' },
          params: isManual ? { t: Date.now() } : undefined,
        });
        data = response.data;
      } catch (clientErr) {
        // Fallback directly to the public API URL if needed
        const apiUrl = env.apiBaseUrl
          ? `${env.apiBaseUrl}/v1/public/funding-schemes`
          : 'https://waterpilot-api-572852178137.asia-south1.run.app/v1/public/funding-schemes';
        const res = await fetch(`${apiUrl}${isManual ? `?t=${Date.now()}` : ''}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw clientErr;
        data = await res.json();
      }

      if (Array.isArray(data) && data.length > 0) {
        setSchemes(data);
        setSelectedScheme((prev) => {
          if (prev) {
            const matched = data!.find((d) => d.id === prev.id);
            return matched ?? data![0] ?? null;
          }
          return data![0] ?? null;
        });
        setLastRefreshedAt(
          new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        );
      } else {
        throw new Error('No schemes returned by the public registry API.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to public funding API';
      setSchemesError(msg);
      console.warn('Funding schemes public API error:', err);
    } finally {
      setLoadingSchemes(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSchemesFromPublicApi(false);
  }, []);

  // Retrieve selected plan data from GraphQL comparison or localStorage
  const comparisonQuery = useGraphQLQuery(
    queryKeys.sessions.planComparison(sessionId, session?.inputsRevision ?? 1),
    PlanComparisonDocument,
    { id: sessionId },
    { enabled: Boolean(sessionId) },
  );

  const rawComparison = comparisonQuery.data?.planningSession?.planComparison ?? null;
  const fallbackSession: SessionState = {
    id: sessionId,
    version: 1,
    inputsRevision: 1,
    status: 'ACTIVE',
    stage: 'MAKE_IT_HAPPEN',
    mode: 'TRADITIONAL',
    areaId: null,
    goal: null,
    scenario: null,
    selectedPlanOptionId: null,
    baselineReviewed: false,
    siteProfile: null,
    communityId: null,
    areaName: null,
    updatedAt: new Date().toISOString(),
  };

  const comp = useMemo(() => {
    let effectiveGoal = session?.goal;
    try {
      const stored = localStorage.getItem(`waterpilot_goal_${sessionId}`);
      if (stored) {
        effectiveGoal = { ...(session?.goal ?? {}), ...JSON.parse(stored) };
      }
    } catch {}
    const activeSession = session
      ? { ...session, goal: effectiveGoal ?? null }
      : { ...fallbackSession, goal: effectiveGoal ?? null };
    return createFeasibleComparison(rawComparison, activeSession);
  }, [rawComparison, session, sessionId]);

  const storedOptionId = useMemo(() => {
    try {
      return localStorage.getItem(`waterpilot_selected_plan_${sessionId}`);
    } catch {
      return null;
    }
  }, [sessionId]);

  const effectiveOptionId = session?.selectedPlanOptionId ?? storedOptionId ?? comp?.options[0]?.id;

  const storedOptionData = useMemo(() => {
    try {
      const raw = localStorage.getItem(`waterpilot_selected_option_${sessionId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }, [sessionId]);

  const activePlan = useMemo(() => {
    return comp?.options.find((o) => o.id === effectiveOptionId) ?? storedOptionData ?? comp?.options[0] ?? null;
  }, [comp, effectiveOptionId, storedOptionData]);

  // Area Location resolution
  const areaQuery = useGraphQLQuery(
    queryKeys.areas.detail(session?.areaId ?? ''),
    AreaLocationDocument,
    { id: session?.areaId ?? '' },
    { enabled: Boolean(session?.areaId) },
  );
  const locationName = areaQuery.data?.area?.name ?? session?.areaName ?? 'Parkway Homes, Bengaluru';

  useEffect(() => {
    if (locationName && locationName !== 'Parkway Homes, Bengaluru') {
      setApplicantName((prev) => (prev === 'Parkway Homes Residents Association' ? `${locationName} Residents Association` : prev));
      setProjectTitle((prev) => (prev.includes('Parkway Homes') ? `Community water security & recharge at ${locationName}` : prev));
    }
  }, [locationName]);

  // Cost calculation
  const planCostNum = useMemo(() => {
    if (customQuote && !Number.isNaN(Number(customQuote)) && Number(customQuote) > 0) {
      return Number(customQuote);
    }
    if (activePlan?.cost?.high?.minorUnits) {
      return Math.round(Number(activePlan.cost.high.minorUnits) / 100);
    }
    return 740000;
  }, [activePlan, customQuote]);

  // Proportional funding calculations
  const defaultOwn = useMemo(() => Math.round(planCostNum * 0.3), [planCostNum]);
  const ownContribution = customOwnContribution ?? defaultOwn;

  const defaultGrant = useMemo(() => {
    const maxGrant = selectedScheme?.maxAmountNum ?? 300000;
    const remainingNeeded = Math.max(0, planCostNum - ownContribution);
    return Math.min(maxGrant, Math.round(remainingNeeded * 0.7));
  }, [planCostNum, ownContribution, selectedScheme]);

  const requestedAmount = customRequestedAmount ?? defaultGrant;

  const gapToArrange = Math.max(0, planCostNum - ownContribution - (selectedScheme ? requestedAmount : 0));
  const planCostLakh = (planCostNum / 100000).toFixed(1);
  const ownContributionLakh = (ownContribution / 100000).toFixed(1);
  const gapLakh = (gapToArrange / 100000).toFixed(1);

  // Timeline days resolution
  const planDaysText = useMemo(() => {
    if (activePlan?.buildDays?.low && activePlan?.buildDays?.high) {
      return `${activePlan.buildDays.low}–${activePlan.buildDays.high} days`;
    }
    if (activePlan?.name === 'Lower cost plan') return '30–45 days';
    if (activePlan?.name === 'Higher impact plan') return '60–90 days';
    return '45–60 days';
  }, [activePlan]);

  // Goal & Baseline resolution
  const targetDays = session?.goal?.target?.quantity?.value ?? comp?.targetLevel?.value ?? '56';
  const baselineDays = comp?.baselineValue?.value ?? '74';
  const goalSummaryText =
    session?.goal?.kind === 'REDUCE_TANKER_DEPENDENCE'
      ? 'Reduce tanker dependence'
      : session?.goal?.kind === 'IMPROVE_GROUNDWATER'
        ? 'Improve groundwater levels'
        : 'Reduce water shortage';

  // Percentages for meter
  const ownPct = Math.min(100, Math.round((ownContribution / planCostNum) * 100));
  const grantPct = selectedScheme ? Math.min(100 - ownPct, Math.round((requestedAmount / planCostNum) * 100)) : 0;

  const filteredSchemes = useMemo(() => {
    if (filter === 'All sources') return schemes;
    return schemes.filter((s) => s.kind === filter);
  }, [filter, schemes]);

  const handleRefresh = () => {
    loadSchemesFromPublicApi(true);
  };

  const downloadProposal = (type: 'pdf' | 'docx') => {
    const exportData = {
      projectTitle,
      applicantName,
      applicantType,
      contactPerson,
      contactEmail,
      locationName,
      schemeName: selectedScheme?.name ?? 'Municipal water conservation grant',
      funderName: selectedScheme?.funder ?? 'City Water Supply & Sewerage Board',
      schemeSourceUrl: selectedScheme?.sourceUrl,
      planName: activePlan?.name ?? 'Balanced plan',
      planMeasures: activePlan?.measures?.map((m: { name: string }) => m.name) ?? [],
      planDaysText,
      planCostNum,
      requestedAmount,
      ownContribution,
      gapToArrange,
      targetDays,
      baselineDays,
      goalSummaryText,
      funderNotes,
    };

    if (type === 'pdf') {
      exportProposalPDF(exportData);
    } else {
      exportProposalWord(exportData);
    }
  };

  return (
    <StagePage
      stageId="funding"
      title="Make it Happen"
      subtitle="Find funding that fits your plan. Turn the right opportunity into a ready-to-send proposal."
      actions={
        screen === 'discover' ? (
          <Button
            variant="secondary"
            startIcon="refresh"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing sources…' : 'Refresh funding'}
          </Button>
        ) : undefined
      }
    >
      <div className={styles.workspace}>

        {/* Selected Plan Summary Banner */}
        <section className={styles.planCard} aria-labelledby="plan-banner-title">
          <div className={styles.planCardGrid}>
            <div className={styles.planCardCol}>
              <span className={styles.planLabel}>Selected plan · {locationName}</span>
              <h3 id="plan-banner-title" className={styles.planTitle}>
                {activePlan?.name ?? 'Balanced plan'}
              </h3>
              <p className={styles.planMeasures}>
                {activePlan?.measures?.map((m: { name: string }) => m.name).join(' · ') ??
                  'Rainwater harvesting · Leak detection & repair'}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowGoalContext(!showGoalContext)}
              >
                {showGoalContext ? 'Hide goal & baseline' : 'View goal & baseline'}
              </Button>
              {showGoalContext && (
                <div className={styles.noteBox}>
                  <strong>Goal:</strong> {goalSummaryText} to ≤ {targetDays} days/year.
                  <br />
                  <strong>Saved baseline:</strong> {baselineDays} days/year dependence.
                </div>
              )}
            </div>

            <div className={styles.planCardCol}>
              <span className={styles.planLabel}>Estimated implementation cost</span>
              <div className={styles.planAmount}>₹{planCostLakh} lakh</div>
              <p className={styles.planMeasures}>
                From selected plan · {planDaysText}
              </p>
            </div>

            <div className={styles.planCardCol}>
              <span className={styles.planLabel}>Your cost estimate</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong style={{ fontSize: '0.9rem' }}>
                  {customQuote ? `₹${(Number(customQuote) / 100000).toFixed(1)} lakh (quote)` : 'Use plan estimate'}
                </strong>
                <button
                  type="button"
                  className={[styles.pencilBtn, showQuoteEdit && styles.active].filter(Boolean).join(' ')}
                  onClick={() => setShowQuoteEdit(!showQuoteEdit)}
                  title={showQuoteEdit ? 'Cancel cost editing' : 'Edit contractor quote'}
                  aria-label={showQuoteEdit ? 'Cancel cost editing' : 'Edit contractor quote'}
                >
                  <Icon name={showQuoteEdit ? 'close' : 'pencil'} size="sm" />
                </button>
              </div>
              {showQuoteEdit && (
                <div style={{ marginTop: '0.4rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <input
                      type="number"
                      aria-label="Enter project cost in INR"
                      value={customQuote}
                      onChange={(e) => setCustomQuote(e.target.value)}
                      placeholder="Enter amount in INR"
                      className={styles.customInput}
                      autoFocus
                    />
                    <button
                      type="button"
                      className={styles.pencilBtn}
                      onClick={() => setShowQuoteEdit(false)}
                      title="Done"
                      aria-label="Done editing cost estimate"
                    >
                      <Icon name="check" size="sm" />
                    </button>
                  </div>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem', color: 'var(--wp-color-text-muted)' }}>
                    Updating cost will recheck funding eligibility.
                  </p>
                </div>
              )}
              <p className={styles.planMeasures} style={{ marginTop: '0.2rem' }}>
                Replace with contractor quote when available.
              </p>
            </div>
          </div>
        </section>

        {/* Selected Scheme Notification Banner if on discover */}
        {screen === 'discover' && selectedScheme && (
          <div className={styles.noteBox} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Selected:</strong> {selectedScheme.name} · Planned request ₹{(requestedAmount / 100000).toFixed(1)} lakh · Approval pending.
            </div>
            <Button variant="primary" onClick={() => setScreen('proposal')}>
              Prepare proposal draft
            </Button>
          </div>
        )}

        {/* SCREEN 1: DISCOVER FUNDING */}
        {screen === 'discover' && (
          <div className={styles.layoutGrid}>
            <div className={styles.mainCol}>
              <div className={styles.sectionHead}>
                <div>
                  <h2>Funding opportunities</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span className={styles.registryBadge}>
                      <span className={styles.liveDot} />
                      Public Data API · Verified Registry {lastRefreshedAt ? `· Checked ${lastRefreshedAt}` : ''}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--wp-color-text-muted)' }}>
                  {filteredSchemes.length} sources found · Ranked for your selected plan
                </span>
              </div>

              <div className={styles.applicantBar}>
                <span>Matching for: <strong>{applicantType}</strong></span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowApplicantEdit(!showApplicantEdit)}
                >
                  {showApplicantEdit ? 'Close' : 'Edit applicant'}
                </Button>
              </div>

              {showApplicantEdit && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <select
                    value={applicantType}
                    onChange={(e) => setApplicantType(e.target.value)}
                    className={styles.customSelect}
                  >
                    <option>Registered resident association</option>
                    <option>Local government / ward committee</option>
                    <option>Nonprofit organization</option>
                    <option>Not sure yet</option>
                  </select>
                </div>
              )}

              {/* Category Filter Tabs */}
              <div className={styles.tabsRow}>
                {(['All sources', 'Government', 'Corporate / CSR', 'Foundation'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`${styles.tabBtn} ${filter === t ? styles.tabBtnActive : ''}`}
                    onClick={() => setFilter(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Opportunity Cards List */}
              <div className={styles.schemesStack}>
                {loadingSchemes ? (
                  <div className={styles.loadingState}>
                    <Icon name="refresh" size="md" />
                    <span>Fetching verified opportunities from public registry API...</span>
                  </div>
                ) : schemesError && schemes.length === 0 ? (
                  <div className={styles.loadingState}>
                    <p style={{ color: 'var(--wp-color-warn, #b45309)', margin: '0 0 0.5rem' }}>{schemesError}</p>
                    <Button variant="secondary" size="sm" onClick={() => loadSchemesFromPublicApi(true)}>
                      Retry loading schemes
                    </Button>
                  </div>
                ) : filteredSchemes.length === 0 ? (
                  <div className={styles.loadingState}>
                    <p>No funding schemes found for category &ldquo;{filter}&rdquo;.</p>
                    <Button variant="secondary" size="sm" onClick={() => setFilter('All sources')}>
                      Show all sources
                    </Button>
                  </div>
                ) : (
                  filteredSchemes.map((s) => (
                    <article key={s.id} className={styles.fundCard}>
                      <div className={styles.fundCardHead}>
                        <div className={styles.fundTile}>
                          <Icon name={s.icon === 'bank' ? 'building' : s.icon === 'leaf' ? 'droplet' : 'users'} size="md" />
                        </div>
                        <div className={styles.fundTitles}>
                          <h3>{s.name}</h3>
                          <p>{s.funder} · {s.kind}</p>
                        </div>
                        <span className={`${styles.fundStatusPill} ${s.tone === 'green' ? styles.pillGreen : styles.pillAmber}`}>
                          {s.status}
                        </span>
                      </div>

                      <p className={styles.fundWhy}>
                        <strong>Why it fits:</strong> {s.why}
                      </p>

                      <div className={styles.fundBottom}>
                        <div>
                          <div className={styles.fundAmount}>{s.amount}</div>
                          <div className={styles.fundSubCheck}>{s.checked}</div>
                          {s.sourceUrl && (
                            <div style={{ marginTop: '0.35rem' }}>
                              <a
                                href={s.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.linkBtn}
                              >
                                Official portal <Icon name="external" size="sm" />
                              </a>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setDrawerScheme(s);
                            setSelectedScheme(s);
                          }}
                        >
                          View details <Icon name="chevron-right" size="sm" />
                        </Button>
                      </div>

                      <div className={styles.fundMeta}>
                        {s.window} · Publisher source verified
                      </div>
                    </article>
                  ))
                )}
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--wp-color-text-muted)', marginTop: '0.5rem' }}>
                Source checks shown on each scheme. Closed or incompatible schemes are excluded.
              </p>
            </div>

            {/* Aside: Funding Picture */}
            <aside className={styles.asideCol}>
              <section className={`${styles.pictureCard} ${styles.pictureCardAccent}`}>
                <div className={styles.eyebrow}>Your funding picture</div>
                <div className={styles.pictureAmount}>
                  {gapToArrange === 0 ? '₹0.0 lakh to arrange · Fully funded' : `₹${gapLakh} lakh to arrange`}
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--wp-color-text-muted)' }}>
                  {gapToArrange === 0
                    ? 'Project cost is fully covered by own contribution and requested grant.'
                    : `₹${planCostLakh} lakh cost − ₹${ownContributionLakh} lakh planned own contribution − ₹${(requestedAmount / 100000).toFixed(1)} lakh grant`}
                </p>

                <div className={styles.meterBar} aria-hidden="true">
                  <span className={styles.meterOwn} style={{ width: `${ownPct}%` }} title="Own contribution" />
                  {grantPct > 0 && (
                    <span className={styles.meterRequest} style={{ width: `${grantPct}%` }} title="Requested grant" />
                  )}
                  <span className={styles.meterGap} title="Balance to arrange" />
                </div>

                <div className={styles.legendList}>
                  <div className={styles.legendRow}>
                    <span>Project cost:</span>
                    <strong>₹{planCostLakh} lakh</strong>
                  </div>
                  <div className={styles.legendRow}>
                    <span>
                      <span className={styles.swatch} style={{ background: 'var(--wp-color-accent)' }} />
                      Own contribution:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <strong>₹{ownContributionLakh} lakh</strong>
                      <button
                        type="button"
                        className={[styles.pencilBtn, showOwnEdit && styles.active].filter(Boolean).join(' ')}
                        onClick={() => setShowOwnEdit(!showOwnEdit)}
                        title={showOwnEdit ? 'Close editor' : 'Edit own contribution'}
                        aria-label={showOwnEdit ? 'Close editor' : 'Edit own contribution'}
                      >
                        <Icon name={showOwnEdit ? 'close' : 'pencil'} size="sm" />
                      </button>
                    </div>
                  </div>
                  {showOwnEdit && (
                    <div style={{ margin: '0.35rem 0', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        step="10000"
                        min="0"
                        max={planCostNum}
                        value={ownContribution}
                        onChange={(e) => setCustomOwnContribution(Number(e.target.value))}
                        className={styles.customInput}
                        aria-label="Own contribution in Rupees"
                        autoFocus
                      />
                      <button
                        type="button"
                        className={styles.pencilBtn}
                        onClick={() => setShowOwnEdit(false)}
                        title="Done"
                        aria-label="Done editing own contribution"
                      >
                        <Icon name="check" size="sm" />
                      </button>
                    </div>
                  )}
                  {selectedScheme && (
                    <div className={styles.legendRow}>
                      <span>
                        <span className={styles.swatch} style={{ background: 'var(--wp-color-info, #0284c7)' }} />
                        Requested grant:
                      </span>
                      <strong>₹{(requestedAmount / 100000).toFixed(1)} lakh</strong>
                    </div>
                  )}
                  <div className={styles.legendRow}>
                    <span>Confirmed external funding:</span>
                    <strong>₹0</strong>
                  </div>
                </div>

                <p className={styles.noteBox} style={{ margin: '0.8rem 0 0' }}>
                  Selecting a scheme helps plan your application. It does not confirm funding.
                </p>
              </section>

              <section className={styles.pictureCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Icon name="search" size="sm" />
                  <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>How WaterPilot helps</h3>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--wp-color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  Finds verified opportunities from municipal, CSR and foundation publishers and checks project type, cost and applicant criteria.
                </p>
              </section>
            </aside>
          </div>
        )}

        {/* SCREEN 2: PREPARE PROPOSAL WORKSPACE */}
        {screen === 'proposal' && (
          <div className={styles.proposalWorkspace}>
            <div style={{ marginBottom: '1rem' }}>
              <Button
                variant="ghost"
                size="sm"
                startIcon="chevrons-left"
                onClick={() => setScreen('discover')}
              >
                Back to funding opportunities
              </Button>
            </div>

            <div className={styles.headingRow}>
              <div>
                <div className={styles.eyebrow}>Proposal workspace</div>
                <h1>Prepare your funding proposal</h1>
                <p>
                  Confirm applicant details. WaterPilot will use the project data you have already saved.
                </p>
              </div>
              <span className={`${styles.fundStatusPill} ${styles.pillTeal}`}>
                Draft · Not submitted
              </span>
            </div>

            <div className={styles.proposalGrid}>
              <div className={styles.mainCol}>
                <section className={styles.pictureCard}>
                  <div className={styles.sectionHead} style={{ marginBottom: '1rem' }}>
                    <h2>Applicant & request</h2>
                    <span style={{ fontSize: '0.75rem', color: 'var(--wp-color-text-muted)' }}>* Required</span>
                  </div>

                  <div className={styles.formGrid2}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Applicant / association name *
                      </label>
                      <input
                        type="text"
                        value={applicantName}
                        onChange={(e) => setApplicantName(e.target.value)}
                        className={styles.customInput}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Applicant type *
                      </label>
                      <select
                        value={applicantType}
                        onChange={(e) => setApplicantType(e.target.value)}
                        className={styles.customSelect}
                      >
                        <option>Registered resident association</option>
                        <option>Local government / ward committee</option>
                        <option>Nonprofit organization</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.formGrid2} style={{ marginTop: '0.8rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Contact person *
                      </label>
                      <input
                        type="text"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        placeholder="Full name of representative"
                        className={styles.customInput}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Contact email *
                      </label>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="community@example.com"
                        className={styles.customInput}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '0.8rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Project title *
                    </label>
                    <input
                      type="text"
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      className={styles.customInput}
                    />
                  </div>

                  <div className={styles.formGrid2} style={{ marginTop: '0.8rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Requested support (INR) *
                      </label>
                      <input
                        type="number"
                        value={requestedAmount}
                        onChange={(e) => setCustomRequestedAmount(Number(e.target.value))}
                        className={styles.customInput}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Planned own contribution (INR)
                      </label>
                      <input
                        type="number"
                        value={ownContribution}
                        onChange={(e) => setCustomOwnContribution(Number(e.target.value))}
                        className={styles.customInput}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '0.8rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Anything else the funder should know?
                    </label>
                    <textarea
                      rows={2}
                      value={funderNotes}
                      onChange={(e) => setFunderNotes(e.target.value)}
                      placeholder="Local priorities, permissions or community commitments"
                      className={styles.customTextarea}
                    />
                  </div>
                </section>

                <section className={styles.pictureCard}>
                  <h2>Included from your saved plan</h2>
                  <div className={styles.checklist}>
                    <div className={styles.checkItem}>
                      <Icon name="check" size="sm" className={styles.checkItemIcon} />
                      <div>
                        <strong>Goal & community context</strong>
                        <div style={{ color: 'var(--wp-color-text-muted)' }}>
                          {goalSummaryText} to ≤ {targetDays} days · {locationName}
                        </div>
                      </div>
                    </div>
                    <div className={styles.checkItem}>
                      <Icon name="check" size="sm" className={styles.checkItemIcon} />
                      <div>
                        <strong>Selected works & implementation schedule</strong>
                        <div style={{ color: 'var(--wp-color-text-muted)' }}>
                          {activePlan?.measures?.map((m: { name: string }) => m.name).join(' · ') || 'Rainwater harvesting & leak repair'} · {planDaysText}
                        </div>
                      </div>
                    </div>
                    <div className={styles.checkItem}>
                      <Icon name="check" size="sm" className={styles.checkItemIcon} />
                      <div>
                        <strong>Cost breakdown & available baseline</strong>
                        <div style={{ color: 'var(--wp-color-text-muted)' }}>
                          ₹{planCostLakh} lakh plan estimate · {baselineDays} days/yr baseline shortage
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Aside: Proposal Package */}
              <aside className={styles.asideCol}>
                <section className={`${styles.pictureCard} ${styles.pictureCardAccent}`}>
                  <h2>Your proposal package</h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--wp-color-text-muted)', margin: 0 }}>
                    Tailored to {selectedScheme?.name ?? 'municipal water conservation grant'}.
                  </p>
                  <div className={styles.docList}>
                    {[
                      'Cover letter & funding request',
                      'Project need & community benefit',
                      'Goal, baseline & proposed works',
                      'Budget & implementation timeline',
                      'Monitoring plan & assumptions',
                      'Sources & attachment checklist',
                    ].map((t) => (
                      <div key={t} className={styles.docListItem}>
                        <Icon name="check" size="sm" className={styles.checkItemIcon} />
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', margin: '1rem 0' }}>
                    <input
                      type="checkbox"
                      checked={reviewedCheck}
                      onChange={(e) => setReviewedCheck(e.target.checked)}
                    />
                    <span>I have reviewed the applicant details and request amount.</span>
                  </label>

                  <Button
                    variant="primary"
                    disabled={!reviewedCheck}
                    style={{ width: '100%' }}
                    onClick={() => setScreen('ready')}
                  >
                    <Icon name="file" size="sm" /> Generate proposal draft
                  </Button>

                  <p style={{ fontSize: '0.7rem', color: 'var(--wp-color-text-muted)', margin: '0.6rem 0 0', textAlign: 'center' }}>
                    Review before sending. WaterPilot will not submit automatically.
                  </p>
                </section>
              </aside>
            </div>
          </div>
        )}

        {/* SCREEN 3: READY / DOWNLOAD & SEND */}
        {screen === 'ready' && (
          <div className={styles.readyWorkspace}>
            <div style={{ marginBottom: '1rem' }}>
              <Button
                variant="ghost"
                size="sm"
                startIcon="chevrons-left"
                onClick={() => setScreen('proposal')}
              >
                Edit proposal details
              </Button>
            </div>

            <div className={styles.readyBanner}>
              <div className={styles.fundTile} style={{ background: 'var(--wp-color-surface)' }}>
                <Icon name="check" size="md" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontWeight: 700 }}>Proposal draft prepared</h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--wp-color-text-muted)' }}>
                  {selectedScheme?.name} · Requested support ₹{(requestedAmount / 100000).toFixed(1)} lakh · Ready for final submission
                </p>
              </div>
            </div>

            <div className={styles.proposalGrid}>
              <div className={styles.mainCol}>
                <section className={styles.documentPage}>
                  <div className={styles.docPageHeader}>
                    WaterPilot · Project Funding Proposal
                  </div>
                  <h2 className={styles.docPageTitle}>
                    {projectTitle}
                  </h2>
                  <p style={{ color: 'var(--wp-color-text-muted)', margin: '0 0 1.2rem' }}>
                    {applicantName}
                    <br />
                    {locationName} · Generated Proposal Preview
                  </p>

                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, borderTop: '1px solid var(--wp-color-border)', paddingTop: '0.8rem', margin: '0.8rem 0 0.4rem' }}>
                    01 · Funding request
                  </h3>
                  <p>
                    We respectfully request ₹{requestedAmount.toLocaleString('en-IN')} towards the proposed community water security works under the {selectedScheme?.name}.
                  </p>

                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, borderTop: '1px solid var(--wp-color-border)', paddingTop: '0.8rem', margin: '0.8rem 0 0.4rem' }}>
                    02 · Project need & objective
                  </h3>
                  <p>
                    The community records {baselineDays} days/year baseline shortage. The objective is to {goalSummaryText.toLowerCase()} to ≤ {targetDays} days/year through systematic infrastructure interventions.
                  </p>

                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, borderTop: '1px solid var(--wp-color-border)', paddingTop: '0.8rem', margin: '0.8rem 0 0.4rem' }}>
                    03 · Proposed works
                  </h3>
                  <p>
                    {activePlan?.measures?.map((m: { name: string }) => m.name).join(', ') ?? 'Rainwater harvesting and leak repair'}. Implementation window: {planDaysText}.
                  </p>

                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, borderTop: '1px solid var(--wp-color-border)', paddingTop: '0.8rem', margin: '0.8rem 0 0.4rem' }}>
                    04 · Proposed budget
                  </h3>
                  <table className={styles.docTable}>
                    <tbody>
                      <tr>
                        <td>Estimated project cost</td>
                        <td>₹{planCostNum.toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td>Requested grant</td>
                        <td>₹{requestedAmount.toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td>Planned own contribution</td>
                        <td>₹{ownContribution.toLocaleString('en-IN')}</td>
                      </tr>
                      <tr style={{ fontWeight: 700, borderTop: '2px solid var(--wp-color-border)' }}>
                        <td>Balance to arrange</td>
                        <td>₹{gapToArrange.toLocaleString('en-IN')}</td>
                      </tr>
                    </tbody>
                  </table>

                  <p style={{ fontSize: '0.7rem', color: 'var(--wp-color-text-muted)', marginTop: '1rem' }}>
                    Draft generated using verified site baseline. Funder grant approval is subject to application review.
                  </p>
                </section>
              </div>

              {/* Aside: Download & How to Submit */}
              <aside className={styles.asideCol}>
                <section className={`${styles.pictureCard} ${styles.pictureCardAccent}`}>
                  <h2>Download your proposal</h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--wp-color-text-muted)', margin: '0 0 1rem' }}>
                    Includes cover letter, budget tables & attachment checklist.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <Button variant="primary" onClick={() => downloadProposal('pdf')}>
                      <Icon name="file" size="sm" /> PDF
                    </Button>
                    <Button variant="secondary" onClick={() => downloadProposal('docx')}>
                      <Icon name="file" size="sm" /> Word
                    </Button>
                  </div>
                </section>

                <section className={styles.pictureCard}>
                  <h2>How to submit</h2>
                  <div className={styles.timeline}>
                    <div className={styles.timelineItem}>
                      <div className={styles.timelineStep}>1</div>
                      <div>
                        <strong>Review guidelines</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--wp-color-text-muted)' }}>
                          Confirm deadline, cost eligibility & applicant criteria on official portal.
                        </div>
                      </div>
                    </div>
                    <div className={styles.timelineItem}>
                      <div className={styles.timelineStep}>2</div>
                      <div>
                        <strong>Attach documents</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--wp-color-text-muted)' }}>
                          Attach signed proposal, registration proof & site authorization.
                        </div>
                      </div>
                    </div>
                    <div className={styles.timelineItem}>
                      <div className={styles.timelineStep}>3</div>
                      <div>
                        <strong>Submit application</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--wp-color-text-muted)' }}>
                          Apply through official portal and record your reference number.
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    style={{ width: '100%', marginTop: '0.5rem' }}
                    onClick={() => window.open('https://karnataka.gov.in', '_blank')}
                  >
                    Open official application portal <Icon name="external" size="sm" />
                  </Button>
                </section>

                <section className={styles.pictureCard}>
                  <h3>After applying</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--wp-color-text-muted)', margin: '0 0 0.8rem' }}>
                    Save your acknowledgement and track progress in Take Action.
                  </p>
                  <ButtonLink to="/reports/review" variant="primary" endIcon="arrow-right" style={{ width: '100%' }}>
                    Continue to Take Action
                  </ButtonLink>
                </section>
              </aside>
            </div>
          </div>
        )}

        {/* Slide-in Details Drawer */}
        {drawerScheme && (
          <div
            className={styles.drawerOverlay}
            onClick={(e) => {
              if (e.target === e.currentTarget) setDrawerScheme(null);
            }}
          >
            <div className={styles.drawer} role="dialog" aria-modal="true">
              <header className={styles.drawerHead}>
                <button
                  type="button"
                  className={styles.drawerClose}
                  aria-label="Close funding details"
                  onClick={() => setDrawerScheme(null)}
                >
                  <Icon name="close" size="sm" />
                </button>
                <div className={styles.eyebrow}>Funding opportunity</div>
                <h2>{drawerScheme.name}</h2>
                <p style={{ margin: '0 0 0.4rem', color: 'var(--wp-color-text-muted)', fontSize: '0.8rem' }}>
                  {drawerScheme.funder} · {drawerScheme.kind}
                </p>
                <span className={`${styles.fundStatusPill} ${drawerScheme.tone === 'green' ? styles.pillGreen : styles.pillAmber}`}>
                  {drawerScheme.status}
                </span>
              </header>

              <div className={styles.drawerBody}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', background: 'var(--wp-color-surface-sunken)', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--wp-color-text-muted)' }}>Potential support</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{drawerScheme.amount}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--wp-color-text-muted)' }}>Application window</span>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{drawerScheme.window.replace('Open application window · ', '')}</div>
                  </div>
                </div>

                <div className={styles.drawerSection}>
                  <h3>Why this fits your plan</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--wp-color-text-muted)', margin: 0 }}>
                    {drawerScheme.why}
                  </p>
                  <div className={styles.noteBox} style={{ marginTop: '0.5rem' }}>
                    {drawerScheme.checked}. Final approval rests with the programme administrator.
                  </div>
                  {drawerScheme.sourceUrl && (
                    <div style={{ marginTop: '0.6rem' }}>
                      <a
                        href={drawerScheme.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.linkBtn}
                      >
                        Visit official registry portal <Icon name="external" size="sm" />
                      </a>
                    </div>
                  )}
                </div>

                <div className={styles.drawerSection}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <h3 style={{ margin: 0 }}>Eligibility checks</h3>
                    <span className={`${styles.fundStatusPill} ${drawerScheme.eligible ? styles.pillTeal : styles.pillAmber}`}>
                      {drawerScheme.eligible ? '5 / 5 met' : 'Needs confirmation'}
                    </span>
                  </div>
                  <div className={styles.checklist}>
                    {drawerScheme.checks.map(([h, t]) => (
                      <div key={h} className={styles.checkItem}>
                        <Icon name="check" size="sm" className={styles.checkItemIcon} />
                        <div>
                          <strong>{h}:</strong> {t}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.drawerSection}>
                  <h3>What it covers</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--wp-color-text-muted)', margin: 0 }}>
                    Collection systems, storage tanks, recharge filtration and piping works. Routine maintenance is excluded under grant terms.
                  </p>
                </div>

                <div className={styles.drawerSection}>
                  <h3>Documents you will need</h3>
                  <div className={styles.docList}>
                    <div className={styles.docListItem}>
                      <Icon name="file" size="sm" /> Project proposal (WaterPilot can draft this)
                    </div>
                    <div className={styles.docListItem}>
                      <Icon name="check" size="sm" className={styles.checkItemIcon} /> Selected plan & cost breakdown (Ready)
                    </div>
                    <div className={styles.docListItem}>
                      <Icon name="file" size="sm" /> Society registration certificate
                    </div>
                    <div className={styles.docListItem}>
                      <Icon name="file" size="sm" /> Site authorization letter
                    </div>
                  </div>
                </div>

                {drawerScheme.eligible && (
                  <div className={styles.drawerSection}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                      Amount to request (INR) *
                    </label>
                    <input
                      type="number"
                      value={requestedAmount}
                      onChange={(e) => setCustomRequestedAmount(Number(e.target.value))}
                      className={styles.customInput}
                    />
                  </div>
                )}
              </div>

              <footer className={styles.drawerFooter}>
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                  <Button
                    variant="primary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setSelectedScheme(drawerScheme);
                      setDrawerScheme(null);
                      setScreen('proposal');
                    }}
                  >
                    Select scheme & prepare proposal
                  </Button>
                  <Button variant="secondary" onClick={() => setDrawerScheme(null)}>
                    Keep exploring
                  </Button>
                </div>
              </footer>
            </div>
          </div>
        )}

        {/* Global Footer Navigation */}
        <div className={styles.stepActions}>
          <ButtonLink to="/plans" variant="secondary" startIcon="chevrons-left">
            Back to Compare Plans
          </ButtonLink>
          <ButtonLink to="/reports/review" variant="primary" endIcon="arrow-right">
            Continue to Take Action
          </ButtonLink>
        </div>
      </div>
    </StagePage>
  );
}
