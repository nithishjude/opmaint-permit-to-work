/** The module's mark: a hazard triangle inside a permit tag. Designed, not borrowed. */
export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill="#f5a524" />
      <path d="M16 7.5 25.5 24h-19Z" fill="none" stroke="#0b2545" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M16 13.5v4.6" stroke="#0b2545" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16" cy="21" r="1.5" fill="#0b2545" />
    </svg>
  );
}
