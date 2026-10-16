import { render, screen } from '@testing-library/react';

import { WaterDropletLoader } from './WaterDropletLoader';

describe('WaterDropletLoader', () => {
  it('uses a real status label without simulated progress or replay controls', () => {
    render(<WaterDropletLoader statusText="Loading WaterLens…" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading WaterLens…');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replay' })).not.toBeInTheDocument();
  });
});
