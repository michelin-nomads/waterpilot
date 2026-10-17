import { layoutExtent, type BoundingBox } from './extentGeometry';
import styles from './AreaExtentTile.module.scss';

const TILE = { width: 160, height: 100, padding: 14 };

interface AreaExtentTileProps {
  name: string;
  centroidLatitude: number;
  centroidLongitude: number;
  box: BoundingBox | null;
  /** True when the extent is a radius the person chose rather than a reviewed boundary. */
  radiusChosen: boolean;
}

/**
 * A small drawing of the stored extent with a pin at the location's reference point. It is
 * deliberately not a map: no tiles, no street detail, and the outline is the box used for
 * coverage checks rather than an exact boundary.
 */
export function AreaExtentTile({
  name,
  centroidLatitude,
  centroidLongitude,
  box,
  radiusChosen,
}: AreaExtentTileProps) {
  const shape = layoutExtent(
    box,
    { latitude: centroidLatitude, longitude: centroidLongitude },
    radiusChosen,
    TILE,
  );
  const label =
    shape.kind === 'point'
      ? `Reference point for ${name}; no extent is stored`
      : `Approximate extent of ${name}`;

  return (
    <svg
      className={styles.tile}
      viewBox={`0 0 ${TILE.width} ${TILE.height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect className={styles.ground} width={TILE.width} height={TILE.height} />
      <path
        className={styles.grid}
        d="M0 33H160M0 66H160M40 0V100M80 0V100M120 0V100"
        fill="none"
      />
      {shape.kind === 'box' && <rect className={styles.extent} rx="6" {...shape.box} />}
      {shape.kind === 'circle' && <circle className={styles.extent} {...shape.circle} />}
      <circle className={styles.pin} cx={shape.pin.x} cy={shape.pin.y} r="4.5" />
      <circle className={styles.pinCore} cx={shape.pin.x} cy={shape.pin.y} r="1.6" />
    </svg>
  );
}
