export interface BoundingBox {
  minLongitude: number;
  minLatitude: number;
  maxLongitude: number;
  maxLatitude: number;
}

export interface TileSize {
  width: number;
  height: number;
  padding: number;
}

export type ExtentShape =
  | { kind: 'point'; pin: Point }
  | { kind: 'box'; box: Rect; pin: Point }
  | { kind: 'circle'; circle: { cx: number; cy: number; r: number }; pin: Point };

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Lays a stored extent out in a tile. Longitude is scaled by cos(latitude) so a square
 * stays square on the ground; the shape is scaled to fit and centred, never stretched.
 * This is a drawing of the extent used for coverage checks, not a map and not a boundary.
 */
export function layoutExtent(
  box: BoundingBox | null,
  centroid: { latitude: number; longitude: number },
  radiusChosen: boolean,
  tile: TileSize,
): ExtentShape {
  const centre: Point = { x: tile.width / 2, y: tile.height / 2 };
  if (!box) return { kind: 'point', pin: centre };

  const lonScale = Math.cos((centroid.latitude * Math.PI) / 180);
  const groundWidth = Math.max((box.maxLongitude - box.minLongitude) * lonScale, Number.EPSILON);
  const groundHeight = Math.max(box.maxLatitude - box.minLatitude, Number.EPSILON);
  const scale = Math.min(
    (tile.width - 2 * tile.padding) / groundWidth,
    (tile.height - 2 * tile.padding) / groundHeight,
  );
  const width = groundWidth * scale;
  const height = groundHeight * scale;
  const rect: Rect = { x: centre.x - width / 2, y: centre.y - height / 2, width, height };

  const boxCentreLon = (box.minLongitude + box.maxLongitude) / 2;
  const boxCentreLat = (box.minLatitude + box.maxLatitude) / 2;
  // The centroid is normally inside its box; clamp so the pin is never drawn outside it.
  const pin: Point = {
    x: clamp(
      centre.x + (centroid.longitude - boxCentreLon) * lonScale * scale,
      rect.x,
      rect.x + width,
    ),
    y: clamp(centre.y - (centroid.latitude - boxCentreLat) * scale, rect.y, rect.y + height),
  };

  if (radiusChosen) {
    return {
      kind: 'circle',
      circle: { cx: centre.x, cy: centre.y, r: Math.min(width, height) / 2 },
      pin,
    };
  }
  return { kind: 'box', box: rect, pin };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
