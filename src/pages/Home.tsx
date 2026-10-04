import { useEffect, useState } from "react";
import { db } from "../database/db";
import { fmtDate, recap, type RecapRow } from "../database/logic";
import Badge from "../components/Badge";

export default function Home() {
  const [tab, setTab] = useState<"week" | "award">("week");
  const [s, setS] = useState({ members: 0, meetings: 0, badges: 0 });
  const [week, setWeek] = useState<{ date: string; rows: RecapRow[] } | null>(null);
  const [awards, setAwards] = useState<{ id: number; name: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      const [members, meetings, badges] = await Promise.all([
        db.members.count(),
        db.meetings.count(),
        db.achievement.where("badgeCount").above(0).count(),
      ]);
      setS({ members, meetings, badges });

      const mt = await db.meetings.orderBy("date").last();
      setWeek(mt ? { date: mt.date, rows: await recap(mt.id!) } : null);

      const ach = await db.achievement.where("badgeCount").above(0).toArray();
      const mem = await db.members.bulkGet(ach.map((a) => a.memberId));
      setAwards(
        ach
          .map((a, k) => ({ id: a.memberId, name: mem[k]?.name ?? "?", count: a.badgeCount }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      );
    })();
  }, []);

  const hadir = week?.rows.filter((r) => r.hadir).length ?? 0;

  return (
    <>
      <header className="header">
        <h1>HadrohTrack</h1>
        <p className="muted">Absensi dan pembagian alat hadroh</p>
      </header>

      <section className="group stats">
        <div className="stat"><strong>{s.members}</strong><span>Anggota</span></div>
        <div className="stat"><strong>{s.meetings}</strong><span>Pertemuan</span></div>
        <div className="stat"><strong>{s.badges}</strong><span>Badge aktif</span></div>
      </section>

      <div className="tabs spaced" role="tablist">
        <button className={tab === "week" ? "on" : ""} onClick={() => setTab("week")}>Ringkasan Minggu Ini</button>
        <button className={tab === "award" ? "on" : ""} onClick={() => setTab("award")}>Penerima Apresiasi</button>
      </div>

      {tab === "week" &&
        (!week ? (
          <p className="empty">Belum ada absensi. Mulai dari menu Absensi.</p>
        ) : (
          <>
            <p className="muted small pad-l">
              {fmtDate(week.date)}: {hadir} hadir, {week.rows.length - hadir} tidak hadir
            </p>
            <section className="group">
              {week.rows.map((r) => (
                <div className="list-row top" key={r.memberId}>
                  <div className="col">
                    <strong>{r.name}</strong>
                    {r.instrument && <span className="muted small">Primary: {r.instrument}</span>}
                    {!r.hadir && (
                      <span className="swap">
                        {r.replacedBy ? (
                          <>
                            Diganti oleh <strong>{r.replacedBy.name}</strong>
                            {r.replacedBy.role && <span className="muted">, {r.replacedBy.role}-nya {r.instrument}</span>}
                          </>
                        ) : (
                          <span className="muted">Belum ada pengganti</span>
                        )}
                      </span>
                    )}
                  </div>
                  <span className={"pill " + (r.hadir ? "pill-ok" : "pill-bad")}>{r.hadir ? "Hadir" : "Tidak hadir"}</span>
                </div>
              ))}
            </section>
          </>
        ))}

      {tab === "award" &&
        (awards.length === 0 ? (
          <p className="empty">Belum ada penerima apresiasi. Badge didapat setelah hadir 4 pertemuan.</p>
        ) : (
          <section className="group">
            {awards.map((a) => (
              <div className="list-row" key={a.id}>
                <span className="who"><span className="avatar">{a.name.charAt(0).toUpperCase()}</span>{a.name}</span>
                <Badge count={a.count} />
              </div>
            ))}
          </section>
        ))}
    </>
  );
}
