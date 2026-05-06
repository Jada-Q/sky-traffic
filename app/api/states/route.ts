import { NextResponse } from "next/server";

// Server-side proxy to live ADS-B aircraft state.
//
// We tried OpenSky Network first (the project's nominal data source), but
// `https://opensky-network.org/api/states/all` blocks/throttles every Vercel
// egress region we tested (iad1, fra1) — `UND_ERR_CONNECT_TIMEOUT`. Anonymous
// access from cloud IPs appears policy-blocked.
//
// Fallback: api.adsb.lol — community-run aggregator built on top of the same
// raw ADS-B feeders OpenSky uses. We translate its richer JSON back into the
// 17-element OpenSky state-vector shape so the client parser is unchanged.
//
// Cache responses for 25 s. Client polls every 30 s. Stale-on-error.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface AdsbAircraft {
  hex?: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | "ground";
  alt_geom?: number;
  gs?: number; // ground speed in knots
  track?: number; // true track degrees
  true_heading?: number;
  baro_rate?: number;
  squawk?: string;
  seen?: number;
  seen_pos?: number;
}

const cache = new Map<string, { ts: number; data: unknown }>();
const TTL_MS = 25_000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lamin = searchParams.get("lamin");
  const lamax = searchParams.get("lamax");
  const lomin = searchParams.get("lomin");
  const lomax = searchParams.get("lomax");

  if (!lamin || !lamax || !lomin || !lomax) {
    return NextResponse.json({ error: "missing bbox" }, { status: 400 });
  }

  const key = `${lamin}|${lamax}|${lomin}|${lomax}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.ts < TTL_MS) {
    return NextResponse.json(hit.data, {
      headers: { "Cache-Control": "public, max-age=25" },
    });
  }

  // Convert bbox -> center + radius (nautical miles, adsb.lol convention).
  const laMin = Number(lamin);
  const laMax = Number(lamax);
  const loMin = Number(lomin);
  const loMax = Number(lomax);
  const centerLat = (laMin + laMax) / 2;
  const centerLng = (loMin + loMax) / 2;
  const dLatKm = ((laMax - laMin) / 2) * 111;
  const cosLat = Math.max(0.01, Math.cos((centerLat * Math.PI) / 180));
  const dLngKm = ((loMax - loMin) / 2) * 111 * cosLat;
  const radiusKm = Math.min(250, Math.max(20, Math.hypot(dLatKm, dLngKm)));
  const radiusNm = Math.round(radiusKm * 0.539957);

  const url = `https://api.adsb.lol/v2/lat/${centerLat.toFixed(4)}/lon/${centerLng.toFixed(4)}/dist/${radiusNm}`;

  const tryFetch = async () =>
    fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; sky-traffic/1.0; +https://github.com/Jada-Q/sky-traffic)",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

  let lastErr = "unknown";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await tryFetch();
      if (!res.ok) {
        lastErr = `adsb ${res.status}`;
        if (attempt === 0) continue;
        if (hit) {
          return NextResponse.json(hit.data, {
            headers: {
              "Cache-Control": "public, max-age=25",
              "X-Cache-Status": "stale-error",
            },
          });
        }
        return NextResponse.json({ error: lastErr }, { status: 502 });
      }
      const json = (await res.json()) as { ac?: AdsbAircraft[] };
      const states = (json.ac ?? []).map(toOpenSkyVector).filter(Boolean);
      const data = { time: Math.floor(now / 1000), states };
      cache.set(key, { ts: now, data });
      return NextResponse.json(data, {
        headers: { "Cache-Control": "public, max-age=25" },
      });
    } catch (e) {
      const err = e as Error & { cause?: { code?: string } };
      lastErr = `${err.name}: ${err.message}${err.cause?.code ? ` (${err.cause.code})` : ""}`;
      console.warn(`[adsb-proxy] attempt ${attempt + 1}: ${lastErr}`);
    }
  }

  if (hit) {
    return NextResponse.json(hit.data, {
      headers: {
        "Cache-Control": "public, max-age=25",
        "X-Cache-Status": "stale-error",
      },
    });
  }
  return NextResponse.json({ error: lastErr }, { status: 502 });
}

// adsb.lol -> OpenSky 17-element state vector
// [icao24, callsign, country, time_position, last_contact, lng, lat,
//  baro_alt(m), on_ground, velocity(m/s), true_track, vert_rate, sensors,
//  geo_alt(m), squawk, spi, position_source]
function toOpenSkyVector(a: AdsbAircraft): unknown[] | null {
  if (!a.hex || typeof a.lat !== "number" || typeof a.lon !== "number") {
    return null;
  }
  const onGround = a.alt_baro === "ground";
  const baroAltM =
    typeof a.alt_baro === "number"
      ? a.alt_baro * 0.3048 // ft → m
      : null;
  const geoAltM = typeof a.alt_geom === "number" ? a.alt_geom * 0.3048 : null;
  const velocityMs = typeof a.gs === "number" ? a.gs * 0.514444 : null; // kt → m/s
  const trueTrack =
    typeof a.track === "number"
      ? a.track
      : typeof a.true_heading === "number"
        ? a.true_heading
        : null;
  const vertRate =
    typeof a.baro_rate === "number" ? a.baro_rate * 0.00508 : null; // ft/min → m/s
  const nowSec = Math.floor(Date.now() / 1000);
  const seen = typeof a.seen === "number" ? a.seen : 0;
  const lastContact = nowSec - Math.round(seen);
  const seenPos = typeof a.seen_pos === "number" ? a.seen_pos : seen;
  const timePos = nowSec - Math.round(seenPos);

  return [
    a.hex,
    a.flight ? a.flight.trim() : "",
    "", // origin_country unknown via adsb.lol
    timePos,
    lastContact,
    a.lon,
    a.lat,
    baroAltM,
    onGround,
    velocityMs,
    trueTrack,
    vertRate,
    null,
    geoAltM,
    a.squawk ?? null,
    false,
    0,
  ];
}
