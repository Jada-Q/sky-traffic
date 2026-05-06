// Sky palette for an airspace view: vertical gradient deep navy → near-black,
// with optional warm horizon glow when sun is up. Simpler than Tide Pixels
// because we only render sky (no sea).

export interface SkyPalette {
  top: string;
  mid: string;
  horizon: string;
  glow: number; // 0..1, warm horizon strength
}

const KEYFRAMES: Array<{ h: number; palette: SkyPalette }> = [
  { h: 0, palette: { top: "#03040a", mid: "#070912", horizon: "#0a0d18", glow: 0 } },
  { h: 4, palette: { top: "#06081a", mid: "#0b0f28", horizon: "#181a3a", glow: 0.05 } },
  { h: 5.5, palette: { top: "#1a1c3e", mid: "#3a2c54", horizon: "#7a4a5e", glow: 0.45 } },
  { h: 7, palette: { top: "#2a4a78", mid: "#7a96b8", horizon: "#e8c298", glow: 0.7 } },
  { h: 12, palette: { top: "#173049", mid: "#2c5478", horizon: "#5a82a8", glow: 0.35 } },
  { h: 16.5, palette: { top: "#1c3050", mid: "#5a5478", horizon: "#c08868", glow: 0.55 } },
  { h: 18, palette: { top: "#181c38", mid: "#3a2c54", horizon: "#a05848", glow: 0.6 } },
  { h: 19.5, palette: { top: "#0a0c20", mid: "#16182e", horizon: "#3a2840", glow: 0.25 } },
  { h: 22, palette: { top: "#04050f", mid: "#080a18", horizon: "#10122a", glow: 0.05 } },
  { h: 24, palette: { top: "#03040a", mid: "#070912", horizon: "#0a0d18", glow: 0 } },
];

export function getSkyPalette(date: Date, timezone: string = "Asia/Tokyo"): SkyPalette {
  const localHour = getLocalHour(date, timezone);
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const a = KEYFRAMES[i];
    const b = KEYFRAMES[i + 1];
    if (localHour >= a.h && localHour <= b.h) {
      const t = (localHour - a.h) / (b.h - a.h);
      return {
        top: lerpColor(a.palette.top, b.palette.top, t),
        mid: lerpColor(a.palette.mid, b.palette.mid, t),
        horizon: lerpColor(a.palette.horizon, b.palette.horizon, t),
        glow: a.palette.glow + (b.palette.glow - a.palette.glow) * t,
      };
    }
  }
  return KEYFRAMES[0].palette;
}

function getLocalHour(date: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return (h + m / 60) % 24;
  } catch {
    return (date.getUTCHours() + date.getUTCMinutes() / 60) % 24;
  }
}

function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}
