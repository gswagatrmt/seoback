// client/src/components/FullGauge.jsx
export default function FullGauge({
  score = 0,
  letter = "N/A",
  label = "Score",
  size = 180,
}) {
  const v = Math.max(0, Math.min(100, score));
  const radius = size / 2.6;
  const circumference = 2 * Math.PI * radius;
  const dash = ((100 - v) / 100) * circumference;

const ringColor =
  v >= 90 ? "#16A34A" :  // Dark Green
  v >= 80 ? "#4ADE80" :  // Light Green
  v >= 65 ? "#F59E0B" :  // Yellow
  v >= 50 ? "#F97316" :  // Orange
  v >= 30 ? "#DC2626" :  // Red
  "#B91C1C";             // Dark Red


  const center = size / 2;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label} ${letter}`}
      >
        {/* background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="12"
        />
        {/* progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={dash}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
        {/* Letter grade in the center */}
        <text
          x="50%"
          y="52%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.3}
          fontWeight="600"
          fill="#95a4c4ff"
        >
          {score}
        </text>
      </svg>

      {/* Label outside (below gauge) */}
      <div
        style={{
          marginTop: 6,
          fontSize: size * 0.1,
          color: "#6B7280",
          textAlign: "center",
        }}
      >
        {label}
      </div>
    </div>
  );
}
