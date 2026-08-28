"use client";
// Live HH:MM:SS clock for the admin header — ticks every second.
import { useEffect, useState } from "react";

export function useClock(): string {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => setClock(new Date().toTimeString().slice(0, 8));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, []);

  return clock;
}
