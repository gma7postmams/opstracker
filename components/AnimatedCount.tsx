"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  loading: boolean;
}

export default function AnimatedCount({ value, loading }: Props) {
  const [displayValue, setDisplayValue] = useState(value);
  const [changing, setChanging] = useState(false);
  const lastValue = useRef<number | null>(null);
  const displayedValue = useRef(value);
  const frame = useRef<number | null>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading) {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (pulseTimer.current !== null) clearTimeout(pulseTimer.current);
      frame.current = null;
      pulseTimer.current = null;
      setChanging(false);
      if (lastValue.current !== null) {
        displayedValue.current = lastValue.current;
        setDisplayValue(lastValue.current);
      }
      return;
    }

    if (lastValue.current === null) {
      lastValue.current = value;
      displayedValue.current = value;
      setDisplayValue(value);
      return;
    }
    if (value === lastValue.current) return;

    lastValue.current = value;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (pulseTimer.current !== null) clearTimeout(pulseTimer.current);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      displayedValue.current = value;
      setDisplayValue(value);
      setChanging(false);
      return;
    }

    const startValue = displayedValue.current;
    const startTime = performance.now();
    const duration = 450;
    setChanging(true);

    const animate = (time: number) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const nextValue = Math.round(startValue + (value - startValue) * eased);
      displayedValue.current = nextValue;
      setDisplayValue(nextValue);

      if (progress < 1) {
        frame.current = requestAnimationFrame(animate);
      } else {
        frame.current = null;
        setChanging(false);
      }
    };

    frame.current = requestAnimationFrame(animate);
    pulseTimer.current = setTimeout(() => setChanging(false), duration);
  }, [value, loading]);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (pulseTimer.current !== null) clearTimeout(pulseTimer.current);
  }, []);

  return <span className={`crm-kpi-number${changing ? " is-changing" : ""}`} aria-label={String(value)}>{displayValue}</span>;
}