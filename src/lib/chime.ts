// ── Notification chime (WebAudio, zero assets) ────────────────────────────────
// A soft two-tone "ding-dong" played when a new order arrives in the admin
// panel. Uses the WebAudio API directly so no audio file ships with the app.
//
// Autoplay policy: browsers only allow audio after a user gesture. We create
// the AudioContext lazily and unlock it on the first pointerdown (the admin
// always clicks to log in, so by the time an order arrives the context is
// already running). Every call is wrapped in try/catch — a blocked or
// unsupported context must never break the UI.

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Unlock audio on the first user gesture (autoplay policy). The listener is
// registered once per page load and removed after the first interaction.
if (typeof window !== "undefined") {
  const unlock = () => ensureCtx();
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true, passive: true });
}

function tone(
  context: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  gainValue: number
): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, context.currentTime + startAt);
  // Quick attack, exponential decay — feels like a soft bell, not a beep.
  gain.gain.setValueAtTime(0.0001, context.currentTime + startAt);
  gain.gain.exponentialRampToValueAtTime(
    gainValue,
    context.currentTime + startAt + 0.02
  );
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    context.currentTime + startAt + duration
  );
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(context.currentTime + startAt);
  osc.stop(context.currentTime + startAt + duration + 0.05);
}

/** Play the new-order chime. Safe to call anywhere — never throws. */
export function playNewOrderChime(): void {
  try {
    const context = ensureCtx();
    if (!context || context.state !== "running") return;
    // Two-tone motif: E5 → A5 (warm, short, distinguishable from OS sounds).
    tone(context, 659.25, 0, 0.18, 0.06);
    tone(context, 880.0, 0.14, 0.28, 0.05);
  } catch {
    // Audio is best-effort — never break the app over a sound.
  }
}
