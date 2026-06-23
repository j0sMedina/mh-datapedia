import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useMonsters } from '../hooks/useMonsters';
import { MonsterCard } from '../components/monsters/MonsterCard';

export const Route = createFileRoute('/')({ component: LandingPage });

/* Ripple click effect: three concentric rings expand from the click point,
   then a blackout fades in before we navigate away. */
function HeroCTA({ children, onArrive }: { children: React.ReactNode; onArrive: () => void }) {
  const [fx, setFx] = useState<{ x: number; y: number; r: number } | null>(null);
  const fired = useRef(false);

  const handle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (fired.current) return;
    fired.current = true;
    const x = e.clientX, y = e.clientY;
    const w = window.innerWidth, h = window.innerHeight;
    const dx = Math.max(x, w - x), dy = Math.max(y, h - y);
    const r = Math.ceil(Math.hypot(dx, dy) / 20) + 2;
    setFx({ x, y, r });
    setTimeout(onArrive, 1150);
  };

  return (
    <>
      <button type="button" className="mh-cta" onClick={handle}>{children}</button>
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
    </>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  const { data } = useMonsters({ limit: 50 });
  const monsters = data?.data ?? [];

  return (
    <div
      style={{
        backgroundImage: 'url(/frontpage.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundAttachment: 'fixed',
        minHeight: 'calc(100vh - 3.5rem)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >

      {/* HERO — fills remaining space, title + button vertically centred */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden px-4 text-center">
        {/* radial scrim keeps title legible over bright vistas */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(120% 90% at 50% 42%, rgba(16,13,11,0.62) 0%, rgba(16,13,11,0.32) 45%, rgba(16,13,11,0.12) 100%)' }}
        />
        <div className="relative">
          <h1
            className="font-display font-bold text-5xl tracking-tight text-white mb-4"
            style={{ textShadow: '0 2px 24px rgba(0,0,0,0.6)' }}
          >
            MH <span style={{ color: 'var(--accent-hover)' }}>Datapedia</span>
          </h1>
          <p
            className="text-lg max-w-xl mx-auto mb-8"
            style={{ color: 'rgba(255,255,255,0.88)', textShadow: '0 1px 12px rgba(0,0,0,0.7)' }}
          >
            Hitzones, weaknesses, drop tables, and hunting strategies for every monster in Monster Hunter Wilds.
          </p>
          <HeroCTA onArrive={() => navigate({ to: '/monsters' })}>
            Browse All Monsters
          </HeroCTA>
        </div>
      </div>

      {/* GLASS BAND — frosted panel over the artwork with auto-scrolling marquee */}
      <div
        className="relative"
        style={{
          background: 'rgba(18,16,14,0.62)',
          backdropFilter: 'blur(22px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.3)',
          borderTop: '1px solid rgba(69,188,171,0.28)',
          borderBottom: '1px solid rgba(69,188,171,0.28)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 -20px 60px -40px rgba(0,0,0,0.7)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-7">
          <div className="mh-section-head text-xl whitespace-nowrap mb-6">Monster Hunter Wilds</div>

          {monsters.length > 0 && (
            <div className="mh-marquee">
              <div className="mh-marquee-track">
                {/* duplicate the list so the animation loops seamlessly */}
                {[...monsters, ...monsters].map((m, i) => (
                  <div key={m.id + '-' + i} className="w-52 shrink-0 mr-4">
                    <MonsterCard monster={m} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER — only visible on scroll */}
      <footer
        style={{
          background: 'rgba(12,10,9,0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(69,188,171,0.15)',
        }}
        className="py-5"
      >
        <div className="max-w-7xl mx-auto px-4 text-center text-stone-500 text-sm">
          MH Datapedia — fan-made field guide for Monster Hunter Wilds
        </div>
      </footer>
    </div>
  );
}
