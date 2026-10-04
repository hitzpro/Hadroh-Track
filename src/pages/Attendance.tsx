import { Fragment, useCallback, useEffect, useState } from "react";
import { db, type Member, type Status } from "../database/db";
import { CYCLE, ensureMeeting, fmtDate, recompute, todayLocal } from "../database/logic";
import Badge from "../components/Badge";
import Substitutes from "../components/Substitutes";
import Recap from "../components/Recap";

type Ach = Record<number, { streakCount: number; badgeCount: number }>;

export default function Attendance() {
  const [date, setDate] = useState(todayLocal());
  const [meetingId, setMeetingId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [state, setState] = useState<Record<number, Status>>({});
  const [ach, setAch] = useState<Ach>({});
  const [open, setOpen] = useState<number | null>(null);
  const [tab, setTab] = useState<"input" | "rekap">("input");

  const loadAch = async () =>
    setAch(Object.fromEntries((await db.achievement.toArray()).map((a) => [a.memberId, a])));

  const load = useCallback(async () => {
    const mt = await db.meetings.where("date").equals(date).first();
    const [m, rows] = await Promise.all([
      db.members.orderBy("name").toArray(),
      mt ? db.attendance.where("meetingId").equals(mt.id!).toArray() : Promise.resolve([]),
    ]);
    setMeetingId(mt?.id ?? null);
    setMembers(m);
    setState(Object.fromEntries(rows.map((r) => [r.memberId, r.status])));
    setOpen(null);
    loadAch();
  }, [date]);

  useEffect(() => { load(); }, [load]);

  // Ketuk status yang sama lagi = batalkan
  async function setStatus(id: number, status: Status) {
    const clear = state[id] === status;
    setState(({ [id]: _, ...rest }) => (clear ? rest : { ...rest, [id]: status }));

    const mid = meetingId ?? (await ensureMeeting(date));
    setMeetingId(mid);
    const ex = await db.attendance.where("[meetingId+memberId]").equals([mid, id]).first();
    if (status === "hadir" || clear) await db.assignments.where("meetingId").equals(mid).and((a) => a.replaces === id).delete();

    if (clear && ex) {
      await db.attendance.delete(ex.id!);
      if ((await db.attendance.where("meetingId").equals(mid).count()) === 0) {
        await db.assignments.where("meetingId").equals(mid).delete();
        await db.meetings.delete(mid);
        setMeetingId(null);
      }
    } else if (ex) await db.attendance.update(ex.id!, { status });
    else await db.attendance.add({ meetingId: mid, memberId: id, status });

    await recompute();
    loadAch();
  }

  async function markAllPresent() {
    const mid = await ensureMeeting(date);
    setMeetingId(mid);
    setState(Object.fromEntries(members.map((m) => [m.id!, "hadir" as Status])));
    await db.transaction("rw", [db.attendance, db.assignments], async () => {
      await db.assignments.where("meetingId").equals(mid).delete();
      const have = new Map((await db.attendance.where("meetingId").equals(mid).toArray()).map((e) => [e.memberId, e]));
      for (const m of members) {
        const e = have.get(m.id!);
        if (e) await db.attendance.update(e.id!, { status: "hadir" });
        else await db.attendance.add({ meetingId: mid, memberId: m.id!, status: "hadir" });
      }
    });
    await recompute();
    loadAch();
  }

  const v = Object.values(state);
  const hadir = v.filter((x) => x === "hadir").length;
  const tidak = v.filter((x) => x === "tidak hadir").length;

  return (
    <>
      <header className="header">
        <h1>Absensi</h1>
        <p className="muted">{tab === "input" ? fmtDate(date) : "Rekap per pertemuan"}</p>
      </header>

      <div className="tabs" role="tablist">
        <button className={tab === "input" ? "on" : ""} onClick={() => setTab("input")}>Input</button>
        <button className={tab === "rekap" ? "on" : ""} onClick={() => setTab("rekap")}>Rekap</button>
      </div>

      {tab === "rekap" ? <Recap /> : (<>
      <div className="toolbar">
        <input className="input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button className="btn ghost" onClick={markAllPresent} disabled={!members.length}>Semua hadir</button>
      </div>

      <section className="group stats compact">
        <div className="stat"><strong className="ok">{hadir}</strong><span>Hadir</span></div>
        <div className="stat"><strong className="bad">{tidak}</strong><span>Tidak</span></div>
        <div className="stat"><strong>{members.length - hadir - tidak}</strong><span>Belum</span></div>
      </section>

      {members.length === 0 ? (
        <p className="empty">Tambah anggota dulu di menu Anggota.</p>
      ) : (
        <section className="group">
          {members.map((m) => {
            const a = ach[m.id!];
            const n = a?.streakCount ?? 0;
            const st = state[m.id!];
            return (
              <Fragment key={m.id}>
                <div className="list-row">
                  <span className="who">
                    <span className="avatar">{m.name.charAt(0).toUpperCase()}</span>
                    <span className="col">
                      <span>{m.name}</span>
                      <span className="prog">
                        <span className="dots" aria-hidden="true">
                          {Array.from({ length: CYCLE }, (_, i) => <i key={i} className={i < n ? "on" : ""} />)}
                        </span>
                        <span className="muted small">{n} / {CYCLE}</span>
                        {a?.badgeCount > 0 && <Badge count={a.badgeCount} />}
                      </span>
                      {st === "tidak hadir" && meetingId && (
                        <button className="link" onClick={() => setOpen(open === m.id ? null : m.id!)}>
                          {open === m.id ? "Tutup rekomendasi" : "Rekomendasi pengganti"}
                        </button>
                      )}
                    </span>
                  </span>

                  <div className="seg" role="group" aria-label={`Status ${m.name}`}>
                    <button className={st === "hadir" ? "on-ok" : ""} onClick={() => setStatus(m.id!, "hadir")}>Hadir</button>
                    <button className={st === "tidak hadir" ? "on-bad" : ""} onClick={() => setStatus(m.id!, "tidak hadir")}>Tidak</button>
                  </div>
                </div>
                {open === m.id && meetingId && st === "tidak hadir" && <Substitutes meetingId={meetingId} memberId={m.id!} />}
              </Fragment>
            );
          })}
        </section>
      )}
      </>)}
    </>
  );
}
