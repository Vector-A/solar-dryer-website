interface IconProps {
  className?: string;
}

export default function DropletIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3c-2.7 3.1-6 6.6-6 10.2A6 6 0 0 0 18 13.2C18 9.6 14.7 6.1 12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
