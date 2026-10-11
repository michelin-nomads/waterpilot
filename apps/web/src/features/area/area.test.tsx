import { render, screen } from '@testing-library/react';

import AreaPage from './index';

describe('AreaPage', () => {
  it('renders the area heading', () => {
    render(<AreaPage />);
    expect(screen.getByRole('heading', { name: /understand your area/i })).toBeInTheDocument();
  });
});
