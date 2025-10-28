export default function Check({ ok }) {
  return (
    <span
      className={`check ${ok ? "ok" : "fail"}`}
      aria-label={ok ? "Pass" : "Fail"}
      title={ok ? "Pass" : "Fail"}
    >
      {ok ? "✓" : "✗"}
    </span>
  );
}
