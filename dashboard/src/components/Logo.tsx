import { useId } from "react";

/**
 * SafeCity AI mark: a shield (safety) around a camera lens (cameras) with a
 * heart as the pupil (care). Source of truth: shared/branding/logo-mark.svg.
 */
export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  // useId returns ids like ":r0:"; colons break url(#...) references, so strip them.
  const gradientId = `sc-shield-${useId().replace(/:/g, "")}`;

  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="SafeCity AI">
      <defs>
        <linearGradient id={gradientId} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#5b9cff" />
          <stop offset="0.55" stopColor="#2a5bd7" />
          <stop offset="1" stopColor="#1b3a9e" />
        </linearGradient>
      </defs>
      <path
        d="M256 28 L440 84 V250 C440 372 360 456 256 492 C152 456 72 372 72 250 V84 Z"
        fill={`url(#${gradientId})`}
        stroke={`url(#${gradientId})`}
        strokeWidth="16"
        strokeLinejoin="round"
      />
      <path
        d="M256 28 L440 84 V250 C440 372 360 456 256 492 C152 456 72 372 72 250 V84 Z"
        transform="translate(256 260) scale(0.9) translate(-256 -260)"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.28"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <circle cx="256" cy="236" r="104" fill="#0a1128" />
      <circle cx="256" cy="236" r="104" fill="none" stroke="#ffffff" strokeWidth="24" />
      <circle cx="256" cy="236" r="66" fill="none" stroke="#3b82f6" strokeWidth="6" opacity="0.9" />
      <path
        transform="translate(256 240)"
        fill="#ffffff"
        d="M0 26 C-8 18 -34 0 -34 -16 C-34 -30 -22 -38 -12 -38 C-6 -38 -2 -34 0 -30 C2 -34 6 -38 12 -38 C22 -38 34 -30 34 -16 C34 0 8 18 0 26 Z"
      />
    </svg>
  );
}
