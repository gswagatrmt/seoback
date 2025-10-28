// client/src/components/HeadingMatrix.jsx
export default function HeadingMatrix({ levels }) {
  const order = ["h2", "h3", "h4", "h5", "h6"];
  const vals = order.map((k) => Number(levels?.[k] ?? 0));

  return (
    <div className="matrix-table">
      <div className="matrix-row matrix-head">
        {order.map((k) => (
          <div key={k} className="matrix-cell head">
            {k.toUpperCase()}
          </div>
        ))}
      </div>
      <div className="matrix-row">
        {vals.map((v, i) => (
          <div key={i} className="matrix-cell">
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}
