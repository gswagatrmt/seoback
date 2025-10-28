// client/src/components/HalfGauge.jsx
export default function HalfGauge({
  score = 0,
  label = "Score",
  size = 200,
}) {
  const v = Math.max(0, Math.min(100, score));
  const r = size / 2.3; // radius of semicircle
  const c = Math.PI * r; // circumference of half
  const dash = (c * v) / 100;

  const ringColor =
    v >= 90 ? "#22C55E" : v >= 70 ? "#F59E0B" : "#EF4444";

  const centerX = size / 2;
  const arcY = r + 10; // push arc toward top with small margin

  return (
    <svg
      width={size}
      height={r + size * 0.45} // enough space for arc + text
      viewBox={`0 0 ${size} ${r + size * 0.45}`}
      role="img"
      aria-label={`${label} ${v}`}
    >
      {/* Semicircle on top */}
      <g transform={`translate(${centerX}, ${arcY})`}>
        {/* background arc */}
        <path
          d={`M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0`}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="12"
        />
        {/* progress arc */}
        <path
          d={`M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0`}
          fill="none"
          stroke={ringColor}
          strokeWidth="12"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </g>

      {/* Score text under the arc */}
      <text
        x="50%"
        y={r + 45}
        textAnchor="middle"
        fontSize={size * 0.2}
        fontWeight="800"
        fill="#111827"
      >
        {v}
      </text>

      {/* Label below the score */}
      <text
        x="50%"
        y={r + 70}
        textAnchor="middle"
        fontSize={size * 0.1}
        fill="#6B7280"
      >
        {label}
      </text>
    </svg>
  );
}
