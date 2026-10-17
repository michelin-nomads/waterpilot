import { useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import {
  Button,
  ButtonLink,
  Drawer,
  LoadingRegion,
  Notice,
  Skeleton,
  StepActions,
} from '../../components';
import { usePlanningSession } from '../../session/sessionContext';
import { LocationSummary } from '../location/LocationSummary';
import { StagePage } from '../planning/StagePage';
import { BaselinePanel } from './BaselinePanel';
import { BaselineCoverageDrawer } from './BaselineCoverageDrawer';
import { PopulationEstimateHelper } from './PopulationEstimate';
import styles from './BaselinePage.module.scss';
import { ReadinessPanel } from './ReadinessPanel';
import { AreaAssumptionPreview } from './AreaAssumptionPreview';

/** One route-owned Baseline flow. Hidden input panels retain in-progress edits on Back. */
export default function BaselinePage() {
  const { section = 'community' } = useParams();
  const { state, view, inputsPending } = usePlanningSession();
  const navigate = useNavigate();
  const [coverageOpen, setCoverageOpen] = useState(false);
  const saving = useIsMutating() > 0 || inputsPending;
  if (!['community', 'inputs', 'overview', 'estimate'].includes(section))
    return <Navigate to="/baseline" replace />;
  if (state.status === 'loading')
    return (
      <LoadingRegion label="Loading your baseline">
        <Skeleton />
      </LoadingRegion>
    );
  const areaId = view?.areaId;
  const saved = areaId && state.server?.areaId === areaId;
  return (
    <StagePage
      stageId="baseline"
      title={
        section === 'estimate'
          ? 'Estimate your community baseline'
          : section === 'community'
            ? 'Build your community baseline'
            : section === 'inputs'
              ? 'Build your water baseline'
              : 'Your water baseline'
      }
      subtitle={
        section === 'estimate'
          ? 'Use explicit household and daily-use assumptions. Accepted values stay labelled as estimates.'
          : section === 'community'
            ? 'Record the community water figures you know. Missing information stays unknown.'
            : section === 'inputs'
              ? 'Add water supply values with their source and exact unit.'
              : 'Review demand, supply, assumptions and data coverage for this area.'
      }
    >
      {!areaId ? (
        <Notice kind="info" title="Choose a location first">
          Your existing plan is kept. <ButtonLink to="/area">Choose location</ButtonLink>
        </Notice>
      ) : !saved ? (
        <Notice kind="stale">
          Save your location change before continuing with this baseline.
        </Notice>
      ) : (
        <>
          {section !== 'overview' && (
            <LocationSummary areaId={areaId} onChange={() => navigate('/area')} />
          )}
          <nav aria-label="Baseline sections">
            <Button
              variant="ghost"
              disabled={saving}
              aria-current={section === 'community' ? 'step' : undefined}
              onClick={() => navigate('/baseline')}
            >
              Community inputs
            </Button>
            <Button
              variant="ghost"
              disabled={saving}
              aria-current={section === 'inputs' ? 'step' : undefined}
              onClick={() => navigate('/baseline/inputs')}
            >
              Water inputs
            </Button>
            <Button
              variant="ghost"
              disabled={saving}
              aria-current={section === 'overview' ? 'step' : undefined}
              onClick={() => navigate('/baseline/overview')}
            >
              Overview
            </Button>
          </nav>
          {section === 'overview' && (
            <Button variant="secondary" onClick={() => setCoverageOpen(true)}>
              Data coverage and sources
            </Button>
          )}
          {section === 'estimate' && (
            <>
              <PopulationEstimateHelper sessionId={view.id} />
              {state.server && (
                <AreaAssumptionPreview key={state.server.id} session={state.server} />
              )}
            </>
          )}
          {section !== 'estimate' && (
            <div hidden={section !== 'community'}>
              <h2>Community baseline inputs</h2>
              <p>
                Enter supported population and demand values with a source and date. Do not estimate
                a missing value unless you can state its basis.
              </p>
              <ReadinessPanel areaId={areaId} sessionId={view.id} section="community" />
            </div>
          )}
          {section !== 'estimate' && (
            <div hidden={section !== 'inputs'}>
              <h2>Water sources and supply</h2>
              <p>
                Enter known delivered or tanker supply with its source and date. Missing values
                remain unknown, and exact units and provenance are preserved.
              </p>
              <Notice
                kind="partial"
                title="Missing does not mean zero"
                announce={false}
                action={
                  <Button variant="secondary" size="sm" onClick={() => setCoverageOpen(true)}>
                    View data availability
                  </Button>
                }
              >
                WaterLens leaves unprovided values unknown. Review available sources and assumptions
                before continuing.
              </Notice>
              <ReadinessPanel areaId={areaId} sessionId={view.id} section="inputs" />
            </div>
          )}
          {section === 'overview' && (
            <div className={styles.overviewLayout}>
              <div className={styles.overviewMain}>
                <BaselinePanel showActions={false} areaId={areaId} sessionId={view.id} />
                <ReadinessPanel areaId={areaId} sessionId={view.id} section="overview" />
              </div>
              <aside className={styles.overviewContext} aria-label="Location context">
                <LocationSummary
                  areaId={areaId}
                  actionLabel="Edit"
                  onChange={() => navigate('/area')}
                />
              </aside>
            </div>
          )}
          {section !== 'estimate' && (
            <StepActions
              primary={
                section !== 'overview' ? (
                  <Button
                    disabled={saving}
                    onClick={() =>
                      navigate(section === 'community' ? '/baseline/inputs' : '/baseline/overview')
                    }
                  >
                    Continue
                  </Button>
                ) : (
                  <Button disabled={saving} onClick={() => navigate('/goals')}>
                    Continue to goal
                  </Button>
                )
              }
              secondary={
                <Button
                  variant="secondary"
                  disabled={saving}
                  onClick={() =>
                    navigate(
                      section === 'community'
                        ? '/area'
                        : section === 'inputs'
                          ? '/baseline'
                          : '/baseline/inputs',
                    )
                  }
                >
                  Back
                </Button>
              }
            />
          )}
          <Drawer
            open={coverageOpen}
            onClose={() => setCoverageOpen(false)}
            title="Data coverage and sources"
            description="See which evidence, dates, resolution and limitations support this baseline."
            size="lg"
            footer={
              <Button variant="secondary" onClick={() => setCoverageOpen(false)}>
                Close
              </Button>
            }
          >
            <BaselineCoverageDrawer areaId={areaId} sessionId={view.id} />
          </Drawer>
        </>
      )}
    </StagePage>
  );
}
