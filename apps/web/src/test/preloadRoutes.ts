import type { RouteObject } from 'react-router-dom';

/**
 * Imports every lazy route module once, before tests render the router. A cold dynamic
 * import is transformed on demand by Vite, which can take seconds on a loaded machine;
 * paying that cost in setup keeps the default `findBy*` wait for what the test asserts.
 */
export async function preloadLazyRoutes(routes: readonly RouteObject[]): Promise<void> {
  const loads: Promise<unknown>[] = [];
  const visit = (list: readonly RouteObject[]) => {
    for (const route of list) {
      if (typeof route.lazy === 'function') loads.push(route.lazy());
      if (route.children) visit(route.children);
    }
  };
  visit(routes);
  await Promise.all(loads);
}
