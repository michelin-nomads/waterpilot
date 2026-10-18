import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, useEffect, useMemo, type FormEvent } from 'react';

import { Button, Icon, Notice, Tooltip } from '../../components';
import { graphqlRequest } from '../../graphql/client';
import {
  PreviewScenarioDocument,
  type ScenarioAdjustmentInput,
  type ScenarioComparisonFieldsFragment,
} from '../../graphql/generated/graphql';
import { queryKeys } from '../../graphql/queryKeys';
import type { SessionState } from '../../session/sessionState';
import styles from './ScenarioModern.module.scss';
import { parseCustomScenario } from './customScenario';

interface Props {
  sessionId: string;
  revision: number;
  scenario: SessionState['scenario'];
  saved: ScenarioComparisonFieldsFragment;
  pending: boolean;
  onSave: (scenario: SessionState['scenario']) => void;
  onAnalyse?: (scenario: SessionState['scenario']) => void;
  onContinueToGoal?: () => void;
}

export function ModernScenarioPanel({
  sessionId,
  revision,
  scenario,
  saved,
  pending,
  onSave,
  onAnalyse,
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
  const [customFeedback, setCustomFeedback] = useState<{ error?: string; summary?: string } | null>(
    null,
  );
  const [interpretedNote, setInterpretedNote] = useState<string | null>(
    scenario?.interpretedFrom ?? null,
  );

  // Save scenario success feedback state
  const [savedSuccess] = useState(false);

  // Derive engine adjustments from slider values
  const currentAdjustments = useMemo<ScenarioAdjustmentInput[]>(() => {
    const list: ScenarioAdjustmentInput[] = [];
    if (rainfallDrop !== 0) {
      list.push({
        parameter: 'rainfall',
        change: rainfallDrop > 0 ? 'INCREASE_BY' : 'DECREASE_BY',
        quantity: { value: (Math.abs(rainfallDrop) / 100).toFixed(2), unit: 'RATIO' },
      });
    }
    if (urbanExpansion !== 0) {
      list.push({
        parameter: 'demand',
        change: urbanExpansion > 0 ? 'INCREASE_BY' : 'DECREASE_BY',
        quantity: { value: (Math.abs(urbanExpansion) / 100).toFixed(2), unit: 'RATIO' },
      });
    }
    return list;
  }, [rainfallDrop, groundwaterDrop, tankerSupplyDrop, urbanExpansion]);

  const awaiting = saved.status === 'awaiting_confirmation';

  // Debounced scenario preview prefetch
  useEffect(() => {
    if (!currentAdjustments.length) return;
    const json = JSON.stringify(currentAdjustments);
    const timer = setTimeout(() => {
      void client
        .fetchQuery({
          queryKey: queryKeys.sessions.scenarioPreview(sessionId, revision, json),
          queryFn: ({ signal }) =>
            graphqlRequest(
              PreviewScenarioDocument,
              { sessionId, scenario: { adjustments: currentAdjustments } },
              { signal },
            ),
        })
        .catch(() => {
          // Keep optimistic local preview calculation
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [client, currentAdjustments, revision, sessionId]);

  // Analyse scenario and proceed to next stage
  function handleAnalyseScenario() {
    const payload = currentAdjustments.length
      ? {
          adjustments: currentAdjustments,
          interpretedFrom: interpretedNote,
          confirmed: true,
        }
      : {
          adjustments: [],
          interpretedFrom: interpretedNote,
          confirmed: true,
        };
    if (onAnalyse) {
      onAnalyse(payload);
    } else {
      onSave(payload);
      if (onContinueToGoal) onContinueToGoal();
    }
  }

  // Handle custom scenario prompt submission
  function handleCustomPrompt(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!customPrompt.trim() || pending) return;
    const parsed = parseCustomScenario(customPrompt);
    if ('error' in parsed) {
      setCustomFeedback({ error: parsed.error });
      return;
    }
    const setters = {
      rainfall: setRainfallDrop,
      groundwater: setGroundwaterDrop,
      tanker: setTankerSupplyDrop,
      population: setUrbanExpansion,
    };
    setters[parsed.field](parsed.value);
    setCustomFeedback({ summary: parsed.summary });
    setInterpretedNote(customPrompt.trim());
  }

  // Real-time predictive simulation model responsive to all slider adjustments
  const kpis = useMemo(() => {
    const rainPct = -rainfallDrop;
    const gwPct = -groundwaterDrop;
    const tankerPct = -tankerSupplyDrop;
    const urbanPct = urbanExpansion;

    // Baseline references for an urban community
    const baseDemand = 2.4; // MLD
    const baseSupply = 1.8; // MLD
    const baseDeficit = 0.9; // MLD
    const baseReliability = 87; // %
    const baseShortageDays = 26; // days

    // 1. Water Deficit Calculation
    const predDemand = baseDemand * (1 + urbanPct / 100);
    const supplyDropFraction = rainPct * 0.007 + gwPct * 0.009 + tankerPct * 0.0064;
    const predSupply = Math.max(0.3, baseSupply * (1 - supplyDropFraction));
    const predDeficit = Math.max(0.2, predDemand - predSupply);
    const deficitPctChange = Math.round(((predDeficit - baseDeficit) / baseDeficit) * 100);

    const deficitStr = `${predDeficit.toFixed(1)} MLD`;
    const deficitChangeStr = `${deficitPctChange >= 0 ? '+' : ''}${deficitPctChange}% compared to current`;

    // 2. Supply Reliability Calculation
    const reliabilityDrop = rainPct * 0.22 + gwPct * 0.32 + tankerPct * 0.15 + urbanPct * 0.18;
    const predReliability = Math.max(
      25,
      Math.min(95, Math.round(baseReliability - reliabilityDrop)),
    );
    const relDiff = predReliability - baseReliability;
    const relStr = `${predReliability}%`;
    const relChangeStr = `${relDiff >= 0 ? '+' : ''}${relDiff}% compared to current`;

    // 3. Tanker Dependency / Shortage Days Calculation
    const extraDays = Math.round(tankerPct * 0.52 + rainPct * 0.45 + gwPct * 0.5 + urbanPct * 0.55);
    const predShortageDays = Math.max(0, Math.min(365, baseShortageDays + extraDays));
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
    if (rain > 0) drivers.push(`${rain}% ${rainfallDrop > 0 ? 'higher' : 'lower'} rainfall`);
    if (tanker > 0)
      drivers.push(`${tanker}% ${tankerSupplyDrop > 0 ? 'more' : 'less'} tanker supply`);
    if (gw > 0) drivers.push(`${gw}% groundwater ${groundwaterDrop > 0 ? 'increase' : 'decrease'}`);
    if (urban !== 0) drivers.push(`${Math.abs(urban)}% ${urban > 0 ? 'higher' : 'lower'} demand`);

    const conditionSummary =
      drivers.length >= 2
        ? `With ${drivers.slice(0, 2).join(' and ')}`
        : drivers.length === 1
          ? `With ${drivers[0]}`
          : 'Under current baseline conditions';

    return `${conditionSummary}, the community could face a ${kpis.deficit} water deficit and ${kpis.stress.toLowerCase()} water stress (${kpis.tankerDays} of tanker dependence). Reducing demand and improving local supply will be important to maintain reliability.`;
  }, [
    rainfallDrop,
    tankerSupplyDrop,
    groundwaterDrop,
    urbanExpansion,
    kpis.deficit,
    kpis.stress,
    kpis.tankerDays,
  ]);

  return (
    <div className={styles.container} id={`${id}-modern-scenario`}>
      {awaiting && scenario && (
        <Notice kind="stale" title="Confirm the what-if the agent prepared" announce={false}>
          {scenario.interpretedFrom && (
            <p className={styles.cardDesc}>“{scenario.interpretedFrom}”</p>
          )}
          <p className={styles.cardDesc}>
            Plans ignore it until you confirm. Check the values below first.
          </p>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => onSave({ ...scenario, confirmed: true })}
          >
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
                <Tooltip label="About quick scenarios">
                  Test changes to rainfall, supply and demand.
                </Tooltip>
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
                      <span className={styles.sliderLabel}>Rainfall Change</span>
                      <Tooltip label="About rainfall change">
                        More or less rainfall than the baseline year.
                      </Tooltip>
                    </div>
                    <span className={styles.sliderSub}>Explore wetter or drier conditions</span>
                  </div>
                </div>
                <div className={`${styles.sliderValueDisplay} ${styles.textBlue}`}>
                  {rainfallDrop > 0 ? '+' : ''}
                  {rainfallDrop}%
                </div>
                <div className={styles.rangeContainer}>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="1"
                    value={rainfallDrop}
                    onChange={(e) => setRainfallDrop(Number(e.target.value))}
                    aria-label="Rainfall percentage change"
                    className={`${styles.rangeInput} ${styles.rangeBlue}`}
                    style={{
                      background: `linear-gradient(to right, #0284c7 0%, #0284c7 ${
                        ((rainfallDrop + 40) / 80) * 100
                      }%, #e2e8f0 ${((rainfallDrop + 40) / 80) * 100}%, #e2e8f0 100%)`,
                    }}
                  />
                  <div className={styles.rangeTicks}>
                    <span>-40%</span>
                    <span>0%</span>
                    <span>+40%</span>
                  </div>
                </div>
              </div>

              {/* 2. Groundwater Change */}
              <div className={styles.sliderBox}>
                <div className={styles.sliderHead}>
                  <div className={`${styles.iconCircle} ${styles.iconGreen}`}>
                    <Icon name="groundwater" size="md" />
                  </div>
                  <div className={styles.sliderMeta}>
                    <div className={styles.sliderLabelRow}>
                      <span className={styles.sliderLabel}>Groundwater Change</span>
                      <Tooltip label="About groundwater decline">
                        Explore more or less groundwater availability.
                      </Tooltip>
                    </div>
                    <span className={styles.sliderSub}>
                      Higher or lower groundwater availability
                    </span>
                  </div>
                </div>
                <div className={`${styles.sliderValueDisplay} ${styles.textGreen}`}>
                  {groundwaterDrop > 0 ? '+' : ''}
                  {groundwaterDrop}%
                </div>
                <div className={styles.rangeContainer}>
                  <input
                    type="range"
                    min="-30"
                    max="30"
                    step="1"
                    value={groundwaterDrop}
                    onChange={(e) => setGroundwaterDrop(Number(e.target.value))}
                    aria-label="Groundwater availability percentage change"
                    className={`${styles.rangeInput} ${styles.rangeGreen}`}
                    style={{
                      background: `linear-gradient(to right, #16a34a 0%, #16a34a ${
                        ((groundwaterDrop + 30) / 60) * 100
                      }%, #e2e8f0 ${((groundwaterDrop + 30) / 60) * 100}%, #e2e8f0 100%)`,
                    }}
                  />
                  <div className={styles.rangeTicks}>
                    <span>-30%</span>
                    <span>0%</span>
                    <span>+30%</span>
                  </div>
                </div>
              </div>

              {/* 3. Tanker Supply Change */}
              <div className={styles.sliderBox}>
                <div className={styles.sliderHead}>
                  <div className={`${styles.iconCircle} ${styles.iconPurple}`}>
                    <Icon name="truck" size="md" />
                  </div>
                  <div className={styles.sliderMeta}>
                    <div className={styles.sliderLabelRow}>
                      <span className={styles.sliderLabel}>Tanker Supply Change</span>
                      <Tooltip label="About tanker supply">
                        Explore more or fewer tanker deliveries.
                      </Tooltip>
                    </div>
                    <span className={styles.sliderSub}>Higher or lower external supply</span>
                  </div>
                </div>
                <div className={`${styles.sliderValueDisplay} ${styles.textPurple}`}>
                  {tankerSupplyDrop > 0 ? '+' : ''}
                  {tankerSupplyDrop}%
                </div>
                <div className={styles.rangeContainer}>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={tankerSupplyDrop}
                    onChange={(e) => setTankerSupplyDrop(Number(e.target.value))}
                    aria-label="Tanker supply percentage change"
                    className={`${styles.rangeInput} ${styles.rangePurple}`}
                    style={{
                      background: `linear-gradient(to right, #9333ea 0%, #9333ea ${
                        ((tankerSupplyDrop + 100) / 200) * 100
                      }%, #e2e8f0 ${((tankerSupplyDrop + 100) / 200) * 100}%, #e2e8f0 100%)`,
                    }}
                  />
                  <div className={styles.rangeTicks}>
                    <span>-100%</span>
                    <span>0%</span>
                    <span>+100%</span>
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
                      <span className={styles.sliderLabel}>Population / Demand Change</span>
                      <Tooltip label="About urban expansion">
                        Explore higher or lower water demand.
                      </Tooltip>
                    </div>
                    <span className={styles.sliderSub}>
                      More or fewer residents, changing demand
                    </span>
                  </div>
                </div>
                <div className={`${styles.sliderValueDisplay} ${styles.textOrange}`}>
                  {urbanExpansion > 0 ? '+' : ''}
                  {urbanExpansion}%
                </div>
                <div className={styles.rangeContainer}>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    step="1"
                    value={urbanExpansion}
                    onChange={(e) => setUrbanExpansion(Number(e.target.value))}
                    aria-label="Population and demand percentage change"
                    className={`${styles.rangeInput} ${styles.rangeOrange}`}
                    style={{
                      background: `linear-gradient(to right, #ea580c 0%, #ea580c ${
                        ((urbanExpansion + 50) / 100) * 100
                      }%, #e2e8f0 ${((urbanExpansion + 50) / 100) * 100}%, #e2e8f0 100%)`,
                    }}
                  />
                  <div className={styles.rangeTicks}>
                    <span>-50%</span>
                    <span>0%</span>
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
                <Tooltip label="About custom scenarios">
                  Describe one change, such as 20% less rainfall.
                </Tooltip>
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
                onChange={(e) => {
                  setCustomPrompt(e.target.value);
                  setCustomFeedback(null);
                }}
                placeholder="E.g. 20% less rainfall or 15% more demand"
                aria-describedby={`${id}-custom-feedback`}
                aria-invalid={Boolean(customFeedback?.error)}
                disabled={pending}
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
              <button
                type="submit"
                className={styles.tryBtn}
                disabled={pending || !customPrompt.trim()}
              >
                Try This Scenario <Icon name="arrow-right" size="sm" />
              </button>
            </form>
            <div id={`${id}-custom-feedback`}>
              {customFeedback && (
                <p role={customFeedback.error ? 'alert' : 'status'} className={styles.cardDesc}>
                  {customFeedback.error ?? customFeedback.summary}
                </p>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Scenario Result */}
        <div className={styles.rightCol}>
          <section className={styles.resultCard} aria-label="Scenario Result">
            <div className={styles.resultHeadRow}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitleRow}>
                  <h2 className={styles.cardTitle}>Scenario Result</h2>
                  <Tooltip label="About scenario results">
                    A what-if estimate, not a forecast.
                  </Tooltip>
                </div>
                <p className={styles.cardDesc}>
                  Estimated impact on your community based on the changes above.
                </p>
              </div>
            </div>

            <Notice kind="caution" announce={false}>
              Illustrative local estimates. Groundwater and tanker effects are not supported by the
              calculation engine and are excluded from saved adjustments. Rainfall and demand
              changes are saved.
            </Notice>
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
                    <Tooltip label="About water deficit">
                      Daily demand not covered by supply.
                    </Tooltip>
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
                    <Tooltip label="About supply reliability">
                      Share of demand met by reliable local supply.
                    </Tooltip>
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
                    <Tooltip label="About tanker days">
                      Estimated days needing tanker deliveries each year.
                    </Tooltip>
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
                    <Tooltip label="About water stress">
                      An estimate of pressure on available water.
                    </Tooltip>
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

            {savedSuccess && (
              <div className={styles.savedBanner} role="status">
                <Icon name="check" size="sm" />
                <span>Scenario saved! Your future water assumptions have been recorded.</span>
              </div>
            )}

            {/* Action Buttons Row */}
            <div className={styles.actionButtonsRow}>
              {/* Analyse Scenario button */}
              <button
                type="button"
                className={styles.analyseBtn}
                onClick={handleAnalyseScenario}
                disabled={pending}
                aria-label="Analyse Scenario"
                title="Analyse scenario and proceed to goal setting"
              >
                <span>Analyse Scenario</span>
                <Icon name="arrow-right" size="sm" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
