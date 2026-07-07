import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/$')({
  component: NotFoundPage,
});

function NotFoundPage() {
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

      <div className="relative z-10 max-w-sm w-full bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl flex flex-col items-center text-center px-8 py-10 gap-6">
        <img
          src="/arkveld.png"
          alt="Arkveld"
          className="w-64 drop-shadow-2xl select-none"
          draggable={false}
        />
        <div>
          <p className="text-6xl font-display font-bold text-white tracking-tight">404</p>
          <p className="text-stone-300 mt-1 text-sm">This page was consumed by Arkveld.</p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-stone-950 font-semibold text-sm hover:bg-accent-hover transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
