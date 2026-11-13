export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect x="2" y="2" width="32" height="32" rx="9" fill="#1D4ED8" />
        <path
          d="M11 11.5C11 10.6716 11.6716 10 12.5 10H21.5L25 13.5V24.5C25 25.3284 24.3284 26 23.5 26H12.5C11.6716 26 11 25.3284 11 24.5V11.5Z"
          fill="#FFFFFF"
        />
        <path d="M21 10V14H25" fill="#DDD6FE" />
        <path
          d="M14.5 17.5H21.5M21.5 17.5L19.2 15.2M21.5 17.5L19.2 19.8"
          stroke="#6D28D9"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21.5 21.5H14.5M14.5 21.5L16.8 19.2M14.5 21.5L16.8 23.8"
          stroke="#2563EB"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
        NOTE <span className="text-blue-600">X</span><span className="text-violet-700">CHANGE</span>
      </span>
    </span>
  );
}
