import { Tooltip } from '../../components';
import type { Place } from './types';

/** Show the beginning of the returned address; the full address remains available on hover,
 * focus, or tap without turning the planning card into an address block.
 */
export function LocationName({
  name,
  admin,
  fullAddress,
  testId,
}: {
  name: string;
  admin: Place['admin'];
  fullAddress?: string | null;
  testId?: string;
}) {
  const shortName = (fullAddress?.trim() || name).split(',').slice(0, 2).join(',').trim();
  const address =
    fullAddress ??
    [...new Set([name, admin.admin2, admin.admin1, admin.countryName].filter(Boolean))].join(', ');
  return (
    <Tooltip label={shortName} trigger={<span data-testid={testId}>{shortName}</span>}>
      {address}
    </Tooltip>
  );
}
