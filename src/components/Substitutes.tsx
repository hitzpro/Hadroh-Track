import { useCallback, useEffect, useState } from "react";
import { db } from "../database/db";
import { recommend, type Rec } from "../database/logic";

export default function Substitutes({ meetingId, memberId }: { meetingId: number; memberId: number }) {
  const [r, setR] = useState<Rec | null>(null);

  const load = useCallback(() => {
    recommend(meetingId, memberId).then(setR);
  }, [meetingId, memberId]);

  useEffect(() => { load(); }, [load]);

  async function pick(c: Rec["list"][number]) {
    if (!r?.instrument) return;
    setR({ ...r, list: r.list.map((x) => ({ ...x, chosen: x.memberId === c.memberId && !c.chosen })) });
    await db.assignments.where("meetingId").equals(meetingId).and((a) => a.replaces === memberId).delete();
    if (!c.chosen)
      await db.assignments.put({ meetingId, memberId: c.memberId, instrumentId: r.instrument.id!, replaces: memberId });
    load();
  }

  if (!r) return null;
  if (!r.instrument) return <div className="sub muted">Alat Primary anggota ini belum diatur.</div>;

  return (
    <div className="sub">
      <p className="sub-title">Rekomendasi pengganti {r.instrument.name}</p>
      {r.list.length === 0 && <p className="muted">Belum ada kandidat yang hadir dan terdaftar di alat ini.</p>}
      {r.list.map((c, i) => (
        <div className="rec" key={c.memberId}>
          <div>
            <strong>{i + 1}. {c.name}</strong>
            {c.reasons.map((t) => <div className="muted small" key={t}>{t}</div>)}
          </div>
          <button className={"btn small-btn " + (c.chosen ? "primary" : "ghost")} onClick={() => pick(c)}>
            {c.chosen ? "Dipilih" : "Pilih"}
          </button>
        </div>
      ))}
      <p className="muted small">Hanya saran. Keputusan tetap di pengurus.</p>
    </div>
  );
}
