import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { FormattedMessage } from './FormattedMessage';

it('renders headings cleanly and discards empty Markdown separators', () => {
  const { container } = render(
    <FormattedMessage text={'###\n\n### Missing inputs\n\nRecord **tanker supply**.\n\n---'} />,
  );
  expect(screen.getByText('Missing inputs').tagName).toBe('STRONG');
  expect(screen.getByText('tanker supply').tagName).toBe('STRONG');
  expect(container.textContent).not.toContain('###');
  expect(container.textContent).not.toContain('---');
});
