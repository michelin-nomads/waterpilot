import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';

import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Drawer } from '../Drawer/Drawer';

function DialogHarness() {
  const [open, setOpen] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open details</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Water Source Details"
        description="Sources and assumptions"
        initialFocusRef={confirmRef}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button ref={confirmRef}>Apply</Button>
          </>
        }
      >
        <input aria-label="Notes" />
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('is a labelled modal dialog that focuses the requested element', () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open details' }));
    const dialog = screen.getByRole('dialog', { name: 'Water Source Details' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Sources and assumptions');
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveFocus();
  });

  it('makes the page behind it inert and locks scrolling while open', () => {
    const { container } = render(<DialogHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open details' }));
    expect(container).toHaveAttribute('inert');
    expect(document.documentElement).toHaveClass('wl-scroll-locked');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(container).not.toHaveAttribute('inert');
    expect(document.documentElement).not.toHaveClass('wl-scroll-locked');
  });

  it('wraps Tab and Shift+Tab inside the dialog', () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open details' }));
    const dialog = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'Close' });
    const apply = screen.getByRole('button', { name: 'Apply' });

    apply.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(apply).toHaveFocus();
  });

  it('closes on Escape and returns focus to the opener', () => {
    render(<DialogHarness />);
    const opener = screen.getByRole('button', { name: 'Open details' });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes from the Close button and the backdrop', () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }));
    const backdrop = document.querySelector('[data-modal-layer] > [aria-hidden="true"]');
    fireEvent.click(backdrop as Element);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Drawer', () => {
  it('shares the modal behaviour: first focusable gets focus, Escape returns focus', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Municipal Water Grant</Button>
          <Drawer open={open} onClose={() => setOpen(false)} title="Funding source">
            <p>Details</p>
          </Drawer>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Municipal Water Grant' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Funding source' }), { key: 'Escape' });
    expect(opener).toHaveFocus();
  });
});
