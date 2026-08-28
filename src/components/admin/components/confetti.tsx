"use client";
// Confetti burst shown when an order is marked Done / created.
// The hook owns the piece state (36 pieces, auto-clears after 1.6s —
// matching the original timings); ConfettiLayer renders the falling pieces.
import { useCallback, useRef, useState } from "react";
import { CONFETTI_COLORS } from "../admin-helpers";

export interface ConfettiPiece {
  id: number;
  left: number;
  drift: number;
  delay: number;
  rotate: number;
  color: string;
}

export function useConfetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const confettiId = useRef(0);

  const play = useCallback(() => {
    const next: ConfettiPiece[] = [];
    for (let i = 0; i < 36; i++) {
      next.push({
        id: ++confettiId.current,
        left: Math.random() * 100,
        drift: Math.random() * 80 - 40,
        delay: Math.random() * 0.1,
        rotate: Math.random() * 360,
        color: CONFETTI_COLORS[
          Math.floor(Math.random() * CONFETTI_COLORS.length)
        ],
      });
    }
    setPieces(next);
    window.setTimeout(() => setPieces([]), 1600);
  }, []);

  return { pieces, play };
}

export function ConfettiLayer({ pieces }: { pieces: ConfettiPiece[] }) {
  if (pieces.length === 0) return null;
  return (
    <div className="confetti-layer">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={
            {
              left: `${p.left}vw`,
              background: p.color,
              transform: `rotate(${p.rotate}deg)`,
              animationDelay: `${p.delay}s`,
              "--drift": `${p.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
