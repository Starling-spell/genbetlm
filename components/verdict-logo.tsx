// Verdict mark: a checkmark inside a hexagonal validator "shield" — the answer
// has passed consensus. Monochrome (uses currentColor) so it sits cleanly inside
// the gradient brand orb or any tinted container.
export function VerdictLogo({
  size = 18,
  className
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2.3 19.7 6.85v10.3L12 21.7 4.3 17.15V6.85z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.4 12.3 10.8 14.7 15.6 9.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
