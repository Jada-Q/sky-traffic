"use client";

import { useEffect, useState } from "react";
import type { Airport } from "@/lib/airports";

export default function Overlay({
  airport,
  count,
}: {
  airport: Airport;
  count: number;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: airport.timezone,
  }).format(now);
  const dateStr = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: airport.timezone,
  }).format(now);
  const tzAbbr = getTzAbbr(now, airport.timezone);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-10 select-none text-white"
      style={{ textShadow: "0 1px 4px rgba(0,0,0,0.55)" }}
    >
      <div className="absolute left-6 top-6 font-serif tracking-wide md:left-10 md:top-10">
        <div className="text-xs uppercase tracking-[0.3em] opacity-60">
          Sky Traffic
        </div>
        <div className="mt-2 text-xs opacity-70">
          {airport.label} · {formatCoord(airport.lat, true)}{" "}
          {formatCoord(airport.lng, false)}
        </div>
      </div>

      <div className="absolute right-6 top-6 text-right font-serif md:right-10 md:top-10">
        <div className="font-mono text-3xl tracking-tight md:text-4xl">
          {time}
        </div>
        <div className="mt-1 text-xs opacity-70">
          {dateStr} {tzAbbr}
        </div>
      </div>

      <div className="absolute bottom-6 left-6 font-serif md:bottom-10 md:left-10">
        <div className="text-[10px] uppercase tracking-[0.25em] opacity-50">
          Aircraft visible
        </div>
        <div className="mt-0.5 font-mono text-2xl tracking-tight">
          {count.toString().padStart(2, "0")}
        </div>
        <div className="mt-1 text-[11px] opacity-50">
          data: adsb.lol · {airport.radius_km} km radius
        </div>
      </div>

      <div className="absolute bottom-10 right-10 hidden max-w-[260px] text-right font-serif text-xs italic opacity-50 md:block">
        Live ADS-B state vectors, polled every 30 s.<br />
        Trails fade over 30 s. White = cruise (&gt;9 km), yellow = climb/descend.
      </div>
    </div>
  );
}

function formatCoord(value: number, isLat: boolean): string {
  const dir = isLat ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(4)}°${dir}`;
}

function getTzAbbr(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}
