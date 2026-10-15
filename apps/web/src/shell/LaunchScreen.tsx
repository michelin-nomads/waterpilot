import { WaterDropletLoader } from '../components/WaterDropletLoader/WaterDropletLoader';

/**
 * Shown while auth restores and the router resolves the first route. It has no minimum
 * display time or simulated progress; readiness unmounts it and stops its animations.
 */
export function LaunchScreen() {
  return <WaterDropletLoader statusText="Loading WaterLens…" />;
}
