import { db, type Instrument, type Role } from "./db";

export type Nav = (page: string, id?: number) => void;

export const CYCLE = 4;
export const ROLES: Role[] = ["primary", "secondary", "tertiary"];
export const ROLE_LABEL: Record<Role, string> = {
  primary: "Primary",
  secondary: "Secondary",
  tertiary: "Tertiary",
};
export const DEFAULT_SCHEDULE = { day: "Minggu", time: "16:00", every: 2 };

const SEED = ["Rebana 1", "Rebana 2", "Rebana 3", "Rebana 4", "Tum Tam", "Keprak 1", "Keprak 2", "Darbuka", "Bass", "Kecrek"];

/* ---------- util ---------- */
export function todayLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function fmtDate(date: string) {
  return new Date(date + "T00:00").toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export async function seed() {
  if ((await db.instruments.count()) === 0)
    await db.instruments.bulkAdd(SEED.map((name) => ({ name, capacity: 4 })));
}

export async function ensureMeeting(date: string) {
  const m = await db.meetings.where("date").equals(date).first();
  return m ? m.id! : ((await db.meetings.add({ date })) as number);
}

/* ---------- apresiasi ----------
   Dihitung ulang dari riwayat absensi (urut tanggal), jadi mengubah / membatalkan
   absensi lama tetap konsisten. Hadir = +1. Tidak hadir = tidak bertambah.
   Jika ada yang mencapai CYCLE -> badge +1 untuk dia, lalu SEMUA counter direset. */
export async function recompute() {
  await db.transaction("rw", [db.meetings, db.attendance, db.members, db.achievement], async () => {
    const [ms, att, mem] = await Promise.all([
      db.meetings.orderBy("date").toArray(),
      db.attendance.toArray(),
      db.members.toArray(),
    ]);
    const present = new Map<number, number[]>();
    for (const a of att)
      if (a.status === "hadir") present.set(a.meetingId, [...(present.get(a.meetingId) || []), a.memberId]);

    const streak = new Map<number, number>();
    const badge = new Map<number, number>();
    mem.forEach((m) => { streak.set(m.id!, 0); badge.set(m.id!, 0); });

    for (const mt of ms) {
      let hit = false;
      for (const id of present.get(mt.id!) || []) {
        if (!streak.has(id)) continue;
        const n = streak.get(id)! + 1;
        streak.set(id, n);
        if (n >= CYCLE) { badge.set(id, badge.get(id)! + 1); hit = true; }
      }
      if (hit) for (const k of streak.keys()) streak.set(k, 0);
    }

    await db.achievement.bulkPut(
      mem.map((m) => ({ memberId: m.id!, streakCount: streak.get(m.id!)!, badgeCount: badge.get(m.id!)! }))
    );
  });
}

/* ---------- anggota ---------- */
export async function deleteMember(id: number) {
  await db.transaction("rw", [db.members, db.attendance, db.member_instruments, db.assignments, db.achievement], async () => {
    await db.members.delete(id);
    await db.attendance.where("memberId").equals(id).delete();
    await db.member_instruments.where("memberId").equals(id).delete();
    await db.assignments.where("memberId").equals(id).delete();
    await db.achievement.delete(id);
  });
  await recompute();
}

/* ---------- enrollment alat ----------
   instrumentId = null -> kosongkan role tersebut. Return pesan error jika gagal. */
export async function enroll(memberId: number, role: Role, instrumentId: number | null) {
  if (instrumentId !== null && role === "primary") {
    const ins = await db.instruments.get(instrumentId);
    const used = await db.member_instruments
      .where("instrumentId").equals(instrumentId)
      .and((e) => e.role === "primary" && e.memberId !== memberId).count();
    if (ins && used >= ins.capacity) return `${ins.name} sudah penuh (${ins.capacity} orang Primary).`;
  }
  await db.transaction("rw", db.member_instruments, async () => {
    await db.member_instruments
      .where("memberId").equals(memberId)
      .and((e) => e.role === role || e.instrumentId === instrumentId).delete();
    if (instrumentId !== null) await db.member_instruments.add({ memberId, instrumentId, role });
  });
  return null;
}

/* ---------- riwayat alat ----------
   Hadir tanpa penugasan = memainkan alat Primary. Penugasan pengganti dihitung ke alat tugasnya. */
export async function usage(memberId: number) {
  const [att, asg, prim] = await Promise.all([
    db.attendance.where("memberId").equals(memberId).toArray(),
    db.assignments.where("memberId").equals(memberId).toArray(),
    db.member_instruments.where("[memberId+role]").equals([memberId, "primary"]).first(),
  ]);
  const out: Record<number, number> = {};
  asg.forEach((a) => (out[a.instrumentId] = (out[a.instrumentId] || 0) + 1));
  const hadir = att.filter((a) => a.status === "hadir");
  const assigned = new Set(asg.map((a) => a.meetingId));
  if (prim)
    out[prim.instrumentId] = (out[prim.instrumentId] || 0) + hadir.filter((a) => !assigned.has(a.meetingId)).length;
  return { out, hadir: hadir.length };
}

/* ---------- rekomendasi pengganti (hanya saran, tanpa auto-assign) ---------- */
export interface Rec {
  instrument: Instrument | null;
  list: { memberId: number; name: string; reasons: string[]; chosen: boolean }[];
}

export async function recommend(meetingId: number, absentId: number): Promise<Rec> {
  const prim = await db.member_instruments.where("[memberId+role]").equals([absentId, "primary"]).first();
  const instrument = prim ? (await db.instruments.get(prim.instrumentId)) ?? null : null;
  if (!instrument) return { instrument: null, list: [] };
  const iid = instrument.id!;

  const [cands, asg, att, total] = await Promise.all([
    db.member_instruments.where("instrumentId").equals(iid).toArray(),
    db.assignments.where("meetingId").equals(meetingId).toArray(),
    db.attendance.where("meetingId").equals(meetingId).toArray(),
    db.meetings.count(),
  ]);
  const present = new Set(att.filter((a) => a.status === "hadir").map((a) => a.memberId));
  const taken = new Map(asg.map((a) => [a.memberId, a]));

  const scored: { memberId: number; reasons: string[]; chosen: boolean; score: number }[] = [];
  for (const c of cands) {
    if (c.memberId === absentId || !present.has(c.memberId)) continue;
    const cur = taken.get(c.memberId);
    if (c.role === "primary" && cur === undefined) continue; // sudah memainkan alat ini
    const here = cur?.instrumentId === iid;
    const chosen = here && (cur!.replaces === undefined || cur!.replaces === absentId);
    if (here && !chosen) continue; // sudah jadi pengganti orang lain
    const u = await usage(c.memberId);
    const n = u.out[iid] || 0;
    const rate = total ? u.hadir / total : 0;
    scored.push({
      memberId: c.memberId,
      chosen,
      score: n * 3 + rate * 10 + (c.role === "secondary" ? 2 : c.role === "tertiary" ? 1 : 0),
      reasons: [
        n > 0 ? `Pernah memainkan ${instrument.name} sebanyak ${n} kali` : `Terdaftar ${ROLE_LABEL[c.role]} ${instrument.name}`,
        `Kehadiran ${Math.round(rate * 100)}%`,
      ],
    });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((x, i) => i < 3 || x.chosen);
  const names = await db.members.bulkGet(top.map((t) => t.memberId));
  return {
    instrument,
    list: top.map((t, i) => ({ memberId: t.memberId, name: names[i]?.name ?? "?", reasons: t.reasons, chosen: t.chosen })),
  };
}

/* ---------- rekap pertemuan: siapa hadir, pegang alat apa, siapa ganti siapa ---------- */
export interface RecapRow {
  memberId: number;
  name: string;
  hadir: boolean;
  instrument?: string;               // alat yang dipegang (hadir) / alat Primary (tidak hadir)
  covering?: string;                 // hadir sebagai pengganti: nama yang digantikan
  replacedBy?: { name: string; role: string }; // tidak hadir: digantikan siapa, dan role-nya di alat itu
}

export async function recap(meetingId: number): Promise<RecapRow[]> {
  const [att, asg, ins] = await Promise.all([
    db.attendance.where("meetingId").equals(meetingId).toArray(),
    db.assignments.where("meetingId").equals(meetingId).toArray(),
    db.instruments.toArray(),
  ]);
  const ids = att.map((a) => a.memberId);
  const [mem, enr] = await Promise.all([
    db.members.bulkGet(ids),
    db.member_instruments.where("memberId").anyOf(ids).toArray(),
  ]);
  const iname = new Map(ins.map((i) => [i.id!, i.name]));
  const name = new Map(ids.map((id, k) => [id, mem[k]?.name ?? "?"]));
  const hadir = new Set(att.filter((a) => a.status === "hadir").map((a) => a.memberId));
  const absent = new Set(att.filter((a) => a.status !== "hadir").map((a) => a.memberId));
  const prim = (id: number) => enr.find((e) => e.memberId === id && e.role === "primary")?.instrumentId;
  const live = asg.filter((a) => hadir.has(a.memberId)); // penugasan yang pemainnya benar-benar hadir

  const rows: RecapRow[] = att.map((a) => {
    const id = a.memberId;
    const p = prim(id);
    const base = { memberId: id, name: name.get(id)!, hadir: a.status === "hadir" };
    if (base.hadir) {
      const s = live.find((x) => x.memberId === id);
      if (s) return { ...base, instrument: iname.get(s.instrumentId), covering: s.replaces && absent.has(s.replaces) ? name.get(s.replaces) : undefined };
      return { ...base, instrument: p !== undefined ? iname.get(p) : undefined };
    }
    const s = live.find((x) => x.replaces === id);
    const role = s ? enr.find((e) => e.memberId === s.memberId && e.instrumentId === s.instrumentId)?.role : undefined;
    return {
      ...base,
      instrument: p !== undefined ? iname.get(p) : undefined,
      replacedBy: s ? { name: name.get(s.memberId)!, role: role ? ROLE_LABEL[role] : "" } : undefined,
    };
  });
  return rows.sort((a, b) => Number(b.hadir) - Number(a.hadir) || a.name.localeCompare(b.name));
}
