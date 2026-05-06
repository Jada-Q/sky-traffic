"use client";

const CITIES: Array<{ key: string; label: string }> = [
  { key: "tokyo", label: "Tokyo" },
  { key: "osaka", label: "Osaka" },
  { key: "shanghai", label: "上海 Shanghai" },
  { key: "hkg", label: "Hong Kong" },
  { key: "nyc", label: "New York" },
  { key: "lax", label: "Los Angeles" },
];

export default function CitySwitcher({ active }: { active: string }) {
  return (
    <div
      className="pointer-events-none fixed z-20 select-none
        max-md:right-3 max-md:top-1/2 max-md:-translate-y-1/2
        md:bottom-7 md:left-1/2 md:-translate-x-1/2"
      style={{ textShadow: "0 1px 4px rgba(0,0,0,0.55)" }}
    >
      <div
        className="pointer-events-auto group flex items-center rounded-full opacity-30 transition-opacity duration-500 hover:opacity-100
          max-md:flex-col max-md:gap-4 max-md:px-2 max-md:py-3
          md:flex-row md:gap-5 md:px-5 md:py-3"
      >
        {CITIES.map((c) => {
          const isActive = active === c.key;
          return (
            <a
              key={c.key}
              href={`?c=${c.key}`}
              className="group/btn relative flex h-6 w-6 items-center justify-center"
              aria-label={c.label}
              title={c.label}
            >
              <span
                className={
                  "block rounded-full transition-all duration-300 " +
                  (isActive
                    ? "h-2 w-2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                    : "h-1.5 w-1.5 bg-white/55 group-hover/btn:h-2 group-hover/btn:w-2 group-hover/btn:bg-white")
                }
              />
              <span
                className="pointer-events-none absolute whitespace-nowrap font-serif text-[11px] tracking-wide text-white opacity-0 transition-opacity duration-300 group-hover/btn:opacity-90
                  max-md:right-7 max-md:top-1/2 max-md:-translate-y-1/2
                  md:-top-7"
              >
                {c.label}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
