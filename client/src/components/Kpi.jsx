export default function Kpi({ label, value, hint }){
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="label">{hint}</div>}
    </div>
  );
}
