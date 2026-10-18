import { expect, it } from 'vitest';
import type { SessionState } from '../../session/sessionState';
import { agentSuggestions } from './agentSuggestions';

it.each([
  ['UNDERSTAND', /selected location/],
  ['SCENARIO', /future demand/],
  ['GOAL', /choose a water security goal/],
  ['COMPARE', /tradeoffs/],
  ['MAKE_IT_HAPPEN', /funding eligibility/],
  ['REVIEW', /finalizing/],
])(
  'follows the current six-step page %s without requiring hidden baseline review',
  (stage, expected) => {
    const session = { areaId: 'area_1', baselineReviewed: false } as SessionState;
    const text = agentSuggestions(session, stage as SessionState['stage']).join(' ');
    expect(text).toMatch(expected);
    expect(text).not.toMatch(/review baseline|continue to baseline/i);
  },
);
it('starts with location and then scenario when no explicit page is supplied', () => {
  expect(agentSuggestions(null).join(' ')).toMatch(/choose a location/);
  expect(agentSuggestions({ areaId: 'area_1' } as SessionState).join(' ')).toMatch(/scenario/);
});
