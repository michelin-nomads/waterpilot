import { layoutExtent, type BoundingBox } from './extentGeometry';

const TILE = { width: 160, height: 100, padding: 10 };
const box: BoundingBox = {
  minLongitude: 77.6,
  minLatitude: 12.9,
  maxLongitude: 77.7,
  maxLatitude: 13.0,
};

describe('layoutExtent', () => {
  it('draws only a pin at the centre when there is no extent', () => {
    expect(layoutExtent(null, { latitude: 12.95, longitude: 77.65 }, false, TILE)).toEqual({
      kind: 'point',
      pin: { x: 80, y: 50 },
    });
  });

  it('fits a box inside the padding without stretching it', () => {
    const shape = layoutExtent(box, { latitude: 12.95, longitude: 77.65 }, false, TILE);
    if (shape.kind !== 'box') throw new Error('expected a box');
    expect(shape.box.x).toBeGreaterThanOrEqual(TILE.padding);
    expect(shape.box.y).toBeGreaterThanOrEqual(TILE.padding);
    expect(shape.box.x + shape.box.width).toBeLessThanOrEqual(TILE.width - TILE.padding);
    expect(shape.box.y + shape.box.height).toBeLessThanOrEqual(TILE.height - TILE.padding);
    // Longitude shrinks with latitude, so a square-in-degrees box is a little narrower.
    expect(shape.box.width / shape.box.height).toBeCloseTo(Math.cos((12.95 * Math.PI) / 180), 2);
    expect(shape.pin).toEqual({ x: 80, y: 50 });
  });

  it('draws a chosen radius as a circle', () => {
    const shape = layoutExtent(box, { latitude: 12.95, longitude: 77.65 }, true, TILE);
    expect(shape.kind).toBe('circle');
  });

  it('keeps the pin inside the extent when the centroid lies outside it', () => {
    const shape = layoutExtent(box, { latitude: 20, longitude: 90 }, false, TILE);
    if (shape.kind !== 'box') throw new Error('expected a box');
    expect(shape.pin.x).toBeLessThanOrEqual(shape.box.x + shape.box.width);
    expect(shape.pin.y).toBeGreaterThanOrEqual(shape.box.y);
  });
});
