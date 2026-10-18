import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { SessionState } from '../../session/sessionState';
import {
  planningInteraction,
  publishLocationInteraction,
  useLocationInteraction,
} from './planningInteraction';

it('shares temporary candidates only within their session without treating them as saved', () => {
  const one = renderHook(() => useLocationInteraction('one'));
  const two = renderHook(() => useLocationInteraction('two'));
  act(() =>
    publishLocationInteraction('one', { status: 'suggested', candidateName: 'Example society' }),
  );
  expect(one.result.current.status).toBe('suggested');
  expect(two.result.current.status).toBe('absent');
  const saved = { id: 'one', areaId: null, stage: 'UNDERSTAND' } as SessionState;
  const state = planningInteraction(saved, 'UNDERSTAND', one.result.current, true);
  expect(state.nextRequirement).toBe('confirm-location');
  expect(state.inputs).toBe('pending');
  expect(saved.areaId).toBeNull();
  act(() => publishLocationInteraction('one', null));
  expect(one.result.current.status).toBe('absent');
});
