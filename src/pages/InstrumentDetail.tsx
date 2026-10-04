import { useCallback, useEffect, useState } from "react";
import { db, Instrument, Member, MemberInstrument, Role } from "../database/db";
import { ROLES, ROLE_LABEL, Nav, enroll } from "../database/logic";

export default function InstrumentDetail({ id, go }: { id: number; go: Nav }) {
  const [ins, setIns] = useState<Instrument | null>(null);
  const [list, setList] = useState<{ e: MemberInstrument; name: string }[]>([]);
  const [sheet, setSheet] = useState(false);
  const [role, setRole] = useState<Role>("primary");
  const [pool, setPool] = useState<Member[]>([]);

  const load = useCallback(async () => {
    const [i, enr] = await Promise.all([
      db.instruments.get(id),
      db.member_instruments.where("instrumentId").equals(id).toArray(),
    ]);
    if (!i) return go("instruments");
    const ms = await db.members.bulkGet(enr.map((e) => e.memberId));
    setIns(i);
    setList(enr.map((e, k) => ({ e, name: ms[k]?.name ?? "?" })).sort((a, b) => a.name.localeCompare(b.name)));
  }, [id, go]);

  useEffect(() => { load(); }, [load]);

  async function setCap(n: number) {
    if (!ins || n < 1) return;
    setIns({ ...ins, capacity: n });
    await db.instruments.update(id, { capacity: n });
  }

  async function openSheet() {
    const all = await db.members.orderBy("name").toArray();
    const taken = new Set(list.map((x) => x.e.memberId));
    setPool(all.filter((m) => !taken.has(m.id!)));
    setSheet(true);
  }

  async function add(m: Member) {
    const err = await enroll(m.id!, role, id);
    if (err) return alert(err);
    setSheet(false);
    load();
  }

  if (!ins) return null;
  const primaryCount = list.filter((x) => x.e.role === "primary").length;

  return (
    <>
      <button className="back" onClick={() => go("instruments")}>‹ Alat</button>
      <header className="header"><h1>{ins.name}</h1></header>

      <section className="group">
        <div className="list-row">
          <span>Kapasitas maksimum</span>
          <div className="qty">
            <button onClick={() => setCap(ins.capacity - 1)} aria-label="Kurangi">−</button>
            <strong>{ins.capacity}</strong>
            <button onClick={() => setCap(ins.capacity + 1)} aria-label="Tambah">+</button>
          </div>
        </div>
      </section>

      {ROLES.map((r) => {
        const rows = list.filter((x) => x.e.role === r);
        return (
          <div key={r}>
            <h2 className="section-title">
              {ROLE_LABEL[r]}{r === "primary" ? ` (${primaryCount} / ${ins.capacity})` : ""}
            </h2>
            <section className="group">
              {rows.length === 0 && <div className="list-row muted">Belum ada</div>}
              {rows.map((x) => (
                <button className="list-row tap" key={x.e.id} onClick={() => go("member", x.e.memberId)}>
                  <span>{x.name}</span>
                  <span className="chevron" aria-hidden="true">›</span>
                </button>
              ))}
            </section>
          </div>
        );
      })}

      <button className="btn primary wide" onClick={openSheet}>Enroll Anggota</button>

      {sheet && (
        <div className="overlay" onClick={() => setSheet(false)}>
          <div className="sheet tall" onClick={(e) => e.stopPropagation()}>
            <h2>Enroll ke {ins.name}</h2>
            <div className="seg full" role="group" aria-label="Peran">
              {ROLES.map((r) => (
                <button key={r} className={role === r ? "on-ok" : ""} onClick={() => setRole(r)}>{ROLE_LABEL[r]}</button>
              ))}
            </div>
            <div className="group scroll">
              {pool.length === 0 && <div className="list-row muted">Semua anggota sudah terdaftar.</div>}
              {pool.map((m) => (
                <button className="list-row tap" key={m.id} onClick={() => add(m)}>{m.name}</button>
              ))}
            </div>
            <button className="btn ghost wide" onClick={() => setSheet(false)}>Tutup</button>
          </div>
        </div>
      )}
    </>
  );
}
