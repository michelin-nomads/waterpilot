import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { useToast, type ToastOptions } from './toastContext';
import { ToastProvider } from './ToastProvider';

function Trigger({ options }: { options: ToastOptions }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.show(options)}>
      Notify
    </button>
  );
}

function setup(options: ToastOptions) {
  render(
    <ToastProvider>
      <Trigger options={options} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('announces non-error messages politely and auto-dismisses after 6 s', () => {
    setup({ message: 'Saved.', tone: 'success' });
    expect(within(screen.getByRole('status')).getByText('Saved.')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5999));
    expect(screen.queryByText('Saved.')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('pauses the timer while hovered', () => {
    setup({ message: 'Saved.', tone: 'success' });
    const toast = screen.getByText('Saved.').parentElement as HTMLElement;
    act(() => vi.advanceTimersByTime(3000));
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.queryByText('Saved.')).toBeInTheDocument();
    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('puts errors in the alert region and keeps them until dismissed', () => {
    const onAction = vi.fn();
    setup({
      message: 'Request timed out. Try again.',
      tone: 'error',
      action: { label: 'Retry', onAction },
    });
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Request timed out. Try again.')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.queryByText('Request timed out. Try again.')).toBeInTheDocument();
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByText('Request timed out. Try again.')).not.toBeInTheDocument();
  });

  it('keeps at most three toasts', () => {
    render(
      <ToastProvider>
        <Trigger options={{ message: 'Hello', durationMs: null }} />
      </ToastProvider>,
    );
    const button = screen.getByRole('button', { name: 'Notify' });
    for (let i = 0; i < 5; i += 1) fireEvent.click(button);
    expect(screen.getAllByText('Hello')).toHaveLength(3);
  });
});
