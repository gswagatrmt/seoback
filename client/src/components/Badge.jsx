export default function Badge({ letter="N/A" }){
  const key = letter.replace("+","p");
  return <span className={`badge ${key}`}>{letter}</span>;
}
