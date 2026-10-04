import { useEffect, useState } from "react";
import { db, Instrument } from "../database/db";
import { Nav } from "../database/logic";

export default function Instruments({ go }: { go: Nav }) {
  const [list, setList] = useState<Instrument[]>([]);
  const [used, setUsed] = useState<Record<number, number>>({});

  useEffect(() => {
    (async () => {
      const [ins, enr] = await Promise.all([db.instruments.toArray(), db.member_instruments.toArray()]);
      setList(ins);
      const u: Record<number, number> = {};
      enr.filter((e) => e.role === "primary").forEach((e) => (u[e.instrumentId] = (u[e.instrumentId] || 0) + 1));
      setUsed(u);
    })();
  }, []);

  return (
    <>
      <header className="header">
        <h1>Alat</h1>
        <p className="muted">{list.length} alat. Ketuk untuk melihat pemain.</p>
      </header>

      <section className="group">
        {list.map((i) => (
          <button className="list-row tap" key={i.id} onClick={() => go("instrument", i.id)}>
            <span>{i.name}</span>
            <span className="muted">{used[i.id!] || 0} / {i.capacity} Primary <span className="chevron">›</span></span>
          </button>
        ))}
      </section>
    </>
  );
}
