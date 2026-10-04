import Dexie, { type Table } from "dexie";

export type Role = "primary" | "secondary" | "tertiary";
export type Status = "hadir" | "tidak hadir";

export interface Member { id?: number; name: string }
export interface Instrument { id?: number; name: string; capacity: number }
export interface MemberInstrument { id?: number; memberId: number; instrumentId: number; role: Role }
export interface Meeting { id?: number; date: string }
export interface Attendance { id?: number; meetingId: number; memberId: number; status: Status }
export interface Achievement { memberId: number; streakCount: number; badgeCount: number }
export interface Assignment { meetingId: number; memberId: number; instrumentId: number; replaces?: number }
export interface Setting { key: string; value: any }

class Database extends Dexie {
  members!: Table<Member, number>;
  instruments!: Table<Instrument, number>;
  member_instruments!: Table<MemberInstrument, number>;
  meetings!: Table<Meeting, number>;
  attendance!: Table<Attendance, number>;
  achievement!: Table<Achievement, number>;
  assignments!: Table<Assignment, [number, number]>;
  settings!: Table<Setting, string>;

  constructor() {
    super("HadrohTrack");

    this.version(1).stores({
      members: "++id,name",
      attendance: "++id,memberId,date",
    });

    this.version(2)
      .stores({
        members: "++id,name",
        instruments: "++id,&name",
        member_instruments: "++id,memberId,instrumentId,[memberId+role]",
        meetings: "++id,&date",
        attendance: "++id,meetingId,memberId,[meetingId+memberId]",
        achievement: "memberId,badgeCount",
        assignments: "[meetingId+memberId],meetingId,memberId,instrumentId",
        settings: "key",
      })
      .upgrade(async (tx) => {
        // data lama (v1): absensi per tanggal -> jadi pertemuan + absensi
        const old = await tx.table("attendance").toArray();
        const ids = new Map<string, number>();
        const rows = new Map<string, any>();
        for (const a of old) {
          const d = String(a.date).slice(0, 10);
          if (!ids.has(d)) ids.set(d, (await tx.table("meetings").add({ date: d })) as number);
          const mid = ids.get(d)!;
          rows.set(mid + "-" + a.memberId, { meetingId: mid, memberId: a.memberId, status: a.status });
        }
        await tx.table("attendance").clear();
        await tx.table("attendance").bulkAdd([...rows.values()]);
      });
  }
}

export const db = new Database();
