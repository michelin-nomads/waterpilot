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
import { CommunityBaselineForm } from './CommunityBaselineForm';
import { CommunityBaselineOverview } from './CommunityBaselineOverview';
import type { CommunityBaselineInput } from '../../graphql/generated/graphql';
import { BaselineCoverageDrawer } from './BaselineCoverageDrawer';
import styles from './BaselinePage.module.scss';

/** Community details and its saved overview remain inside the Baseline planning stage. */
export default function BaselinePage() {
  const { section = 'community' } = useParams();
  const { state, view, inputsPending, coordinator } = usePlanningSession();
  const navigate = useNavigate();
  const [estimating, setEstimating] = useState(section === 'estimate');
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const saving = useIsMutating() > 0 || inputsPending || completing;
  async function saveBaseline(data: CommunityBaselineInput, homes: number | null) {
    if (!coordinator) throw new Error('Session unavailable');
    coordinator.setCommunityBaseline(data, {
      communityType: view?.siteProfile?.communityType ?? null,
      occupiedHomes: homes,
    });
    await coordinator.flush();
    if (coordinator.getState().message || Object.keys(coordinator.getState().pending).length)
      throw new Error('Save incomplete');
    navigate('/baseline/overview');
  }
  async function completeBaseline() {
    if (!coordinator) return;
    setCompleting(true);
    try {
      coordinator.markBaselineReviewed();
      await coordinator.flush();
      if (coordinator.getState().server?.baselineReviewed) navigate('/scenarios');
    } finally {
      setCompleting(false);
    }
  }
  if (!['community', 'inputs', 'overview', 'estimate'].includes(section))
    return <Navigate to="/baseline" replace />;
  if (state.status === 'loading')
    return (
      <LoadingRegion label="Loading your baseline">
        <Skeleton />
      </LoadingRegion>
    );
  if (section === 'inputs') return <Navigate to="/baseline" replace />;
  const areaId = view?.areaId;
  const saved = areaId && state.server?.areaId === areaId;
  return (
    <div className={`${styles.baseline} ${section === 'overview' ? styles.review : ''}`}>
      <StagePage
        stageId="baseline"
        title={section === 'overview' ? 'Your water baseline' : 'Build your community baseline'}
        subtitle={
          section === 'overview'
            ? 'Review daily use, supply and the gap before choosing a goal.'
            : 'Tell us about your community and the water figures you know. Missing information stays unknown.'
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
              <LocationSummary compact areaId={areaId} onChange={() => navigate('/area')} />
            )}
            {section !== 'overview' ? (
              <CommunityBaselineForm
                key={`${areaId}:${JSON.stringify(view.communityBaseline ?? null)}`}
                onReview={saveBaseline}
                saving={saving}
                estimating={estimating}
                onEstimateChange={setEstimating}
              />
            ) : (
              <>
                <div className={styles.overviewLayout}>
                  <LocationSummary
                    compact
                    areaId={areaId}
                    actionLabel="Edit location"
                    onChange={() => navigate('/area')}
                  />
                  <CommunityBaselineOverview
                    areaId={areaId}
                    sessionId={view.id}
                    onCoverage={() => setCoverageOpen(true)}
                  />
                </div>
                <StepActions
                  primary={
                    <Button disabled={saving} onClick={() => void completeBaseline()}>
                      Continue to scenario
                    </Button>
                  }
                  secondary={
                    <Button
                      variant="secondary"
                      disabled={saving}
                      onClick={() => navigate('/baseline')}
                    >
                      Edit community details
                    </Button>
                  }
                />
              </>
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
    </div>
  );
}
