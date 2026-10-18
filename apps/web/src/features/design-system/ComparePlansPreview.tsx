import { useState } from 'react';
import { Button, ButtonLink } from '../../components';
import { useNavigate } from 'react-router-dom';
import { LocationSummaryView } from '../location/LocationSummary';
import { PageHeader } from '../../shell/PageHeader';
import { PlanComparisonView, type Comparison } from '../plans/PlanComparisonView';
import type {
  AreaLocationFieldsFragment,
  ComparedOptionFieldsFragment,
} from '../../graphql/generated/graphql';
import styles from '../plans/Plans.module.scss';

const n = (value: string) => ({ exact: value, value });
function example(
  rank: number,
  name: string,
  cost: string,
  days: [number, number],
  outcome: [string, string],
  measures: string[],
): ComparedOptionFieldsFragment {
  const id = `preview_${rank}`;
  return {
    id,
    rank,
    name,
    interventionIds: measures,
    why: 'Illustrative ordering for this UI preview.',
    tradeoffs: ['Implementation and benefits depend on site suitability and local conditions.'],
    uncertainty: [
      'All figures in this preview are illustrative, not a recommendation or a site assessment.',
    ],
    firstBenefit: rank === 2 ? 'AFTER_RAINFALL' : 'AFTER_COMMISSIONING',
    pessimistic: n(outcome[0]),
    optimistic: n(outcome[1]),
    margin: n(String(50 - Number(outcome[0]))),
    waterLow: null,
    waterHigh: null,
    uncountedHigh: null,
    cost: {
      low: { minorUnits: cost, currency: 'INR', exponent: 2 },
      high: { minorUnits: cost, currency: 'INR', exponent: 2 },
    },
    buildDays: { low: days[0], high: days[1] },
    measures: measures.map((name, index) => ({
      interventionId: `${id}_${index}`,
      name,
      benefitTiming: 'AFTER_COMMISSIONING',
      effects: [],
      waterLow: null,
      waterHigh: null,
      cost: null,
      recurring: null,
      buildDays: null,
    })),
    sensitivity: [],
    stress: [],
    economics: null,
    impact: {
      id: `impact_${id}`,
      engineVersion: 'design-preview',
      catalogueVersion: 'design-preview',
      inputHash: 'preview',
      localBenefits: [],
      externalities: [],
      falseResilience: [],
      tradeoffs: [],
      reviews: [],
    },
  };
}
const sample: Comparison = {
  id: 'comparison_preview',
  engineVersion: 'design-preview',
  scenarioEngineVersion: 'design-preview',
  catalogueVersion: 'design-preview',
  baselineId: null,
  status: 'OPTIONS',
  summary:
    'Three illustrative combinations show the balance between investment, delivery time and fewer shortage days.',
  metric: 'SHORTAGE_DAYS',
  unit: 'DAY',
  needs: [],
  excluded: [],
  assumptions: ['Preview values only.'],
  ranking: 'Illustrative ordering balancing cost, time and outcome.',
  maxOptions: 3,
  stressTests: [],
  baselineValue: n('74'),
  scenarioValue: n('74'),
  targetLevel: n('50'),
  rejections: {
    evaluated: 3,
    onlyOptimistic: 0,
    missedTarget: 0,
    overBudget: 0,
    budgetUncertain: 0,
    tooSlow: 0,
    timeUncertain: 0,
    notMinimal: 0,
    truncated: false,
  },
  options: [
    example(
      1,
      'Balanced plan',
      '82000000',
      [45, 60],
      ['47', '42'],
      ['Rainwater harvesting', 'Leak detection & repair'],
    ),
    example(
      2,
      'Lower cost plan',
      '42000000',
      [30, 45],
      ['49', '45'],
      ['Rooftop rainwater harvesting'],
    ),
    example(
      3,
      'Higher impact plan',
      '128000000',
      [60, 90],
      ['25', '20'],
      ['Rainwater harvesting', 'Groundwater recharge', 'Water reuse'],
    ),
  ],
  impactEngineVersion: 'design-preview',
  impactContext: {
    areaName: 'Koramangala, Bengaluru',
    nearbyRadiusM: 5000,
    groundwater: 'UNKNOWN',
    groundwaterCitations: [],
    waterQuality: [],
    waterQualityNote: 'No water-quality assessment is included in this design preview.',
    boundaries: [],
    nearby: [],
    unavailable: [
      {
        key: 'neighbour_effects',
        label: 'Neighbourhood effects',
        reason: 'No reviewed local assessment is connected to this preview.',
      },
    ],
  },
};

const previewArea: AreaLocationFieldsFragment = {
  id: 'design-preview-area',
  name: 'Koramangala',
  centroidLat: '12.9352',
  centroidLon: '77.6245',
  countryCode: 'IN',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  unitSystem: 'METRIC',
  regionSetByUser: [],
  evidence: 'SYNTHETIC',
  origin: 'PLACE_SEARCH',
  scope: 'SUBLOCALITY',
  extent: 'USER_RADIUS',
  radiusMeters: 1000,
  private: false,
  formattedAddress: 'Koramangala, Bengaluru, Karnataka, India',
  accuracyMeters: null,
  hasBoundary: true,
  providerContentExpired: false,
  admin: {
    countryName: 'India',
    admin1: 'Karnataka',
    admin2: null,
    locality: 'Bengaluru',
    sublocality: 'Koramangala',
  },
};

/** Local-only design fixture: no API requests, session writes or finalization. */
export default function ComparePlansPreview() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [continued, setContinued] = useState(false);
  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Step 4 of 5 · Design preview"
        title="Compare plans"
        subtitle="Explore the balance between cost, implementation time and water impact."
      />
      <LocationSummaryView area={previewArea} onChange={() => navigate('/area')} compact />
      <PlanComparisonView
        comparison={sample}
        selectedId={selectedId}
        busy={false}
        onChoose={(id) => {
          setSelectedId(id);
          setContinued(false);
        }}
      />
      <div className={styles.selectionFooter}>
        <ButtonLink to="/goals" variant="ghost">
          Back
        </ButtonLink>
        <div className={styles.selectionActions}>
          <div>
            <span className={styles.muted}>Your selection</span>
            <strong>
              {sample.options.find((o) => o.id === selectedId)?.name ??
                'Choose a plan when you’re ready'}
            </strong>
          </div>
          <Button endIcon="arrow-right" disabled={!selectedId} onClick={() => setContinued(true)}>
            Proceed with selected plan
          </Button>
        </div>
      </div>
      <p className={styles.muted}>Design preview · sample figures only.</p>
      {continued && (
        <p role="status" className={styles.muted}>
          Selection confirmed for this preview. Your planning session has not been changed.
        </p>
      )}
    </div>
  );
}
