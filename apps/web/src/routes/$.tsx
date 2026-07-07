import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';

export const Route = createFileRoute('/$')({
  component: NotFoundPage,
});

function NotFoundPage() {
  const navigate = useNavigate();
  const [fx, setFx] = useState<{ x: number; y: number; r: number } | null>(null);
  const fired = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleClick() {
    if (fired.current || !btnRef.current) return;
    fired.current = true;
    const rect = btnRef.current.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const w = window.innerWidth, h = window.innerHeight;
    const dx = Math.max(x, w - x), dy = Math.max(y, h - y);
    const r = Math.ceil(Math.hypot(dx, dy) / 20) + 2;
    setFx({ x, y, r });
    setTimeout(() => navigate({ to: '/' }), 1150);
  }

  return (
    <div
      className="relative overflow-hidden flex items-center justify-center p-4"
      style={{ minHeight: 'calc(100vh - 3.5rem)' }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center scale-110"
        style={{ backgroundImage: "url('/wyveria.avif')", filter: 'blur(24px)' }}
      />
      <div className="absolute inset-0 bg-black/60" />

      <div
        className="mh-panel mh-panel--accent mh-glass relative z-10 w-full flex flex-col items-center text-center px-8 py-10 gap-6"
        style={{ '--mh-cut': '18px', maxWidth: 400 } as React.CSSProperties}
      >
        <img
          src="/arkveld.png"
          alt="Arkveld"
          className="w-80 drop-shadow-2xl select-none"
          draggable={false}
        />
        <div>
          <p className="text-6xl font-display font-bold text-white tracking-tight">404</p>
          <p className="text-stone-300 mt-1 text-sm">This page was consumed by Arkveld.</p>
        </div>
        <button ref={btnRef} type="button" className="mh-cta" onClick={handleClick}>
          Back to home
        </button>
      </div>

      {fx && (
        <div
          className="mh-ripple-wrap"
          style={{ '--mh-x': fx.x + 'px', '--mh-y': fx.y + 'px', '--mh-r': fx.r } as React.CSSProperties}
        >
          <span className="mh-ripple" />
          <span className="mh-ripple mh-ripple--2" />
          <span className="mh-ripple mh-ripple--3" />
          <div className="mh-blackout" />
        </div>
      )}
    </div>
  );
}
