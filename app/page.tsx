import Scene from "./components/Scene";
import CitySwitcher from "./components/CitySwitcher";
import { resolveAirport, type UrlParams } from "@/lib/airports";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = await searchParams;
  const params: UrlParams = {
    c: pickString(raw.c),
    lat: pickString(raw.lat),
    lng: pickString(raw.lng),
    label: pickString(raw.label),
    tz: pickString(raw.tz),
    radius: pickString(raw.radius),
  };
  const airport = resolveAirport(params);
  const activeKey = params.c?.toLowerCase() || (params.lat ? "" : "tokyo");
  const showGround = pickString(raw.ground)?.toLowerCase() !== "hide";

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <Scene airport={airport} showGround={showGround} />
      <CitySwitcher active={activeKey} />
    </main>
  );
}

function pickString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
