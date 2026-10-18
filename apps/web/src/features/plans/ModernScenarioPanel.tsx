import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, useEffect, useMemo, type FormEvent } from 'react';

import { Button, Icon, Notice } from '../../components';
import { graphqlRequest } from '../../graphql/client';
import {
  PreviewScenarioDocument,
  type ScenarioAdjustmentInput,
  type ScenarioComparisonFieldsFragment,
} from '../../graphql/generated/graphql';
import { ScenarioRows } from './ScenarioRows';
import { queryKeys } from '../../graphql/queryKeys';
import type { SessionState } from '../../session/sessionState';
import styles from './ScenarioModern.module.scss';

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
  const [quickEdited, setQuickEdited] = useState(false);
  const storedPercent = (parameter: string, change: string, fallback: number) => {
    if (!scenario) return fallback;
    const item = (scenario.adjustments ?? []).find(
      (entry) =>
        entry.parameter === parameter && entry.change === change && entry.quantity.unit === 'RATIO',
    );
    return item ? Number(item.quantity.value) * 100 : 0;
  };
  const [rainfallDrop, setRainfallDrop] = useState(
    () => -storedPercent('rainfall', 'DECREASE_BY', 20),
  ); // -40% to 0%
  const [groundwaterDrop, setGroundwaterDrop] = useState(scenario ? 0 : -10); // -30% to 0%
  const [tankerSupplyDrop, setTankerSupplyDrop] = useState(scenario ? 0 : -50); // -100% to 0%
  const [urbanExpansion, setUrbanExpansion] = useState(() =>
    storedPercent('demand', 'INCREASE_BY', 15),
  ); // 0% to +50%

  // Custom prompt input
  const [customPrompt, setCustomPrompt] = useState('');
  const [interpretedNote, setInterpretedNote] = useState<string | null>(
    scenario?.interpretedFrom ?? null,
  );

  // Save scenario success feedback state

  // Derive engine adjustments from slider values
  const currentAdjustments = useMemo<ScenarioAdjustmentInput[]>(() => {
    if (scenario && !quickEdited) return scenario.adjustments ?? [];
    const list: ScenarioAdjustmentInput[] = [];
    if (rainfallDrop < 0) {
      list.push({
        parameter: 'rainfall',
        change: 'DECREASE_BY',
        quantity: { value: (Math.abs(rainfallDrop) / 100).toFixed(2), unit: 'RATIO' },
      });
    }
    // Groundwater level and tanker changes have no supported engine parameter yet.
    // Never reinterpret them as changes to piped supply.
    if (urbanExpansion > 0) {
      list.push({
        parameter: 'demand',
        change: 'INCREASE_BY',
        quantity: { value: (urbanExpansion / 100).toFixed(2), unit: 'RATIO' },
      });
    }
    return list;
  }, [rainfallDrop, urbanExpansion, scenario, quickEdited]);

  const awaiting = saved.status === 'awaiting_confirmation';

  const adjustmentKey = JSON.stringify(currentAdjustments);
  const savedSuccess =
    !pending &&
    Boolean(scenario?.confirmed) &&
    JSON.stringify(scenario?.adjustments ?? []) === adjustmentKey;
  const [preview, setPreview] = useState<{
    key: string;
    comparison: ScenarioComparisonFieldsFragment | null;
    error: string;
  } | null>(null);
  const previewComparison = preview?.key === adjustmentKey ? preview.comparison : null;
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void client
        .fetchQuery({
          queryKey: queryKeys.sessions.scenarioPreview(sessionId, revision, adjustmentKey),
          queryFn: ({ signal }) =>
            graphqlRequest(
              PreviewScenarioDocument,
              { sessionId, scenario: { adjustments: currentAdjustments } },
              { signal },
            ),
        })
        .then((result) => {
          if (!cancelled)
            setPreview({
              key: adjustmentKey,
              comparison: result.previewScenario.errors.length
                ? null
                : (result.previewScenario.comparison ?? null),
              error: result.previewScenario.errors.map((error) => error.message).join(' '),
            });
        })
        .catch(() => {
          if (!cancelled)
            setPreview({
              key: adjustmentKey,
              comparison: null,
              error: 'Scenario results could not load. Adjust an input or retry.',
            });
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, adjustmentKey, currentAdjustments, revision, sessionId]);

  // Save scenario to session with visual feedback
  function handleSaveScenario() {
    onSave(
      currentAdjustments.length
        ? {
            adjustments: currentAdjustments,
            interpretedFrom: interpretedNote,
            confirmed: true,
          }
        : {
            adjustments: [],
            interpretedFrom: interpretedNote,
            confirmed: true,
          },
    );
  }

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
    const query = customPrompt.trim().toLowerCase();
    setQuickEdited(true);
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
                      <span
                        className={styles.infoIcon}
                        title="Less monsoon and dry weather periods"
                      >
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
                    onChange={(e) => {
                      setQuickEdited(true);
                      setRainfallDrop(Number(e.target.value));
                    }}
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
                      <span
                        className={styles.infoIcon}
                        title="Deeper borewells and lower aquifer yield"
                      >
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
                    onChange={(e) => {
                      setQuickEdited(true);
                      setGroundwaterDrop(Number(e.target.value));
                    }}
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
                      <span
                        className={styles.infoIcon}
                        title="Reduction in external water deliveries"
                      >
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
                    onChange={(e) => {
                      setQuickEdited(true);
                      setTankerSupplyDrop(Number(e.target.value));
                    }}
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
                      <span
                        className={styles.infoIcon}
                        title="Increased population and water demand"
                      >
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
                    onChange={(e) => {
                      setQuickEdited(true);
                      setUrbanExpansion(Number(e.target.value));
                    }}
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
                  Calculated from saved area data. Unsupported or missing evidence remains unknown.
                </p>
              </div>
            </div>

            {(groundwaterDrop !== 0 || tankerSupplyDrop !== 0) && (
              <Notice kind="caution">
                Groundwater-level and tanker-supply slider effects are not supported by the
                calculation engine yet. They are excluded from these results and saved adjustments.
              </Notice>
            )}
            {previewComparison ? (
              <ScenarioRows comparison={previewComparison} />
            ) : preview?.key === adjustmentKey && preview.error ? (
              <Notice kind="caution">{preview.error}</Notice>
            ) : (
              <p role="status">Calculating scenario from saved area data…</p>
            )}
            {scenario && !quickEdited && (
              <p>
                Showing your saved scenario. Moving a quick-scenario slider starts a new example;
                review it before saving.
              </p>
            )}

            {savedSuccess && (
              <div className={styles.savedBanner} role="status">
                <Icon name="check" size="sm" />
                <span>Scenario saved! Your future water assumptions have been recorded.</span>
              </div>
            )}

            {/* Action Buttons Row */}
            <div className={styles.actionButtonsRow}>
              {/* Save Scenario button */}
              <button
                type="button"
                className={`${styles.saveBtn} ${savedSuccess ? styles.saveBtnSuccess : ''}`}
                onClick={handleSaveScenario}
                disabled={pending || !previewComparison}
                aria-label="Save Scenario"
                title="Save this scenario to your planning session"
              >
                <Icon name={savedSuccess ? 'check' : 'chart'} size="sm" />
                <span>{savedSuccess ? 'Scenario Saved!' : 'Save Scenario'}</span>
              </button>

              {/* Analyse Scenario button */}
              <button
                type="button"
                className={styles.analyseBtn}
                onClick={handleAnalyseScenario}
                disabled={pending || !previewComparison}
                aria-label="Analyse Scenario"
                title="Analyse scenario and proceed to goal setting"
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
    </div>
  );
}
