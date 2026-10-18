export function ScenicHeaderIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 540 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="skyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="waterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#0284c7" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0369a1" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="treeGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
        <linearGradient id="treeGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
        <linearGradient id="buildingGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="buildingGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Background soft clouds */}
      <path
        d="M60 40 Q80 20 110 30 Q130 15 160 30 Q190 25 210 45 Z"
        fill="#ffffff"
        fillOpacity="0.7"
      />
      <path
        d="M260 35 Q285 18 315 28 Q340 12 370 26 Q400 22 420 40 Z"
        fill="#ffffff"
        fillOpacity="0.6"
      />

      {/* Distant building silhouettes */}
      <rect x="70" y="38" width="18" height="48" rx="2" fill="url(#buildingGrad2)" />
      <rect x="92" y="24" width="22" height="62" rx="2" fill="url(#buildingGrad2)" />
      <rect x="118" y="44" width="16" height="42" rx="2" fill="url(#buildingGrad2)" />
      <rect x="148" y="32" width="24" height="54" rx="2" fill="url(#buildingGrad1)" />
      <rect x="176" y="20" width="20" height="66" rx="2" fill="url(#buildingGrad1)" />
      <polygon points="186,10 183,20 189,20" fill="#60a5fa" />
      <rect x="200" y="40" width="18" height="46" rx="2" fill="url(#buildingGrad2)" />
      <rect x="232" y="28" width="28" height="58" rx="2" fill="url(#buildingGrad1)" />
      <rect x="264" y="36" width="20" height="50" rx="2" fill="url(#buildingGrad1)" />
      <rect x="288" y="48" width="16" height="38" rx="2" fill="url(#buildingGrad2)" />

      {/* Building windows detail */}
      <g fill="#ffffff" fillOpacity="0.5">
        <rect x="96" y="30" width="4" height="4" rx="1" />
        <rect x="104" y="30" width="4" height="4" rx="1" />
        <rect x="96" y="40" width="4" height="4" rx="1" />
        <rect x="104" y="40" width="4" height="4" rx="1" />
        <rect x="154" y="38" width="4" height="5" rx="1" />
        <rect x="162" y="38" width="4" height="5" rx="1" />
        <rect x="154" y="48" width="4" height="5" rx="1" />
        <rect x="162" y="48" width="4" height="5" rx="1" />
        <rect x="180" y="28" width="3" height="4" rx="1" />
        <rect x="186" y="28" width="3" height="4" rx="1" />
        <rect x="180" y="36" width="3" height="4" rx="1" />
        <rect x="186" y="36" width="3" height="4" rx="1" />
        <rect x="238" y="34" width="5" height="5" rx="1" />
        <rect x="248" y="34" width="5" height="5" rx="1" />
      </g>

      {/* Rolling hills & trees on left and right */}
      <path
        d="M-20 86 Q40 68 110 82 Q180 94 250 84 Q320 74 390 82 Q460 68 560 84 L560 140 L-20 140 Z"
        fill="url(#treeGrad2)"
      />
      <circle cx="340" cy="72" r="22" fill="url(#treeGrad1)" />
      <circle cx="365" cy="68" r="26" fill="url(#treeGrad2)" />
      <circle cx="395" cy="64" r="30" fill="url(#treeGrad1)" />
      <circle cx="430" cy="62" r="32" fill="url(#treeGrad2)" />
      <circle cx="468" cy="60" r="34" fill="url(#treeGrad1)" />
      <circle cx="505" cy="58" r="36" fill="url(#treeGrad2)" />
      <circle cx="538" cy="56" r="36" fill="url(#treeGrad1)" />

      {/* Left hills and trees */}
      <circle cx="15" cy="75" r="24" fill="url(#treeGrad1)" />
      <circle cx="45" cy="72" r="26" fill="url(#treeGrad2)" />
      <circle cx="78" cy="76" r="20" fill="url(#treeGrad1)" />

      {/* Lake / Water surface with ripples */}
      <path
        d="M-20 102 C60 96 160 106 270 98 C380 90 480 104 560 98 L560 140 L-20 140 Z"
        fill="url(#waterGrad)"
      />
      {/* Water shine and ripple lines */}
      <path
        d="M40 108 Q120 104 200 110 M260 106 Q340 102 420 108 M110 118 Q190 114 280 120 M320 117 Q400 113 490 118 M160 128 Q250 124 350 130"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeOpacity="0.45"
        strokeLinecap="round"
      />
    </svg>
  );
}
