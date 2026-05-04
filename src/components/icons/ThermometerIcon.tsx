interface IconProps {
  className?: string;
}

export default function ThermometerIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
