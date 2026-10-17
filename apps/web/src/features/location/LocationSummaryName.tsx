import { useQuery } from '@tanstack/react-query';
import type { AreaLocationFieldsFragment } from '../../graphql/generated/graphql';
import { Button } from '../../components';
import { LocationName } from './LocationName';
import { placeName } from './locationLabels';
import { usePlaces } from './placesContext';
import styles from './Location.module.scss';

/** Refresh legacy device labels from their saved point, without altering the area. */
export function LocationSummaryName({
  area,
  onChange,
}: {
  area: AreaLocationFieldsFragment;
  onChange: () => void;
}) {
  const adapter = usePlaces();
  const generic = [
    'Device location',
    'My device location',
    'Selected map location',
    'Location name unavailable',
  ].includes(area.name);
  const storedName = generic ? placeName({ ...area, name: 'Unnamed place' }) : area.name;
  const lookup = useQuery({
    queryKey: ['areas', area.id, 'resolved-name', area.centroidLat, area.centroidLon],
    enabled: !storedName,
    queryFn: async () => {
      const results = await adapter.reverse(area.centroidLat, area.centroidLon);
      const place = results.find((result) => placeName(result));
      return place
        ? { name: placeName(place)!, fullAddress: place.formattedAddress, admin: place.admin }
        : null;
    },
    retry: false,
    staleTime: 5 * 60_000,
  });
  const details = storedName
    ? { name: storedName, fullAddress: area.formattedAddress, admin: area.admin }
    : lookup.data;
  const name = details?.name;
  return (
    <>
      <h2 id="location-summary-title" className={styles.title}>
        {details ? (
          <LocationName
            name={details.name}
            fullAddress={details.fullAddress}
            admin={details.admin}
            testId="summary-name"
          />
        ) : lookup.isFetching ? (
          'Finding location name…'
        ) : (
          'Place name not loaded'
        )}
      </h2>
      {!name && !lookup.isFetching && (
        <p className={styles.nameStatus}>
          <Button variant="ghost" size="sm" onClick={() => void lookup.refetch()}>
            Retry lookup
          </Button>
          <Button variant="ghost" size="sm" onClick={onChange}>
            Search for a place
          </Button>
        </p>
      )}
    </>
  );
}
