import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FormattedMessage } from './FormattedMessage';

describe('FormattedMessage', () => {
  it('renders bold and lists properly from assistant text', () => {
    const raw = `I found two places that match "SJR Parkway homes": 1. **SJR Parkway Homes**, Rayasandra Main Rd 2. **Parkway Homes by SJR Primecorp**, Rayasandra Which one do you mean? Once you confirm the location, I can provide data on: * Annual rainfall * Rooftop harvesting`;
    const { container } = render(<FormattedMessage text={raw} />);

    expect(screen.getByText('SJR Parkway Homes')).toBeInTheDocument();
    expect(screen.getByText('Parkway Homes by SJR Primecorp')).toBeInTheDocument();
    expect(screen.getByText('Annual rainfall')).toBeInTheDocument();
    expect(screen.getByText('Rooftop harvesting')).toBeInTheDocument();

    const ol = container.querySelector('ol');
    expect(ol).toBeInTheDocument();
    expect(ol?.children.length).toBe(2);

    const ul = container.querySelector('ul');
    expect(ul).toBeInTheDocument();
    expect(ul?.children.length).toBe(2);
  });
});
