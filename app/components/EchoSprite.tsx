"use client";

import { useEffect, useRef } from "react";

// 10 wide × 12 tall. Chars:
// . transparent, G ghost body (translucent), H headset (dark), E eye dot
const FRAME_IDLE_A = [
  "...GGGG...",
  "..HGGGGH..",
  ".HGGGGGGH.",
  ".HGEEEEEH.",
  "..GGGGGG..",
  ".GGGGGGGG.",
  ".GGGGGGGG.",
  ".GGGGGGGG.",
  "..GGGGGG..",
  "..G.GG.G..",
  "..G....G..",
  "...G..G...",
];

const FRAME_IDLE_B = [
  "...GGGG...",
  "..HGGGGH..",
  ".HGGGGGGH.",
  ".HGEEEEEH.",
  "..GGGGGG..",
  ".GGGGGGGG.",
  ".GGGGGGGG.",
  ".GGGGGGGG.",
  "..GGGGGG..",
  "..GG..GG..",
  "...G..G...",
  "....GG....",
];

const COLORS: Record<string, string> = {
  G: "rgba(232, 228, 220, 0.72)",
  H: "rgba(20, 18, 14, 0.85)",
  E: "rgba(20, 18, 14, 0.9)",
};

const PIXEL = 6;
const CANVAS_W = 10 * PIXEL;
const CANVAS_H = 12 * PIXEL;

const MOVE_SPEED = 200; // px/sec (slightly slower than Nagi — ghost drift)
const X_PADDING = 30;

function drawFrame(ctx: CanvasRenderingContext2D, frame: string[], yOffset = 0) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  for (let y = 0; y < frame.length; y++) {
    const row = frame[y];
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      const color = COLORS[c];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * PIXEL, (y + yOffset) * PIXEL, PIXEL, PIXEL);
      }
    }
  }
}

export default function EchoSprite() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const keys = new Set<string>();
    const pos = { x: 0, y: 0 };
    let frameToggle = 0;
    let lastFrameSwap = performance.now();
    let lastTick = performance.now();
    let breathPhase = 0; // for continuous idle hover
    let raf = 0;

    // Bounds depend on viewport height
    const computeBounds = () => {
      const vh = window.innerHeight;
      // Default top is "22% of viewport". Allow drift from 5%→60%.
      const yMin = vh * 0.05 - vh * 0.22; // negative
      const yMax = vh * 0.6 - vh * 0.22; // positive
      return { yMin, yMax };
    };
    let bounds = computeBounds();
    const onResize = () => {
      bounds = computeBounds();
    };
    window.addEventListener("resize", onResize);

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key;
      if (
        k === "ArrowUp" ||
        k === "ArrowDown" ||
        k === "ArrowLeft" ||
        k === "ArrowRight" ||
        k === "w" ||
        k === "a" ||
        k === "s" ||
        k === "d"
      ) {
        keys.add(k);
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const tick = (now: number) => {
      const dt = (now - lastTick) / 1000;
      lastTick = now;

      // keyboard delta
      let dx = 0,
        dy = 0;
      if (keys.has("ArrowLeft") || keys.has("a")) dx -= MOVE_SPEED * dt;
      if (keys.has("ArrowRight") || keys.has("d")) dx += MOVE_SPEED * dt;
      if (keys.has("ArrowUp") || keys.has("w")) dy -= MOVE_SPEED * dt;
      if (keys.has("ArrowDown") || keys.has("s")) dy += MOVE_SPEED * dt;

      pos.x += dx;
      pos.y += dy;

      // clamp
      const halfW = window.innerWidth / 2;
      pos.x = Math.max(-halfW + X_PADDING, Math.min(halfW - X_PADDING, pos.x));
      pos.y = Math.max(bounds.yMin, Math.min(bounds.yMax, pos.y));

      // gentle continuous breath (ghost is never quite still)
      breathPhase += dt * 1.6; // ~1 cycle / 4 sec
      const breath = Math.sin(breathPhase) * 3; // ±3 px vertical sway

      wrap.style.transform = `translate(calc(-50% + ${pos.x}px), ${pos.y + breath}px)`;

      // wisp shimmer — toggle frame every 700ms
      if (now - lastFrameSwap > 700) {
        frameToggle = 1 - frameToggle;
        lastFrameSwap = now;
      }
      const frame = frameToggle ? FRAME_IDLE_A : FRAME_IDLE_B;
      drawFrame(ctx, frame);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none fixed left-1/2 z-10 hidden select-none md:block"
      style={{
        top: "22%",
        width: `${CANVAS_W}px`,
        height: `${CANVAS_H}px`,
        transform: "translateX(-50%)",
        willChange: "transform",
      }}
      aria-label="Echo — 塔台幽霊 (方向キー操作)"
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{
          width: `${CANVAS_W}px`,
          height: `${CANVAS_H}px`,
          imageRendering: "pixelated",
          filter: "drop-shadow(0 0 8px rgba(180, 200, 255, 0.35))",
        }}
      />
    </div>
  );
}
