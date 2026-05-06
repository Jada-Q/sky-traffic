export interface Aircraft {
  icao24: string;
  callsign: string;
  lat: number;
  lng: number;
  alt: number | null; // meters (baro)
  heading: number | null; // degrees, true track
  velocity: number | null; // m/s
  onGround: boolean;
  lastContact: number; // unix seconds
}

export interface OpenSkyResponse {
  time: number;
  states: Array<unknown[]> | null;
}

export interface BBox {
  lamin: number;
  lamax: number;
  lomin: number;
  lomax: number;
}

// 1° latitude ≈ 111 km. 1° longitude ≈ 111 * cos(lat).
export function bboxFromCenter(
  lat: number,
  lng: number,
  radiusKm: number,
): BBox {
  const dLat = radiusKm / 111;
  const cosLat = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  const dLng = radiusKm / (111 * cosLat);
  return {
    lamin: lat - dLat,
    lamax: lat + dLat,
    lomin: lng - dLng,
    lomax: lng + dLng,
  };
}

export async function fetchAircraft(
  bbox: BBox,
  signal?: AbortSignal,
): Promise<Aircraft[]> {
  // Hits our same-origin proxy at /api/states which then talks to OpenSky.
  // (Browser cannot call opensky-network.org directly — CORS.)
  const url = `/api/states?lamin=${bbox.lamin.toFixed(4)}&lamax=${bbox.lamax.toFixed(4)}&lomin=${bbox.lomin.toFixed(4)}&lomax=${bbox.lomax.toFixed(4)}`;
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`OpenSky ${res.status}`);
  }
  const data = (await res.json()) as OpenSkyResponse;
  if (!data.states) return [];
  return data.states
    .map(parseStateVector)
    .filter((a): a is Aircraft => a !== null);
}

// OpenSky state vector indices:
// 0  icao24
// 1  callsign
// 2  origin_country
// 3  time_position
// 4  last_contact
// 5  longitude
// 6  latitude
// 7  baro_altitude
// 8  on_ground
// 9  velocity
// 10 true_track
// 11 vertical_rate
// 12 sensors
// 13 geo_altitude
// 14 squawk
// 15 spi
// 16 position_source
function parseStateVector(s: unknown[]): Aircraft | null {
  const icao24 = typeof s[0] === "string" ? s[0] : null;
  const lng = typeof s[5] === "number" ? s[5] : null;
  const lat = typeof s[6] === "number" ? s[6] : null;
  if (!icao24 || lng === null || lat === null) return null;

  const callsignRaw = typeof s[1] === "string" ? s[1].trim() : "";
  const baroAlt = typeof s[7] === "number" ? s[7] : null;
  const geoAlt = typeof s[13] === "number" ? s[13] : null;
  const alt = baroAlt ?? geoAlt;
  const onGround = s[8] === true;
  const velocity = typeof s[9] === "number" ? s[9] : null;
  const heading = typeof s[10] === "number" ? s[10] : null;
  const lastContact = typeof s[4] === "number" ? s[4] : 0;

  return {
    icao24,
    callsign: callsignRaw || icao24.toUpperCase(),
    lat,
    lng,
    alt,
    heading,
    velocity,
    onGround,
    lastContact,
  };
}
