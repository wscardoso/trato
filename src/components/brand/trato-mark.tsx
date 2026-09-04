type Props = {
  className?: string;
  title?: string;
};

/** Monograma T — dente de pente fino / tip of a retractable razor. */
export function TratoMark({ className, title = "Trato" }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Spine / blade stem */}
      <path
        d="M20 8v22"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Comb teeth / T crossbar */}
      <path
        d="M9 8h22"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M11 8v5M15.5 8v4M20 8v5.5M24.5 8v4M29 8v5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Razor tip */}
      <path
        d="M20 30l-3.2 4h6.4L20 30z"
        fill="currentColor"
      />
    </svg>
  );
}
