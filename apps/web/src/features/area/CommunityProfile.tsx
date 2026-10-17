import type { ChangeEvent } from 'react';

import { Field, Select } from '../../components';
import type { CommunityType } from '../../graphql/generated/graphql';
import { usePlanningSession } from '../../session/sessionContext';
import { COMMUNITY_TYPE_LABEL } from '../workspace/reportLabels';

const TYPES = Object.keys(COMMUNITY_TYPE_LABEL) as CommunityType[];

/**
 * What kind of community this plan is for. It only describes the plan (it shows on the
 * report card) and never feeds a result, so leaving it unstated is fine.
 */
export function CommunityProfile() {
  const { coordinator, view } = usePlanningSession();
  const profile = view?.siteProfile ?? null;

  const change = (event: ChangeEvent<HTMLSelectElement>) => {
    const communityType = (event.target.value || null) as CommunityType | null;
    coordinator?.setSiteProfile({ communityType, occupiedHomes: profile?.occupiedHomes ?? null });
  };

  return (
    <Field
      id="community-type"
      label="Community type"
      hint="Shown on your report. It does not change any result."
    >
      {(props) => (
        <Select {...props} value={profile?.communityType ?? ''} onChange={change}>
          <option value="">Not stated</option>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {COMMUNITY_TYPE_LABEL[type]}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
