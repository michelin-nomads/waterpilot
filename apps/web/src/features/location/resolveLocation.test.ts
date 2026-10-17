import { resolveLocation } from './resolveLocation';
import type { Place } from './types';

const point: Place = {
  placeId: '',
  name: 'Selected map location',
  formattedAddress: null,
  latitude: '12.8676256',
  longitude: '77.6838009',
  countryCode: null,
  scope: 'POINT',
  types: [],
  admin: { countryName: null, admin1: null, admin2: null, locality: null, sublocality: null },
};

describe('coordinate country resolution', () => {
  it.each(['unavailable', 'empty', 'missing country'])(
    'preserves the device fix when geocoding is %s',
    async (failure) => {
      const reverse = vi.fn(() =>
        failure === 'unavailable'
          ? Promise.reject(new Error('REQUEST_DENIED'))
          : Promise.resolve(failure === 'empty' ? [] : [point]),
      );
      expect(await resolveLocation({ reverse }, point, 'GEOLOCATION')).toMatchObject({
        latitude: point.latitude,
        longitude: point.longitude,
        countryCode: 'IN',
        name: 'Location name unavailable',
        admin: { countryName: 'India' },
      });
    },
  );

  it.each([
    ['-12.0464', '-77.0428', 'PE'],
    ['-1.2864', '36.8172', 'KE'],
    ['40.7128', '-74.0060', 'US'],
    ['54.2', '-4.5', 'IM'],
  ])('resolves latitude %s and longitude %s to %s', async (latitude, longitude, countryCode) => {
    const result = await resolveLocation(
      { reverse: async () => [] },
      { ...point, latitude, longitude },
      'CUSTOM',
    );
    expect(result).toMatchObject({ latitude, longitude, countryCode });
  });

  it.each([
    ['0', '0'],
    ['NaN', '0'],
    ['91', '0'],
    ['', '0'],
  ])('does not invent a country for %s, %s', async (latitude, longitude) => {
    expect(
      await resolveLocation(
        { reverse: async () => [] },
        { ...point, latitude, longitude },
        'CUSTOM',
      ),
    ).toBeNull();
  });

  it('prefers provider country and local name without moving the point', async () => {
    const result = await resolveLocation(
      {
        reverse: async () => [
          {
            ...point,
            latitude: '13',
            longitude: '77',
            name: 'Bengaluru',
            countryCode: 'IN',
          },
        ],
      },
      point,
      'GEOLOCATION',
    );
    expect(result).toMatchObject({
      name: 'Bengaluru',
      latitude: point.latitude,
      longitude: point.longitude,
    });
  });
});
