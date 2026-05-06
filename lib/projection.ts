// Local Mercator projection, centered on a given lat/lng.
// Distances within the radius (≤ 70 km) — flat-earth approximation is fine.

export interface Projection {
  /** Convert lat/lng to canvas (x, y) in CSS pixels. */
  project: (lat: number, lng: number) => { x: number; y: number };
  /** Inverse: pixel to lat/lng (not used currently but useful for debug). */
  unproject?: (x: number, y: number) => { lat: number; lng: number };
}

/**
 * Build a projector that maps `radiusKm` around (centerLat, centerLng) into
 * a canvas of size (w × h), filling whichever dimension is the limiting axis.
 * The bbox is rectangular in lat/lng space; we pick the scale so the radius
 * (in either direction) fits with some padding.
 */
export function buildProjection(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  w: number,
  h: number,
  paddingPx = 60,
): Projection {
  const cosLat = Math.max(0.01, Math.cos((centerLat * Math.PI) / 180));
  // Half-extents in degrees that we want to cover.
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * cosLat);

  const usableW = Math.max(100, w - paddingPx * 2);
  const usableH = Math.max(100, h - paddingPx * 2);

  // Pixels per degree, take the smaller so the disc fits both axes.
  const pxPerDegLat = usableH / (dLat * 2);
  const pxPerDegLng = usableW / (dLng * 2);
  const pxPerDeg = Math.min(pxPerDegLat, pxPerDegLng);

  const project = (lat: number, lng: number) => {
    const x = w / 2 + (lng - centerLng) * pxPerDeg * cosLat;
    const y = h / 2 - (lat - centerLat) * pxPerDeg;
    return { x, y };
  };

  const unproject = (x: number, y: number) => {
    const lng = centerLng + (x - w / 2) / (pxPerDeg * cosLat);
    const lat = centerLat - (y - h / 2) / pxPerDeg;
    return { lat, lng };
  };

  return { project, unproject };
}
