import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * After client-side navigation (not the first load), moves focus to the new page's h1 so
 * keyboard and screen-reader users land on the new content and hear its title. Compares
 * against the previous path, so re-running the effect (StrictMode) never steals focus.
 */
export function useRouteFocus(): void {
  const { pathname } = useLocation();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const heading = document.querySelector<HTMLElement>('main h1');
    (heading ?? document.getElementById('main'))?.focus();
  }, [pathname]);
}
