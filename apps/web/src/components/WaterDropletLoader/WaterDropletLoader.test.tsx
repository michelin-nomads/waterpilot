import { act, render, screen } from '@testing-library/react';

import { WaterDropletLoader } from './WaterDropletLoader';

describe('WaterDropletLoader', () => {
  afterEach(() => vi.restoreAllMocks());

  it('exposes its fill as a progressbar with the status text', () => {
    render(<WaterDropletLoader statusText="Preparing your water plan…" />);

    const bar = screen.getByRole('progressbar', { name: 'Preparing your water plan…' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByText('Preparing your water plan…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replay' })).not.toBeInTheDocument();
  });

  it('fills over the duration and reports completion once', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const onComplete = vi.fn();
    render(<WaterDropletLoader durationMs={1000} onComplete={onComplete} />);

    const run = (timestamp: number) => act(() => frames.shift()?.(timestamp));
    run(0);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    run(500);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(onComplete).not.toHaveBeenCalled();
    run(1000);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
  it('uses request progress instead of a timer when controlled', () => {
    const onComplete = vi.fn();
    const { rerender } = render(<WaterDropletLoader progress={0.5} onComplete={onComplete} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('50%')).toBeVisible();
    rerender(<WaterDropletLoader progress={1} onComplete={onComplete} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(onComplete).not.toHaveBeenCalled();
  });
});
