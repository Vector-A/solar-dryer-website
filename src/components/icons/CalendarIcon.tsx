interface IconProps {
  className?: string;
}

export default function CalendarIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 3v4M17 3v4M3 9h18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
