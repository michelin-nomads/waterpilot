import { fireEvent, render, screen } from '@testing-library/react';
import { LocationName } from './LocationName';

const admin = {
  sublocality: 'HSR Layout',
  locality: 'Bengaluru',
  admin1: 'Karnataka',
  admin2: null,
  countryName: 'India',
};
const address = 'HSR Layout, Bengaluru, Karnataka 560102, India';

it('keeps neighbourhood and city short, exposing the full address on hover and focus', () => {
  render(<LocationName name={address} fullAddress={address} admin={admin} />);
  const trigger = screen.getByRole('button', { name: /^HSR Layout, Bengaluru$/ });
  const tip = screen.getByRole('tooltip', { hidden: true });
  expect(trigger).toHaveAccessibleDescription(address);
  expect(tip).not.toBeVisible();
  fireEvent.mouseEnter(trigger.parentElement!);
  expect(tip).toBeVisible();
  fireEvent.mouseLeave(trigger.parentElement!);
  expect(tip).not.toBeVisible();
  fireEvent.focus(trigger);
  expect(tip).toBeVisible();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(tip).not.toBeVisible();
});

it('shortens a searched address without administrative components', () => {
  render(
    <LocationName
      name={address}
      fullAddress={address}
      admin={{ ...admin, sublocality: null, locality: null }}
    />,
  );
  expect(
    screen.getByRole('button', { name: /^HSR Layout, Bengaluru$/ }),
  ).toHaveAccessibleDescription(address);
});

it('shows the building and beginning of the address instead of replacing them with locality names', () => {
  const fullAddress =
    'Parkway Homes by SJR Primecorp, Rayasandra Main Rd, Rayasandra, Doddanagamangala Village, Karnataka 560099, India';
  render(
    <LocationName
      name="Rayasandra, Doddanagamangala Village"
      fullAddress={fullAddress}
      admin={admin}
    />,
  );
  const trigger = screen.getByRole('button', {
    name: 'Parkway Homes by SJR Primecorp, Rayasandra Main Rd',
  });
  expect(trigger).toHaveAccessibleDescription(fullAddress);
  fireEvent.focus(trigger);
  expect(screen.getByRole('tooltip')).toHaveTextContent(fullAddress);
});

it('keeps the selected name when there is no full address', () => {
  render(<LocationName name="Parkway Homes by SJR Primecorp" admin={admin} />);
  expect(screen.getByRole('button', { name: 'Parkway Homes by SJR Primecorp' })).toBeVisible();
});
