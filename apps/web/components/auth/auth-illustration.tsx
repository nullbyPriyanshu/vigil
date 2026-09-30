export function AuthIllustration() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden opacity-15 dark:opacity-30"
    >
      <div className="absolute top-[-10%] left-[-10%] h-[45%] w-[70%] -rotate-12 rounded-full bg-blue-600/25 blur-[120px]" />
      <div className="absolute top-[15%] right-[-15%] h-[40%] w-[75%] rotate-[-18deg] rounded-full bg-emerald-500/30 blur-[120px]" />
      <div className="absolute top-[35%] left-[5%] h-[30%] w-[60%] rotate-[-8deg] rounded-full bg-teal-400/20 blur-[110px]" />
      <div className="absolute top-[30%] left-[40%] h-[18%] w-[35%] rotate-[-15deg] rounded-full bg-cyan-300/15 blur-[90px]" />
      <div className="absolute right-[-10%] bottom-[-15%] h-[40%] w-[60%] rotate-[10deg] rounded-full bg-indigo-600/25 blur-[130px]" />
      <div className="absolute bottom-[-10%] left-[-5%] h-[35%] w-[45%] rounded-full bg-emerald-700/20 blur-[120px]" />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(255_255_255/0.6)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(9_9_11/0.7)_100%)]" />

      <svg className="absolute inset-0 size-full opacity-[0.05] mix-blend-overlay">
        <filter id="auth-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#auth-grain)" />
      </svg>
    </div>
  );
}
