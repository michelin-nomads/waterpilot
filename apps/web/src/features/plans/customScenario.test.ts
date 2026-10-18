import { expect, it } from 'vitest';
import { parseCustomScenario } from './customScenario';

it.each([
  ['20% less rainfall', 'rainfall', -20],
  ['20% more rainfall', 'rainfall', 20],
  ['20% more groundwater', 'groundwater', 20],
  ['20% less groundwater', 'groundwater', -20],
  ['20% more tanker supply', 'tanker', 20],
  ['20% less demand', 'population', -20],
  ['20% more urban expansion', 'population', 20],
  ['20% less urban expansion', 'population', -20],
  ['increase demand by 15 percent', 'population', 15],
  ['reduce tanker supply by 80%', 'tanker', -80],
])('uses the requested percentage: %s', (text, field, value) => {
  expect(parseCustomScenario(text)).toMatchObject({ field, value });
});
it.each([
  'hello',
  'less rain',
  'tanker supply stops for 30 days',
  '90% less rainfall',
  '20% less rain and 15% more demand',
])('rejects unsupported or ambiguous input without edits: %s', (text) => {
  expect(parseCustomScenario(text)).toHaveProperty('error');
});
