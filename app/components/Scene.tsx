"use client";

import { useCallback, useState } from "react";
import SkyCanvas from "./SkyCanvas";
import Overlay from "./Overlay";
import type { Airport } from "@/lib/airports";

export default function Scene({
  airport,
  showGround = true,
}: {
  airport: Airport;
  showGround?: boolean;
}) {
  const [count, setCount] = useState(0);
  const onCountChange = useCallback((n: number) => setCount(n), []);
  return (
    <>
      <SkyCanvas
        airport={airport}
        showGround={showGround}
        onCountChange={onCountChange}
      />
      <Overlay airport={airport} count={count} />
    </>
  );
}
