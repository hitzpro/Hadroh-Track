import { useCallback, useEffect, useState } from "react";
import { db, Instrument, Role } from "../database/db";
import { ROLES, ROLE_LABEL, Nav, deleteMember, enroll, usage } from "../database/logic";
import Badge from "../components/Badge";

type Roles = Record<Role, number | "">;

export default function MemberDetail({ id, go }: { id: number; go: Nav }) {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");
  const [ins, setIns] = useState<Instrument[]>([]);
  const [roles, setRoles] = useState<Roles>({ primary: "", secondary: "", tertiary: "" });
  const [info, setInfo] = useState({ hadir: 0, use: [] as [string, number][], streak: 0, badges: 0 });

  const load = useCallback(async () => {
    const [m, all, enr, u, a] = await Promise.all([
      db.members.get(id),
      db.instruments.toArray(),
      db.member_instruments.where("memberId").equals(id).toArray(),
      usage(id),
      db.achievement.get(id),
    ]);
    if (!m) return go("members");
    const r: Roles = { primary: "", secondary: "", tertiary: "" };
    enr.forEach((e) => { r[e.role] = e.instrumentId; });
    const nm = new Map(all.map((i) => [i.id!, i.name]));
    setName(m.name); setSaved(m.name); setIns(all); setRoles(r);
    setInfo({
      hadir: u.hadir,
      use: Object.entries(u.out).filter(([, n]) => n > 0).map(([k, n]) => [nm.get(+k) ?? "?", n] as [string, number]).sort((x, y) => y[1] - x[1]),
      streak: a?.streakCount ?? 0,
      badges: a?.badgeCount ?? 0,
    });
  }, [id, go]);

  useEffect(() => { load(); }, [load]);

  async function rename() {
    await db.members.update(id, { name: name.trim() });
    load();
  }

  async function pick(role: Role, v: string) {
    const iid = v ? +v : null;
    setRoles((r) => {
      const n = { ...r, [role]: iid ?? "" };
      ROLES.forEach((k) => { if (k !== role && iid && n[k] === iid) n[k] = ""; });
      return n;
    });
    const err = await enroll(id, role, iid);
    if (err) alert(err);
    load();
  }

  async function remove() {
    if (confirm(`Hapus ${saved}? Riwayat absensinya ikut terhapus.`)) {
      await deleteMember(id);
      go("members");
    }
  }

  return (
    <>
      <button className="back" onClick={() => go("members")}>‹ Anggota</button>
      <header className="header"><h1>{saved}</h1></header>

      <section className="group">
        <div className="list-row">
          <input className="plain" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nama anggota" />
          {name.trim() && name !== saved && <button className="btn primary small-btn" onClick={rename}>Simpan</button>}
        </div>
      </section>

      <h2 className="section-title">Statistik</h2>
      <section className="group">
        <div className="list-row"><span>Total hadir</span><strong>{info.hadir}</strong></div>
        <div className="list-row"><span>Progress apresiasi</span><strong>{info.streak} / 4</strong></div>
        {info.badges > 0 && (
          <div className="list-row"><span>Badge</span><Badge count={info.badges} /></div>
        )}
      </section>

      <h2 className="section-title">Jumlah memainkan alat</h2>
      <section className="group">
        {info.use.length === 0 && <div className="list-row muted">Belum ada riwayat.</div>}
        {info.use.map(([n, c]) => (
          <div className="list-row" key={n}><span>{n}</span><span className="muted">{c} kali</span></div>
        ))}
      </section>

      <h2 className="section-title">Pengaturan alat</h2>
      <section className="group">
        {ROLES.map((role) => (
          <div className="list-row" key={role}>
            <span>{ROLE_LABEL[role]}{role !== "tertiary" && <span className="muted small"> (wajib)</span>}</span>
            <select className="select" value={roles[role]} onChange={(e) => pick(role, e.target.value)}>
              <option value="">{role === "tertiary" ? "Tidak ada" : "Belum dipilih"}</option>
              {ins.map((i) => (
                <option key={i.id} value={i.id} disabled={ROLES.some((k) => k !== role && roles[k] === i.id)}>{i.name}</option>
              ))}
            </select>
          </div>
        ))}
      </section>

      <button className="btn text-danger" onClick={remove}>Hapus anggota</button>
    </>
  );
}
