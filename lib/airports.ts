export interface Airport {
  lat: number;
  lng: number;
  label: string;
  code: string; // IATA codes covering the bowl, e.g. "HND/NRT"
  timezone: string;
  radius_km: number;
}

export const PRESETS: Record<string, Airport> = {
  tokyo: {
    lat: 35.6764,
    lng: 139.65,
    label: "TOKYO",
    code: "HND / NRT",
    timezone: "Asia/Tokyo",
    radius_km: 60,
  },
  osaka: {
    lat: 34.7857,
    lng: 135.4382,
    label: "OSAKA",
    code: "ITM / KIX",
    timezone: "Asia/Tokyo",
    radius_km: 50,
  },
  nyc: {
    lat: 40.7128,
    lng: -74.006,
    label: "NEW YORK",
    code: "JFK / LGA / EWR",
    timezone: "America/New_York",
    radius_km: 70,
  },
  hkg: {
    lat: 22.308,
    lng: 113.9185,
    label: "HONG KONG",
    code: "HKG",
    timezone: "Asia/Hong_Kong",
    radius_km: 50,
  },
  lax: {
    lat: 33.9425,
    lng: -118.4081,
    label: "LOS ANGELES",
    code: "LAX",
    timezone: "America/Los_Angeles",
    radius_km: 60,
  },
};

export interface UrlParams {
  c?: string;
  lat?: string;
  lng?: string;
  label?: string;
  tz?: string;
  radius?: string;
}

export function resolveAirport(params: UrlParams | undefined): Airport {
  if (!params) return PRESETS.tokyo;

  if (params.c) {
    const key = params.c.toLowerCase();
    if (PRESETS[key]) return PRESETS[key];
  }

  if (params.lat && params.lng) {
    const lat = Number(params.lat);
    const lng = Number(params.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const radius = Number(params.radius);
      const labelText =
        params.label ||
        `${lat.toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;
      return {
        lat,
        lng,
        label: labelText,
        code: (params.label || "").toUpperCase().slice(0, 16),
        timezone: params.tz || "UTC",
        radius_km: Number.isFinite(radius) && radius > 0 ? radius : 60,
      };
    }
  }

  return PRESETS.tokyo;
}

export const PRESET_KEYS = Object.keys(PRESETS);
