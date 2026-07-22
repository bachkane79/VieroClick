"use client";

import { useEffect, useRef, useState } from "react";

/**
 * macOS-Dock magnification. As the pointer travels the container, each item
 * scales by its distance to the cursor (nearest = largest, neighbours ease
 * down) and grows away from the bar. Disabled under prefers-reduced-motion
 * (§9.4). Only `transform` animates — no layout shift.
 *
 * `axis: "x"` = horizontal bar (icons rise/drop from the bar);
 * `axis: "y"` = vertical rail (icons bulge toward the panel).
 */
export function useDock(
  count: number,
  axis: "x" | "y" = "x",
  opts?: { radius?: number; max?: number; shift?: number }
) {
  const R = opts?.radius ?? 90;
  const MAX = opts?.max ?? 0.5;
  const SHIFT = opts?.shift ?? 10;

  const containerRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const centers = useRef<number[]>([]);
  const [pointer, setPointer] = useState<number | null>(null);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  function measure() {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const base = axis === "y" ? r.top : r.left;
    centers.current = itemRefs.current.map((it) => {
      if (!it) return 0;
      const b = it.getBoundingClientRect();
      return axis === "y" ? b.top - base + b.height / 2 : b.left - base + b.width / 2;
    });
  }

  function onMove(e: React.MouseEvent) {
    if (reduce) return;
    if (centers.current.length !== count) measure();
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPointer(axis === "y" ? e.clientY - r.top : e.clientX - r.left);
  }

  function style(i: number): React.CSSProperties {
    if (reduce || pointer === null) return {};
    const d = Math.abs(pointer - (centers.current[i] ?? 0));
    const f = Math.max(0, 1 - d / R);
    const eased = f * f;
    const scale = 1 + MAX * eased;
    return {
      transform:
        axis === "y"
          ? `translateX(${SHIFT * eased}px) scale(${scale})`
          : `translateY(${SHIFT * eased}px) scale(${scale})`,
      transformOrigin: axis === "y" ? "left center" : "center top",
      zIndex: eased > 0.05 ? 20 : undefined,
    };
  }

  return {
    containerRef,
    setItemRef: (i: number) => (el: HTMLElement | null) => {
      itemRefs.current[i] = el;
    },
    onMove,
    onLeave: () => setPointer(null),
    style,
    reduce,
  };
}
