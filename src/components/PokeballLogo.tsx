export function PokeballLogo() {
  return (
    <div className="flex flex-col items-center gap-3 mb-6">
      {/* Simple Pokeball SVG */}
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Top half - red */}
        <path
          d="M4 28 A24 24 0 0 1 52 28 Z"
          fill="#EF4444"
        />
        {/* Bottom half - white/light */}
        <path
          d="M4 28 A24 24 0 0 0 52 28 Z"
          fill="#e5e7eb"
        />
        {/* Outer circle border */}
        <circle cx="28" cy="28" r="24" stroke="#1f2937" strokeWidth="2" fill="none" />
        {/* Center horizontal band */}
        <rect x="4" y="25" width="48" height="6" fill="#1f2937" />
        {/* Center button outer */}
        <circle cx="28" cy="28" r="7" fill="#1f2937" />
        {/* Center button inner */}
        <circle cx="28" cy="28" r="4" fill="#f9fafb" />
        {/* Center button shine */}
        <circle cx="26.5" cy="26.5" r="1.2" fill="white" opacity="0.8" />
      </svg>
      <h1 className="text-3xl font-bold tracking-tight">
        <span className="text-red-500">Poké</span>
        <span className="text-white">RetoDex</span>
      </h1>
    </div>
  );
}
