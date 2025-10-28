export default function GaugeScore({ score=0, size=150, label="Performance" }) {
  const s = Math.max(0, Math.min(100, score));
  const radius = 64;
  const c = 2 * Math.PI * radius;
  const pct = (100 - s) / 100;
  const dash = c * pct;
const color =
  s >= 90 ? "#16A34A" :   // Dark Green
  s >= 80 ? "#4ADE80" :   // Light Green
  s >= 65 ? "#F59E0B" :   // Yellow
  s >= 50 ? "#F97316" :   // Orange
  s >= 30 ? "#DC2626" :   // Red
  "#B91C1C";              // Dark Red


  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>
      </defs>
      <g transform="translate(80,80) rotate(-90)">
        <circle r={radius} fill="none" stroke="#0C0D0F" strokeWidth="12" />
        <circle
          r={radius}
          fill="none"
          stroke="url(#grad)"
          strokeWidth="12"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={dash}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </g>
      <text x="50%" y="52%" textAnchor="middle" fontSize="28" fontWeight="800" fill="#E5E7EB">
        {s}
      </text>
     <text x="50%" y="66%" textAnchor="middle" fontSize="11" fill="#9CA3AF">{label}</text>
    </svg>
  );
}
