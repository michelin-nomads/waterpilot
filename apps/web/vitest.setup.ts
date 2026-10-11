import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';

import { installMediaQueryMock, resetMediaQueries } from './src/test/mediaQueryMock';

installMediaQueryMock();

afterEach(() => {
  cleanup();
  resetMediaQueries();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.palette;
  document.documentElement.className = '';
});
