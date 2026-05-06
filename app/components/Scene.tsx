"use client";

import { useCallback, useState } from "react";
import SkyCanvas from "./SkyCanvas";
import Overlay from "./Overlay";
import type { Airport } from "@/lib/airports";

export default function Scene({ airport }: { airport: Airport }) {
  const [count, setCount] = useState(0);
  const onCountChange = useCallback((n: number) => setCount(n), []);
  return (
    <>
      <SkyCanvas airport={airport} onCountChange={onCountChange} />
      <Overlay airport={airport} count={count} />
    </>
  );
}
