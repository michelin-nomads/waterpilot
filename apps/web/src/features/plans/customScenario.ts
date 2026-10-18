export type CustomScenarioResult =
  | { field: 'rainfall' | 'groundwater' | 'tanker' | 'population'; value: number; summary: string }
  | { error: string };

/** Only interprets changes represented by the existing controls; never invents inputs. */
export function parseCustomScenario(text: string): CustomScenarioResult {
  const query = text.trim().toLowerCase();
  if (/\b(?:days?|weeks?|months?|years?)\b/.test(query))
    return { error: 'Duration-based scenarios are not supported here. Try “20% less rainfall”.' };
  const fields = [
    {
      field: 'rainfall' as const,
      pattern: /\b(?:rainfall|rain|monsoon)\b/,
      max: 40,
      label: 'Rainfall',
    },
    {
      field: 'groundwater' as const,
      pattern: /\b(?:groundwater|borewell)\b/,
      max: 30,
      label: 'Groundwater',
    },
    { field: 'tanker' as const, pattern: /\btankers?\b/, max: 100, label: 'Tanker supply' },
    {
      field: 'population' as const,
      pattern: /\b(?:population|residents|urban expansion|demand)\b/,
      max: 50,
      label: 'Population / demand',
    },
  ].filter((item) => item.pattern.test(query));
  if (fields.length !== 1)
    return {
      error: 'Describe one change at a time, for example “20% less rainfall” or “15% more demand”.',
    };
  const item = fields[0];
  const values = [...query.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:%|percent\b)/g)];
  if (values.length !== 1)
    return { error: 'Include one percentage, for example “20% less rainfall”.' };
  const percentage = Number(values[0][1]);
  const increase =
    /\b(?:more|increase|increases|increased|higher|grow|grows|growth|rise|rises)\b/.test(query);
  const decrease =
    /\b(?:less|decrease|decreases|decreased|lower|reduce|reduces|reduced|reduction|drop|drops|fall|falls|down)\b/.test(
      query,
    );
  if (increase === decrease)
    return { error: 'Specify more or less, for example “20% more tanker supply”.' };
  if (!Number.isInteger(percentage) || percentage < 0 || percentage > item.max)
    return { error: `${item.label} supports whole percentages from 0% to ${item.max}%.` };
  return {
    field: item.field,
    value: increase ? percentage : -percentage,
    summary: `${item.label}: ${percentage}% ${increase ? 'increase' : 'reduction'}. Other controls are unchanged.`,
  };
}
