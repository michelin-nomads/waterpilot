import { describe, expect, it } from 'vitest';
import { agentNavigation } from './agentNavigation';
import type { SessionState } from '../../session/sessionState';

describe('agent navigation', () => {
  it.each([
    ['go back', '/scenarios', '/area'],
    ['go to location', '/scenarios', '/area'],
    ['could you please go to location?', '/scenarios', '/area'],
    ['go forward', '/area', undefined],
    ['next step', '/area', undefined],
  ])('handles %s without bypassing prerequisites', (text, current, target) => {
    expect(agentNavigation(text, current, null)?.path).toBe(target);
  });
  it('leaves scenario edits and explanations for the agent', () => {
    expect(agentNavigation('reduce rainfall by 20%', '/scenarios', null)).toBeNull();
    expect(agentNavigation('explain the next step', '/area', null)).toBeNull();
  });
  it('reports flow boundaries', () => {
    expect(agentNavigation('go back', '/area', null)?.message).toBe('You are at the first step.');
  });
  it('moves to the scenario for the reported conversational request', () => {
    const session = { areaId: 'area-1' } as SessionState;
    expect(agentNavigation('can we go to the next step?', '/area', session)?.path).toBe(
      '/scenarios',
    );
  });
  it('asks for the specific missing input instead of calling the model', () => {
    expect(agentNavigation('can we go to the next step?', '/area', null)?.message).toContain(
      'Confirm your location',
    );
    const session = { areaId: 'area-1' } as SessionState;
    expect(agentNavigation('next step', '/scenarios', session)?.message).toContain(
      'save your future scenario',
    );
  });
});
