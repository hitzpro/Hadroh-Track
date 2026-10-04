import { useEffect, useMemo, useState } from "react";
import { db, Member } from "../database/db";
import { Nav } from "../database/logic";
import useDebounce from "../hooks/useDebounce";

export default function Members({ go }: { go: Nav }) {
  const [data, setData] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const q = useDebounce(search).trim().toLowerCase();

  const load = async () => setData(await db.members.orderBy("name").toArray());
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => data.filter((m) => m.name.toLowerCase().includes(q)), [data, q]);

  async function add() {
    const v = name.trim();
    if (!v) return;
    await db.members.add({ name: v });
    setName("");
    setOpen(false);
    load();
  }

  return (
    <>
      <header className="header header-row">
        <div>
          <h1>Anggota</h1>
          <p className="muted">{data.length} orang</p>
        </div>
        <button className="btn primary" onClick={() => setOpen(true)}>Tambah</button>
      </header>

      <input className="input search" type="search" placeholder="Cari nama" value={search} onChange={(e) => setSearch(e.target.value)} />

      {filtered.length === 0 ? (
        <p className="empty">{data.length === 0 ? "Belum ada anggota. Ketuk Tambah untuk mulai." : "Tidak ada anggota dengan nama itu."}</p>
      ) : (
        <section className="group">
          {filtered.map((m) => (
            <button className="list-row tap" key={m.id} onClick={() => go("member", m.id)}>
              <span className="who">
                <span className="avatar">{m.name.charAt(0).toUpperCase()}</span>
                {m.name}
              </span>
              <span className="chevron" aria-hidden="true">›</span>
            </button>
          ))}
        </section>
      )}

      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Anggota baru</h2>
            <input className="input" placeholder="Nama anggota" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <div className="sheet-actions">
              <button className="btn ghost" onClick={() => setOpen(false)}>Batal</button>
              <button className="btn primary" onClick={add} disabled={!name.trim()}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
