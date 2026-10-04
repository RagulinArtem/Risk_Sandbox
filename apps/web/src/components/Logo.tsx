/** Shock Lens brand: the refracted lens (charcoal top, coral bottom, broken
 * by a shock line). The wordmark is real text so it always uses the app's
 * font; text inside an SVG would fall back unpredictably across machines. */

export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} role="img" aria-label="Shock Lens">
      <path
        d="M 30 0 A 30 30 0 0 1 60 30 L 38 30 L 30 18 L 2.5 18 A 30 30 0 0 1 30 0 Z"
        fill="#09090B"
      />
      <path
        d="M 30 60 A 30 30 0 0 1 0 30 L 22 30 L 30 42 L 57.5 42 A 30 30 0 0 1 30 60 Z"
        fill="#E53935"
      />
    </svg>
  );
}

export function Wordmark({ className = "text-lg" }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight text-[#09090B] ${className}`}>
      Shock <span className="font-normal text-[#71717A]">Lens</span>
    </span>
  );
}
