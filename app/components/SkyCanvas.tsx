"use client";

import { useEffect, useRef, useState } from "react";
import { getSkyPalette } from "@/lib/sky";
import { buildProjection } from "@/lib/projection";
import { bboxFromCenter, fetchAircraft, type Aircraft } from "@/lib/airspace";
import type { Airport } from "@/lib/airports";

const POLL_MS = 30_000;
const TRAIL_MAX_AGE_MS = 30_000; // 30s fading trail
const TRAIL_MAX_POINTS = 30;

interface TrailPoint {
  lat: number;
  lng: number;
  t: number; // ms timestamp
}

interface PlaneTrack {
  current: Aircraft;
  trail: TrailPoint[];
  lastSeen: number;
}

export default function SkyCanvas({
  airport,
  showGround = true,
  onCountChange,
}: {
  airport: Airport;
  showGround?: boolean;
  onCountChange?: (n: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const tracksRef = useRef<Map<string, PlaneTrack>>(new Map());
  const [, force] = useState(0);

  // Polling effect — fetch state vectors every 30 s and update tracksRef.
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    const poll = async () => {
      try {
        const bbox = bboxFromCenter(airport.lat, airport.lng, airport.radius_km);
        const aircraft = await fetchAircraft(bbox, ctrl.signal);
        if (cancelled) return;
        const now = Date.now();
        const tracks = tracksRef.current;
        const seen = new Set<string>();

        for (const a of aircraft) {
          seen.add(a.icao24);
          const existing = tracks.get(a.icao24);
          if (existing) {
            // Append to trail only if position actually moved (or first sample).
            const last = existing.trail[existing.trail.length - 1];
            if (!last || last.lat !== a.lat || last.lng !== a.lng) {
              existing.trail.push({ lat: a.lat, lng: a.lng, t: now });
            }
            existing.current = a;
            existing.lastSeen = now;
          } else {
            tracks.set(a.icao24, {
              current: a,
              trail: [{ lat: a.lat, lng: a.lng, t: now }],
              lastSeen: now,
            });
          }
        }

        // Prune planes not seen in 60s; trim old trail points.
        for (const [id, track] of tracks) {
          if (now - track.lastSeen > 60_000) {
            tracks.delete(id);
            continue;
          }
          track.trail = track.trail
            .filter((p) => now - p.t <= TRAIL_MAX_AGE_MS)
            .slice(-TRAIL_MAX_POINTS);
        }

        const visibleCount = showGround
          ? seen.size
          : aircraft.filter((a) => !a.onGround).length;
        onCountChange?.(visibleCount);
        force((n) => (n + 1) % 1000);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        // Silent: keep last known data, retry on next interval.
        // eslint-disable-next-line no-console
        if (process.env.NODE_ENV === "development") console.warn("opensky", e);
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearInterval(id);
    };
  }, [airport.lat, airport.lng, airport.radius_km, showGround, onCountChange]);

  // Reset tracks when airport changes.
  useEffect(() => {
    tracksRef.current.clear();
  }, [airport.lat, airport.lng]);

  // RAF render loop — draws sky + plane trails + dots.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const date = new Date();
      const palette = getSkyPalette(date, airport.timezone);
      const proj = buildProjection(
        airport.lat,
        airport.lng,
        airport.radius_km,
        w,
        h,
      );

      // Background — vertical gradient with a soft warm horizon glow band.
      drawSky(ctx, w, h, palette);
      // Subtle ring marking the airspace radius (very faint).
      drawRadiusRing(ctx, w, h, proj, airport);
      // Center marker — the airport itself.
      drawAirportMark(ctx, proj, airport);

      const now = Date.now();
      const tracks = tracksRef.current;
      for (const track of tracks.values()) {
        if (!showGround && track.current.onGround) continue;
        drawTrail(ctx, track, proj, now);
      }
      for (const track of tracks.values()) {
        if (!showGround && track.current.onGround) continue;
        drawPlane(ctx, track, proj);
      }

      // Subtle film grain.
      drawNoise(ctx, w, h);

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [airport, showGround]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 h-full w-full"
      aria-label={`Sky Traffic — ${airport.label}`}
    />
  );
}

function drawSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: { top: string; mid: string; horizon: string; glow: number },
) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, palette.top);
  grad.addColorStop(0.55, palette.mid);
  grad.addColorStop(1, "#000000");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (palette.glow > 0.05) {
    // Warm horizon glow concentrated at the bottom 30%.
    const glowGrad = ctx.createLinearGradient(0, h * 0.6, 0, h);
    const r = parseInt(palette.horizon.slice(1, 3), 16);
    const g = parseInt(palette.horizon.slice(3, 5), 16);
    const b = parseInt(palette.horizon.slice(5, 7), 16);
    glowGrad.addColorStop(0, `rgba(${r},${g},${b},0)`);
    glowGrad.addColorStop(1, `rgba(${r},${g},${b},${0.32 * palette.glow})`);
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
  }
}

function drawRadiusRing(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  proj: { project: (lat: number, lng: number) => { x: number; y: number } },
  airport: Airport,
) {
  const center = proj.project(airport.lat, airport.lng);
  // Approximate radius in pixels: project a point exactly radius_km north of center.
  const edge = proj.project(airport.lat + airport.radius_km / 111, airport.lng);
  const radiusPx = Math.abs(center.y - edge.y);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
  ctx.stroke();
}

function drawAirportMark(
  ctx: CanvasRenderingContext2D,
  proj: { project: (lat: number, lng: number) => { x: number; y: number } },
  airport: Airport,
) {
  const { x, y } = proj.project(airport.lat, airport.lng);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  // Small crosshair.
  ctx.beginPath();
  ctx.moveTo(x - 5, y);
  ctx.lineTo(x + 5, y);
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x, y + 5);
  ctx.stroke();

  // IATA code label below the crosshair.
  if (airport.code) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font =
      '11px ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(airport.code, x, y + 9);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }
}

function altitudeColor(alt: number | null, onGround: boolean): string {
  if (onGround) return "#9aa6b8"; // muted blue-grey on ground
  if (alt === null) return "#ffffff";
  if (alt > 9000) return "#ffffff"; // cruise — white
  return "#ffd86a"; // climb / descend — warm yellow
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  track: PlaneTrack,
  proj: { project: (lat: number, lng: number) => { x: number; y: number } },
  now: number,
) {
  const trail = track.trail;
  if (trail.length < 2) return;
  const baseColor = altitudeColor(track.current.alt, track.current.onGround);
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);

  // Draw as multiple line segments so we can fade each segment exponentially.
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const c = trail[i];
    const ageA = (now - a.t) / TRAIL_MAX_AGE_MS;
    const ageC = (now - c.t) / TRAIL_MAX_AGE_MS;
    const age = Math.min(ageA, ageC);
    if (age >= 1) continue;
    // Exponential fade: alpha = e^(-3 * age)
    const alpha = Math.exp(-3 * age) * 0.85;
    const pa = proj.project(a.lat, a.lng);
    const pc = proj.project(c.lat, c.lng);
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pc.x, pc.y);
    ctx.stroke();
  }
}

function drawPlane(
  ctx: CanvasRenderingContext2D,
  track: PlaneTrack,
  proj: { project: (lat: number, lng: number) => { x: number; y: number } },
) {
  const a = track.current;
  const { x, y } = proj.project(a.lat, a.lng);
  const color = altitudeColor(a.alt, a.onGround);

  // Soft glow.
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 8);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  glow.addColorStop(0, `rgba(${r},${g},${b},0.45)`);
  glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();

  // Solid dot.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawNoise(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
  ctx.fillStyle = "rgba(255,255,255,0.012)";
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = "rgba(0,0,0,0.018)";
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillRect(x, y, 1, 1);
  }
}
