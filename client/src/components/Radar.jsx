import React, { useState, useEffect } from "react";

const dims = 260;
const cx = dims / 2, cy = dims / 2, r = 90;
const sections = ["On-Page", "Technical", "Performance", "Social"];

function polar(i, total, val) {
  const angle = (Math.PI * 2 * i / total) - Math.PI / 2;
  const rr = (val / 100) * r;
  return [cx + rr * Math.cos(angle), cy + rr * Math.sin(angle)];
}

export default function Radar({ scores }) {
  const vals = [
    scores.onpage ?? 0,
    scores.techlocal ?? 0,
    scores.performance ?? 0,
    scores.social ?? 0
  ];
  const points = vals.map((v, i) => polar(i, vals.length, v).join(",")).join(" ");

  // ✅ Detect small screen width
  const [isSmall, setIsSmall] = useState(window.innerWidth <= 600);
  useEffect(() => {
    const handleResize = () => setIsSmall(window.innerWidth <= 600);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <svg
      width="100%"
      height={dims}
      viewBox={`0 0 ${dims} ${dims}`}
      style={{ overflow: "visible" }}
    >
      {/* Outer ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#ffffff"
        stroke="#E5E7EB"
        strokeWidth="2"
        shapeRendering="geometricPrecision"
        vectorEffect="non-scaling-stroke"
      />

      {/* Axis lines */}
      {vals.map((_, i) => {
        const angle = (Math.PI * 2 * i / vals.length) - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#25262B" />;
      })}

      {/* Polygon data */}
      <polygon
        points={points}
        fill="rgba(255, 200, 0, 0.22)"
        stroke="#f4d475ff"
        strokeWidth="2"
      />

      {/* Labels */}
      {sections.map((label, i) => {
        const labelRadius = r + 28;
        let [x, y] = polar(i, sections.length, labelRadius);
        const angle = (Math.PI * 2 * i / sections.length) - Math.PI / 2;

        let anchor = "middle";
        if (Math.cos(angle) > 0.4) anchor = "start";
        if (Math.cos(angle) < -0.4) anchor = "end";

        let dy = "0.35em";
        if (Math.abs(Math.sin(angle)) > 0.9) {
          dy = Math.sin(angle) > 0 ? "1em" : "-0.5em";
        }

        // ✅ Adjust positions for small screens
        if (isSmall) {
          if (label === "Technical") {
            y += 25; // move down slightly
          } else if (label === "Social") {
            y -= 15; // move up slightly
          }
        }

        // ✅ Rotate only Technical & Social on small screens
        const rotateLabels =
          isSmall && (label === "Technical" || label === "Social");

        return (
          <text
            key={label}
            x={x}
            y={y}
            fontSize="12"
            fontWeight="700"
            fill="#9CA3AF"
            textAnchor={anchor}
            dy={dy}
            transform={rotateLabels ? `rotate(-90 ${x} ${y})` : undefined}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
