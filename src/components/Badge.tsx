export default function Badge({ count = 1 }: { count?: number }) {
  return <span className="badge">⭐ Konsisten{count > 1 ? ` x${count}` : ""}</span>;
}
