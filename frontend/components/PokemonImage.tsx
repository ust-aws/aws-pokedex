"use client";

import { useState } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
};

function Placeholder({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 120"
      role="img"
      aria-label="No image available"
      className={className}
    >
      <g transform="rotate(-15 50 60)">
        <rect
          x="22"
          y="14"
          width="56"
          height="92"
          rx="10"
          fill="#7be8c0"
          stroke="#1e1b4b"
          strokeWidth="4"
        />
        <rect
          x="30"
          y="24"
          width="40"
          height="32"
          rx="3"
          fill="#fbd5d5"
          stroke="#8b93d9"
          strokeWidth="3"
        />
        <path d="M52 30c8 0 12 5 12 12-8 0-14-4-12-12z" fill="#8b93d9" />
        <path
          d="M36 72h12M42 66v12"
          stroke="#f5a700"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle cx="62" cy="70" r="3.5" fill="#f5a700" />
        <circle cx="68" cy="78" r="3.5" fill="#f5a700" />
      </g>
    </svg>
  );
}

export default function PokemonImage({ src, alt, className = "" }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return <Placeholder className={className} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className={`object-contain ${className}`}
    />
  );
}
