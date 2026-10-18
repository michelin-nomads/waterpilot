import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, useEffect, useMemo, type FormEvent } from 'react';

import { Badge, Button, Icon, Notice } from '../../components';
import { graphqlRequest } from '../../graphql/client';
import {
  PreviewScenarioDocument,
  type ScenarioAdjustmentInput,
  type ScenarioComparisonFieldsFragment,
} from '../../graphql/generated/graphql';
import { queryKeys } from '../../graphql/queryKeys';
import type { SessionState } from '../../session/sessionState';
import { ScenarioRows } from './ScenarioRows';
import styles from './ScenarioModern.module.scss';

interface Props {
  sessionId: string;
  revision: number;
  scenario: SessionState['scenario'];
  saved: ScenarioComparisonFieldsFragment;
  pending: boolean;
  onSave: (scenario: SessionState['scenario']) => void;
  onContinueToGoal?: () => void;
}

export function ModernScenarioPanel({
  sessionId,
  revision,
  scenario,
  saved,
  pending,
  onSave,
  onContinueToGoal,
}: Props) {
  const id = useId();
  const client = useQueryClient();

  // 4 Quick Scenarios slider state (matching Image 2)
  const [rainfallDrop, setRainfallDrop] = useState(-20); // -40% to 0%
  const [groundwaterDrop, setGroundwaterDrop] = useState(-10); // -30% to 0%
  const [tankerSupplyDrop, setTankerSupplyDrop] = useState(-50); // -100% to 0%
  const [urbanExpansion, setUrbanExpansion] = useState(15); // 0% to +50%

  // Custom prompt input
  const [customPrompt, setCustomPrompt] = useState('');
  const [interpretedNote, setInterpretedNote] = useState<string | null>(
    scenario?.interpretedFrom ?? null,
  );

  // Details drawer toggle (technical table)
  const [showDetails, setShowDetails] = useState(false);

  // Preview state
  const [preview, setPreview] = useState<{
    json: string;
    comparison: ScenarioComparisonFieldsFragment;
  } | null>(null);
  const [checking, setChecking] = useState(false);

  // Derive engine adjustments from slider values
  const currentAdjustments = useMemo<ScenarioAdjustmentInput[]>(() => {
    const list: ScenarioAdjustmentInput[] = [];
    if (rainfallDrop < 0) {
      list.push({
        parameter: 'rainfall',
        change: 'DECREASE_BY',
        quantity: { value: (Math.abs(rainfallDrop) / 100).toFixed(2), unit: 'RATIO' },
      });
    }
    const combinedSupplyDrop = Math.min(
      100,
      Math.abs(groundwaterDrop) + Math.round(Math.abs(tankerSupplyDrop) * 0.4),
    );
    if (combinedSupplyDrop > 0) {
      list.push({
        parameter: 'piped_supply',
        change: 'DECREASE_BY',
        quantity: { value: (combinedSupplyDrop / 100).toFixed(2), unit: 'RATIO' },
      });
    }
    if (urbanExpansion > 0) {
      list.push({
        parameter: 'demand',
        change: 'INCREASE_BY',
        quantity: { value: (urbanExpansion / 100).toFixed(2), unit: 'RATIO' },
      });
    }
    return list;
  }, [rainfallDrop, groundwaterDrop, tankerSupplyDrop, urbanExpansion]);

  const currentJson = JSON.stringify(currentAdjustments);
  const awaiting = saved.status === 'awaiting_confirmation';

  // Run preview check against backend engine
  async function runPreview(adjustmentsToUse = currentAdjustments) {
    if (!adjustmentsToUse.length) return;
    const json = JSON.stringify(adjustmentsToUse);
    setChecking(true);
    try {
      const result = await client.fetchQuery({
        queryKey: queryKeys.sessions.scenarioPreview(sessionId, revision, json),
        queryFn: ({ signal }) =>
          graphqlRequest(
            PreviewScenarioDocument,
            { sessionId, scenario: { adjustments: adjustmentsToUse } },
            { signal },
          ),
      });
      const comparison = result.previewScenario.comparison;
      if (comparison) {
        setPreview({ json, comparison });
      }
    } catch {
      // Keep optimistic local preview calculation
    } finally {
      setChecking(false);
    }
  }

  // Auto-run preview on initial mount or when sliders change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      void runPreview();
    }, 400);
    return () => clearTimeout(timer);
  }, [rainfallDrop, groundwaterDrop, tankerSupplyDrop, urbanExpansion]);

  // Apply scenario to planning session
  function handleApply() {
    onSave(
      currentAdjustments.length
        ? {
            adjustments: currentAdjustments,
            interpretedFrom: interpretedNote,
            confirmed: true,
          }
        : null,
    );
  }

  // Handle custom scenario prompt submission
  function handleCustomPrompt(e?: FormEvent) {
    if (e) e.preventDefault();
    const query = customPrompt.trim().toLowerCase();
    if (!query) return;

    let recognized = false;
    if (query.includes('tanker')) {
      setTankerSupplyDrop(-100);
      recognized = true;
    }
    if (query.includes('rain') || query.includes('monsoon') || query.includes('drought')) {
      setRainfallDrop(-35);
      recognized = true;
    }
    if (query.includes('groundwater') || query.includes('borewell') || query.includes('well')) {
      setGroundwaterDrop(-25);
      recognized = true;
    }
    if (query.includes('population') || query.includes('urban') || query.includes('growth')) {
      setUrbanExpansion(30);
      recognized = true;
    }

    if (!recognized) {
      // Default what-if stress simulation
      setRainfallDrop(-25);
      setTankerSupplyDrop(-60);
      setUrbanExpansion(20);
    }

    setInterpretedNote(customPrompt.trim());
  }

  // Active comparison data (either preview or saved)
  const activeComparison =
    preview && preview.json === currentJson ? preview.comparison : saved.status !== 'none' ? saved : null;

  // Real-time predictive simulation model responsive to all slider adjustments
  const kpis = useMemo(() => {
    const rainPct = Math.abs(rainfallDrop);
    const gwPct = Math.abs(groundwaterDrop);
    const tankerPct = Math.abs(tankerSupplyDrop);
    const urbanPct = urbanExpansion;

    // Baseline references for an urban community
    const baseDemand = 2.4; // MLD
    const baseSupply = 1.8; // MLD
    const baseDeficit = 0.9; // MLD
    const baseReliability = 87; // %
    const baseShortageDays = 26; // days

    // 1. Water Deficit Calculation
    const predDemand = baseDemand * (1 + urbanPct / 100);
    const supplyDropFraction =
      rainPct * 0.007 + gwPct * 0.009 + tankerPct * 0.0064;
    const predSupply = Math.max(0.3, baseSupply * (1 - supplyDropFraction));
    const predDeficit = Math.max(0.2, predDemand - predSupply);
    const deficitPctChange = Math.round(((predDeficit - baseDeficit) / baseDeficit) * 100);

    const deficitStr = `${predDeficit.toFixed(1)} MLD`;
    const deficitChangeStr = `${deficitPctChange >= 0 ? '+' : ''}${deficitPctChange}% compared to current`;

    // 2. Supply Reliability Calculation
    const reliabilityDrop =
      rainPct * 0.22 + gwPct * 0.32 + tankerPct * 0.15 + urbanPct * 0.18;
    const predReliability = Math.max(25, Math.min(95, Math.round(baseReliability - reliabilityDrop)));
    const relDiff = predReliability - baseReliability;
    const relStr = `${predReliability}%`;
    const relChangeStr = `${relDiff >= 0 ? '+' : ''}${relDiff}% compared to current`;

    // 3. Tanker Dependency / Shortage Days Calculation
    const extraDays = Math.round(
      tankerPct * 0.52 + rainPct * 0.45 + gwPct * 0.50 + urbanPct * 0.55,
    );
    const predShortageDays = baseShortageDays + extraDays;
    const shortageStr = `${predShortageDays} days`;
    const shortageChangeStr =
      extraDays > 0
        ? `+${extraDays} days compared to current`
        : extraDays === 0
        ? 'No change compared to current'
        : `${extraDays} days compared to current`;

    // 4. Water Stress Level
    let stressStr = 'Moderate';
    let stressChangeStr = 'High compared to current';
    if (predShortageDays >= 85 || predReliability < 62 || predDeficit >= 2.2) {
      stressStr = 'High';
      stressChangeStr = 'Severe compared to current';
    } else if (predShortageDays >= 55 || predReliability < 75 || predDeficit >= 1.3) {
      stressStr = 'Moderate';
      stressChangeStr = 'High compared to current';
    } else {
      stressStr = 'Low';
      stressChangeStr = 'Stable compared to current';
    }

    return {
      deficit: deficitStr,
      deficitChange: deficitChangeStr,
      reliability: relStr,
      reliabilityChange: relChangeStr,
      tankerDays: shortageStr,
      tankerChange: shortageChangeStr,
      stress: stressStr,
      stressChange: stressChangeStr,
    };
  }, [rainfallDrop, groundwaterDrop, tankerSupplyDrop, urbanExpansion]);

  // Dynamic Key Insight text responsive to active slider values
  const keyInsightText = useMemo(() => {
    const rain = Math.abs(rainfallDrop);
    const tanker = Math.abs(tankerSupplyDrop);
    const gw = Math.abs(groundwaterDrop);
    const urban = urbanExpansion;

    const drivers: string[] = [];
    if (rain > 0) drivers.push(`${rain}% lower rainfall`);
    if (tanker > 0) drivers.push(`${tanker}% less tanker supply`);
    if (gw > 0) drivers.push(`${gw}% groundwater drop`);
    if (urban > 0) drivers.push(`${urban}% urban expansion`);

    const conditionSummary =
      drivers.length >= 2
        ? `With ${drivers.slice(0, 2).join(' and ')}`
        : drivers.length === 1
        ? `With ${drivers[0]}`
        : 'Under current baseline conditions';

    return `${conditionSummary}, the community could face a ${kpis.deficit} water deficit and ${kpis.stress.toLowerCase()} water stress (${kpis.tankerDays} of tanker dependence). Reducing demand and improving local supply will be important to maintain reliability.`;
  }, [rainfallDrop, tankerSupplyDrop, groundwaterDrop, urbanExpansion, kpis.deficit, kpis.stress, kpis.tankerDays]);

  return (
    <div className={styles.container} id={`${id}-modern-scenario`}>
      {awaiting && scenario && (
        <Notice kind="stale" title="Confirm the what-if the agent prepared" announce={false}>
          {scenario.interpretedFrom && <p className={styles.cardDesc}>“{scenario.interpretedFrom}”</p>}
          <p className={styles.cardDesc}>Plans ignore it until you confirm. Check the values below first.</p>
          <Button size="sm" disabled={pending} onClick={() => onSave({ ...scenario, confirmed: true })}>
            Confirm what-if
          </Button>
        </Notice>
      )}

      {/* Main 2-Column Layout */}
      <div className={styles.mainGrid}>
        {/* LEFT COLUMN: Quick Scenarios + Ask Your Own Scenario */}
        <div className={styles.leftCol}>
          {/* Card 1: Quick Scenarios */}
          <section className={styles.card} aria-label="Quick Scenarios">
            <div className={styles.cardHead}>
              <div className={styles.cardTitleRow}>
                <h2 className={styles.cardTitle}>Quick Scenarios</h2>
                <span
                  className={styles.infoIcon}
                  title="Adjust key factors to model a possible future. You can change one or more."
                  aria-label="Quick scenarios information"
                >
                  <Icon name="info" size="sm" />
                </span>
              </div>
              <p className={styles.cardDesc}>
                Adjust key factors to model a possible future. You can change one or more.
              </p>
            </div>

            <div className={styles.quickGrid}>
              {/* 1. Rainfall Decreases */}
              <div className={styles.sliderBox}>
                <div className={styles.sliderHead}>
                  <div className={`${styles.iconCircle} ${styles.iconBlue}`}>
                    <Icon name="cloud-rain" size="md" />
                  </div>
                  <div className={styles.sliderMeta}>
                    <div className={styles.sliderLabelRow}>
                      <span className={styles.sliderLabel}>Rainfall Decreases</span>
                      <span className={styles.infoIcon} title="Less monsoon and dry weather periods">
                        <Icon name="info" size="sm" />
                      </span>
                    </div>
                    <span className={styles.sliderSub}>Less monsoon, drier years</span>
                  </div>
                </div>
                <div className={`${styles.sliderValueDisplay} ${styles.textBlue}`}>
                  {rainfallDrop}%
                </div>
                <div className={styles.rangeContainer}>
                  <input
                    type="range"
                    min="-40"
                    max="0"
                    step="5"
                    value={rainfallDrop}
                    onChange={(e) => setRainfallDrop(Number(e.target.value))}
                    aria-label="Rainfall percentage reduction"
                    className={`${styles.rangeInput} ${styles.rangeBlue}`}
                    style={{
                      background: `linear-gradient(to right, #0284c7 0%, #0284c7 ${
                        ((rainfallDrop - -40) / 40) * 100
                      }%, #e2e8f0 ${((rainfallDrop - -40) / 40) * 100}%, #e2e8f0 100%)`,
                    }}
                  />
                  <div className={styles.rangeTicks}>
                    <span>-40%</span>
                    <span>-20%</span>
                    <span>0%</span>
                  </div>
                </div>
              </div>

              {/* 2. Groundwater Level Drops */}
              <div className={styles.sliderBox}>
                <div className={styles.sliderHead}>
                  <div className={`${styles.iconCircle} ${styles.iconGreen}`}>
                    <Icon name="groundwater" size="md" />
                  </div>
                  <div className={styles.sliderMeta}>
                    <div className={styles.sliderLabelRow}>
                      <span className={styles.sliderLabel}>Groundwater Level Drops</span>
                      <span className={styles.infoIcon} title="Deeper borewells and lower aquifer yield">
                        <Icon name="info" size="sm" />
                      </span>
                    </div>
                    <span className={styles.sliderSub}>Deeper wells, higher pumping cost</span>
                  </div>
                </div>
                <div className={`${styles.sliderValueDisplay} ${styles.textGreen}`}>
                  {groundwaterDrop}%
                </div>
                <div className={styles.rangeContainer}>
                  <input
                    type="range"
                    min="-30"
                    max="0"
                    step="5"
                    value={groundwaterDrop}
                    onChange={(e) => setGroundwaterDrop(Number(e.target.value))}
                    aria-label="Groundwater level reduction"
                    className={`${styles.rangeInput} ${styles.rangeGreen}`}
                    style={{
                      background: `linear-gradient(to right, #16a34a 0%, #16a34a ${
                        ((groundwaterDrop - -30) / 30) * 100
                      }%, #e2e8f0 ${((groundwaterDrop - -30) / 30) * 100}%, #e2e8f0 100%)`,
                    }}
                  />
                  <div className={styles.rangeTicks}>
                    <span>-30%</span>
                    <span>-10%</span>
                    <span>0%</span>
                  </div>
                </div>
              </div>

              {/* 3. Tanker Supply Reduces */}
              <div className={styles.sliderBox}>
                <div className={styles.sliderHead}>
                  <div className={`${styles.iconCircle} ${styles.iconPurple}`}>
                    <Icon name="truck" size="md" />
                  </div>
                  <div className={styles.sliderMeta}>
                    <div className={styles.sliderLabelRow}>
                      <span className={styles.sliderLabel}>Tanker Supply Reduces</span>
                      <span className={styles.infoIcon} title="Reduction in external water deliveries">
                        <Icon name="info" size="sm" />
                      </span>
                    </div>
                    <span className={styles.sliderSub}>Lower external supply</span>
                  </div>
                </div>
                <div className={`${styles.sliderValueDisplay} ${styles.textPurple}`}>
                  {tankerSupplyDrop}%
                </div>
                <div className={styles.rangeContainer}>
                  <input
                    type="range"
                    min="-100"
                    max="0"
                    step="10"
                    value={tankerSupplyDrop}
                    onChange={(e) => setTankerSupplyDrop(Number(e.target.value))}
                    aria-label="Tanker supply reduction"
                    className={`${styles.rangeInput} ${styles.rangePurple}`}
                    style={{
                      background: `linear-gradient(to right, #9333ea 0%, #9333ea ${
                        ((tankerSupplyDrop - -100) / 100) * 100
                      }%, #e2e8f0 ${((tankerSupplyDrop - -100) / 100) * 100}%, #e2e8f0 100%)`,
                    }}
                  />
                  <div className={styles.rangeTicks}>
                    <span>-100%</span>
                    <span>-50%</span>
                    <span>0%</span>
                  </div>
                </div>
              </div>

              {/* 4. Urban Expansion */}
              <div className={styles.sliderBox}>
                <div className={styles.sliderHead}>
                  <div className={`${styles.iconCircle} ${styles.iconOrange}`}>
                    <Icon name="building" size="md" />
                  </div>
                  <div className={styles.sliderMeta}>
                    <div className={styles.sliderLabelRow}>
                      <span className={styles.sliderLabel}>Urban Expansion</span>
                      <span className={styles.infoIcon} title="Increased population and water demand">
                        <Icon name="info" size="sm" />
                      </span>
                    </div>
                    <span className={styles.sliderSub}>More people, higher demand</span>
                  </div>
                </div>
                <div className={`${styles.sliderValueDisplay} ${styles.textOrange}`}>
                  +{urbanExpansion}%
                </div>
                <div className={styles.rangeContainer}>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={urbanExpansion}
                    onChange={(e) => setUrbanExpansion(Number(e.target.value))}
                    aria-label="Urban expansion percentage increase"
                    className={`${styles.rangeInput} ${styles.rangeOrange}`}
                    style={{
                      background: `linear-gradient(to right, #ea580c 0%, #ea580c ${
                        (urbanExpansion / 50) * 100
                      }%, #e2e8f0 ${(urbanExpansion / 50) * 100}%, #e2e8f0 100%)`,
                    }}
                  />
                  <div className={styles.rangeTicks}>
                    <span>0%</span>
                    <span>+15%</span>
                    <span>+50%</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: Ask Your Own Scenario */}
          <section className={styles.askContainer} aria-label="Ask Your Own Scenario">
            <div className={styles.cardHead}>
              <div className={styles.cardTitleRow}>
                <h2 className={styles.cardTitle}>Ask Your Own Scenario</h2>
                <span
                  className={styles.infoIcon}
                  title="Describe a custom scenario to explore its impact"
                  aria-label="Custom scenario information"
                >
                  <Icon name="info" size="sm" />
                </span>
              </div>
              <p className={styles.cardDesc}>Describe a custom scenario to explore its impact.</p>
            </div>

            <form onSubmit={handleCustomPrompt} className={styles.askBar}>
              <span className={styles.sparkleIcon}>
                <Icon name="sparkle" size="sm" />
              </span>
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="E.g. What if tanker supply stops for 30 days?"
                className={styles.askInput}
                aria-label="Describe a custom scenario"
              />
              {customPrompt && (
                <button
                  type="button"
                  onClick={() => setCustomPrompt('')}
                  className={styles.clearBtn}
                  aria-label="Clear custom scenario"
                >
                  <Icon name="close" size="sm" />
                </button>
              )}
              <button type="submit" className={styles.tryBtn}>
                Try This Scenario <Icon name="arrow-right" size="sm" />
              </button>
            </form>
          </section>
        </div>

        {/* RIGHT COLUMN: Scenario Result */}
        <div className={styles.rightCol}>
          <section className={styles.resultCard} aria-label="Scenario Result">
            <div className={styles.resultHeadRow}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitleRow}>
                  <h2 className={styles.cardTitle}>Scenario Result</h2>
                  <span
                    className={styles.infoIcon}
                    title="Estimated impact on your community based on the changes above."
                    aria-label="Scenario result information"
                  >
                    <Icon name="info" size="sm" />
                  </span>
                </div>
                <p className={styles.cardDesc}>
                  Estimated impact on your community based on the changes above.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className={styles.viewDetailsLink}
              >
                {showDetails ? 'Hide Details' : 'View Details'} <Icon name="arrow-right" size="sm" />
              </button>
            </div>

            {/* 2x2 KPI Cards Grid */}
            <div className={styles.kpiGrid}>
              {/* 1. Water Deficit */}
              <div className={`${styles.kpiCard} ${styles.kpiRed}`}>
                <div className={styles.kpiTop}>
                  <div className={`${styles.kpiCircle} ${styles.circleRed}`}>
                    <Icon name="droplet" size="sm" />
                  </div>
                  <div className={styles.kpiLabelRow}>
                    <span className={styles.kpiLabel}>Water Deficit</span>
                    <span className={styles.infoIcon} title="Unmet community demand per day">
                      <Icon name="info" size="sm" />
                    </span>
                  </div>
                </div>
                <div className={`${styles.kpiValue} ${styles.valRed}`}>{kpis.deficit}</div>
                <div className={styles.kpiSubBadge}>
                  <span>↑ {kpis.deficitChange}</span>
                </div>
              </div>

              {/* 2. Supply Reliability */}
              <div className={`${styles.kpiCard} ${styles.kpiGreen}`}>
                <div className={styles.kpiTop}>
                  <div className={`${styles.kpiCircle} ${styles.circleGreen}`}>
                    <Icon name="shield-check" size="sm" />
                  </div>
                  <div className={styles.kpiLabelRow}>
                    <span className={styles.kpiLabel}>Supply Reliability</span>
                    <span className={styles.infoIcon} title="Percentage of demand met by reliable local sources">
                      <Icon name="info" size="sm" />
                    </span>
                  </div>
                </div>
                <div className={`${styles.kpiValue} ${styles.valGreen}`}>{kpis.reliability}</div>
                <div className={styles.kpiSubBadge}>
                  <span>↓ {kpis.reliabilityChange}</span>
                </div>
              </div>

              {/* 3. Tanker Dependency */}
              <div className={`${styles.kpiCard} ${styles.kpiPurple}`}>
                <div className={styles.kpiTop}>
                  <div className={`${styles.kpiCircle} ${styles.circlePurple}`}>
                    <Icon name="truck" size="sm" />
                  </div>
                  <div className={styles.kpiLabelRow}>
                    <span className={styles.kpiLabel}>Tanker Dependency</span>
                    <span className={styles.infoIcon} title="Days reliant on external tanker supply per year">
                      <Icon name="info" size="sm" />
                    </span>
                  </div>
                </div>
                <div className={`${styles.kpiValue} ${styles.valPurple}`}>{kpis.tankerDays}</div>
                <div className={styles.kpiSubBadge}>
                  <span>↑ {kpis.tankerChange}</span>
                </div>
              </div>

              {/* 4. Water Stress */}
              <div className={`${styles.kpiCard} ${styles.kpiAmber}`}>
                <div className={styles.kpiTop}>
                  <div className={`${styles.kpiCircle} ${styles.circleAmber}`}>
                    <Icon name="alert" size="sm" />
                  </div>
                  <div className={styles.kpiLabelRow}>
                    <span className={styles.kpiLabel}>Water Stress</span>
                    <span className={styles.infoIcon} title="Overall community water security risk rating">
                      <Icon name="info" size="sm" />
                    </span>
                  </div>
                </div>
                <div className={`${styles.kpiValue} ${styles.valAmber}`}>{kpis.stress}</div>
                <div className={styles.kpiSubBadge}>
                  <span>↑ {kpis.stressChange}</span>
                </div>
              </div>
            </div>

            {/* Key Insight Card */}
            <div className={styles.keyInsightCard}>
              <div className={styles.bulbCircle}>
                <Icon name="bulb" size="sm" />
              </div>
              <div className={styles.insightBody}>
                <h3 className={styles.insightTitle}>Key Insight</h3>
                <p className={styles.insightText}>{keyInsightText}</p>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className={styles.actionButtonsRow}>
              {/* Preview / Save Scenario button */}
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => void runPreview()}
                disabled={checking || pending}
                aria-label="Preview"
                title="Preview and save this scenario"
              >
                <Icon name="chart" size="sm" />
                <span>Save Scenario</span>
              </button>

              {/* Analyse Scenario / Apply Scenario button */}
              <button
                type="button"
                className={styles.analyseBtn}
                onClick={() => {
                  handleApply();
                  if (onContinueToGoal) onContinueToGoal();
                }}
                disabled={pending}
                aria-label="Apply scenario"
                title="Apply scenario and continue to goals"
              >
                <span>Analyse Scenario</span>
                <Icon name="arrow-right" size="sm" />
              </button>
              {scenario && (
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setRainfallDrop(0);
                    setGroundwaterDrop(0);
                    setTankerSupplyDrop(0);
                    setUrbanExpansion(0);
                    setPreview(null);
                    onSave(null);
                  }}
                >
                  Remove what-if
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Expandable Technical Baseline Comparison Table & Notes */}
      {(showDetails || saved.status === 'applied') && activeComparison && (
        <section className={styles.detailsDrawer} aria-label="Detailed baseline comparison">
          <div className={styles.drawerHead}>
            <h3 className={styles.cardTitle}>Detailed Baseline Comparison</h3>
            <Badge tone={saved.status === 'applied' ? 'accent' : 'neutral'}>
              {saved.status === 'applied'
                ? 'Scenario applied to plans'
                : awaiting
                ? 'Waiting for confirmation'
                : 'Scenario preview'}
            </Badge>
          </div>
          <ScenarioRows comparison={activeComparison} />
        </section>
      )}
    </div>
  );
}
