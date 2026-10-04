import { db } from "./db";
import { recompute, seed } from "./logic";

export function exportData() {
  return Promise.all(db.tables.map((t) => t.toArray().then((rows) => [t.name, rows] as const))).then((entries) => {
    const payload = { app: "HadrohTrack", version: 2, exportedAt: new Date().toISOString(), data: Object.fromEntries(entries) };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: "application/json" }));
    a.download = "hadrohtrack-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

export async function importData(text: string, mode: "replace" | "merge") {
  const j = JSON.parse(text);
  if (j?.app !== "HadrohTrack" || typeof j.data !== "object") throw new Error("File ini bukan backup HadrohTrack.");
  const arr = (k: string): any[] => (Array.isArray(j.data[k]) ? j.data[k] : []);

  await db.transaction("rw", db.tables, async () => {
    if (mode === "replace") {
      for (const t of db.tables) {
        await t.clear();
        await t.bulkAdd(arr(t.name));
      }
      return;
    }

    // merge: cocokkan anggota/alat lewat nama, pertemuan lewat tanggal; id lama dipetakan ke id baru
    const mm = new Map<number, number>(), im = new Map<number, number>(), tm = new Map<number, number>();
    for (const m of arr("members")) {
      const f = await db.members.where("name").equalsIgnoreCase(m.name).first();
      mm.set(m.id, f ? f.id! : ((await db.members.add({ name: m.name })) as number));
    }
    for (const i of arr("instruments")) {
      const f = await db.instruments.where("name").equals(i.name).first();
      im.set(i.id, f ? f.id! : ((await db.instruments.add({ name: i.name, capacity: i.capacity ?? 4 })) as number));
    }
    for (const t of arr("meetings")) {
      const f = await db.meetings.where("date").equals(t.date).first();
      tm.set(t.id, f ? f.id! : ((await db.meetings.add({ date: t.date })) as number));
    }
    for (const e of arr("member_instruments")) {
      const m = mm.get(e.memberId), i = im.get(e.instrumentId);
      if (m && i && !(await db.member_instruments.where("[memberId+role]").equals([m, e.role]).first()))
        await db.member_instruments.add({ memberId: m, instrumentId: i, role: e.role });
    }
    for (const a of arr("attendance")) {
      const t = tm.get(a.meetingId), m = mm.get(a.memberId);
      if (t && m && !(await db.attendance.where("[meetingId+memberId]").equals([t, m]).first()))
        await db.attendance.add({ meetingId: t, memberId: m, status: a.status });
    }
    for (const a of arr("assignments")) {
      const t = tm.get(a.meetingId), m = mm.get(a.memberId), i = im.get(a.instrumentId);
      if (t && m && i && !(await db.assignments.get([t, m]))) await db.assignments.add({ meetingId: t, memberId: m, instrumentId: i });
    }
  });

  await seed();
  await recompute(); // progress apresiasi dihitung ulang dari riwayat
}
