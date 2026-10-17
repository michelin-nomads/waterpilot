import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CommunityMap } from './CommunityMap';
import type { CommunityItem } from './useCommunityDirectory';

vi.mock('../../config/env', () => ({
  env: { maps: { provider: 'google', apiKey: 'fake', mapId: 'fake' } },
}));
vi.mock('../location/googleMapsLoader', () => ({
  onAuthFailure: () => () => {},
  loadGoogleMaps: async () => ({
    importLibrary: async (name: string) =>
      name === 'maps'
        ? {
            InfoWindow: class {
              constructor(private options: { content: HTMLElement }) {}
              open({ map }: { map: { host: HTMLElement } }) {
                map.host.append(this.options.content);
              }
              close() {
                this.options.content.remove();
              }
            },
            Map: class {
              constructor(public host: HTMLElement) {}
              fitBounds() {}
            },
          }
        : {
            AdvancedMarkerElement: class {
              map: unknown;
              addListener() {
                return { remove() {} };
              }
              constructor({ map, content }: { map: { host: HTMLElement }; content: HTMLElement }) {
                this.map = map;
                map.host.append(content);
              }
            },
          },
  }),
}));

it('opens a map preview and routes Join through the existing callback, then reflects membership', async () => {
  const row: CommunityItem = {
    id: 'demo',
    name: 'DEMO · HSR circle',
    version: 1,
    description: 'Synthetic',
    areaId: 'area',
    status: 'ACTIVE',
    memberCount: 4,
    archivedAt: null,
    contactName: null,
    contactEmail: null,
    sharedReport: null,
    viewerMembership: null,
    area: {
      id: 'area',
      name: 'HSR',
      countryCode: 'IN',
      mapLatitude: '12.91',
      mapLongitude: '77.64',
    },
  };
  const onJoin = vi.fn();
  const props = {
    rows: [row],
    centre: null,
    radius: 5000,
    distanceMeters: () => 1200,
    joining: false,
    actionError: null,
    onJoin,
  };
  const { rerender } = render(
    <MemoryRouter>
      <CommunityMap {...props} isJoined={() => false} />
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'DEMO · HSR circle — show community on map' }),
  );
  const preview = screen.getByRole('region', { name: 'Community preview: DEMO · HSR circle' });
  expect(within(preview).getByText('1.2 km · 4 members')).toBeVisible();
  fireEvent.click(within(preview).getByRole('button', { name: 'Join community' }));
  expect(onJoin).toHaveBeenCalledExactlyOnceWith('demo');
  rerender(
    <MemoryRouter>
      <CommunityMap {...props} isJoined={() => true} />
    </MemoryRouter>,
  );
  expect(within(preview).getByRole('button', { name: 'Joined' })).toBeDisabled();
});
