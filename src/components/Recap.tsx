import { useEffect, useState } from "react";
import { db, type Meeting } from "../database/db";
import { fmtDate, recap, type RecapRow } from "../database/logic";

export default function Recap() {
  const [ms, setMs] = useState<Meeting[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [rows, setRows] = useState<RecapRow[]>([]);

  useEffect(() => {
    db.meetings.orderBy("date").reverse().toArray().then((m) => {
      setMs(m);
      setSel(m[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (sel === null) setRows([]);
    else recap(sel).then(setRows);
  }, [sel]);

  if (!ms.length) return <p className="empty">Belum ada pertemuan. Isi absensi dulu di tab Input.</p>;

  const hadir = rows.filter((r) => r.hadir).length;

  return (
    <>
      <select className="select full" value={sel ?? ""} onChange={(e) => setSel(+e.target.value)} aria-label="Pilih pertemuan">
        {ms.map((m) => <option key={m.id} value={m.id}>{fmtDate(m.date)}</option>)}
      </select>
      <p className="muted small pad-l">{hadir} hadir, {rows.length - hadir} tidak hadir</p>

      <section className="group scroll-x">
        <table className="tbl">
          <thead>
            <tr><th>Nama</th><th>Status</th><th>Alat</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.memberId}>
                <td>{r.name}</td>
                <td><span className={"pill " + (r.hadir ? "pill-ok" : "pill-bad")}>{r.hadir ? "Hadir" : "Tidak"}</span></td>
                <td>
                  {r.instrument ?? "-"}
                  {r.hadir && r.covering && <div className="muted small">Pengganti {r.covering}</div>}
                  {!r.hadir && (
                    <div className="muted small">
                      {r.replacedBy ? `Diganti ${r.replacedBy.name}${r.replacedBy.role ? " (" + r.replacedBy.role + ")" : ""}` : "Belum ada pengganti"}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
