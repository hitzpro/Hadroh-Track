import { useEffect, useRef, useState } from "react";
import { db } from "../database/db";
import { DEFAULT_SCHEDULE } from "../database/logic";
import { exportData, importData } from "../database/backup";

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function Settings() {
  const [sch, setSch] = useState(DEFAULT_SCHEDULE);
  const [concept, setConcept] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    db.settings.get("schedule").then((s) => s && setSch(s.value));
  }, []);

  function update(patch: Partial<typeof sch>) {
    const n = { ...sch, ...patch };
    setSch(n);
    db.settings.put({ key: "schedule", value: n });
  }

  async function run(mode: "replace" | "merge") {
    try {
      await importData(text!, mode);
      setNote(mode === "replace" ? "Data diganti dari backup." : "Data backup digabung.");
    } catch (e: any) {
      setNote(e?.message || "Gagal membaca file backup.");
    }
    setText(null);
  }

  if (concept)
    return (
      <>
        <button className="back" onClick={() => setConcept(false)}>‹ Pengaturan</button>
        <header className="header"><h1>Konsep apresiasi</h1></header>
        <section className="group info">
          <p>Anggota mendapatkan badge apabila hadir 4 pertemuan berturut-turut. Setelah badge didapatkan, semua progress akan dimulai kembali dari awal.</p>
          <p className="muted">Jika tidak hadir, progress anggota tersebut tidak bertambah.</p>
        </section>
      </>
    );

  return (
    <>
      <header className="header"><h1>Pengaturan</h1></header>

      <h2 className="section-title">Jadwal latihan</h2>
      <section className="group">
        <div className="list-row">
          <span>Hari</span>
          <select className="select" value={sch.day} onChange={(e) => update({ day: e.target.value })}>
            {DAYS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="list-row">
          <span>Waktu (WIB)</span>
          <input className="select" type="time" value={sch.time} onChange={(e) => update({ time: e.target.value })} />
        </div>
        <div className="list-row">
          <span>Frekuensi</span>
          <select className="select" value={sch.every} onChange={(e) => update({ every: +e.target.value })}>
            <option value={1}>Setiap minggu</option>
            <option value={2}>Dua minggu sekali</option>
          </select>
        </div>
      </section>

      <h2 className="section-title">Apresiasi</h2>
      <section className="group">
        <button className="list-row tap" onClick={() => setConcept(true)}>
          <span>Konsep apresiasi</span><span className="chevron">›</span>
        </button>
      </section>

      <h2 className="section-title">Backup &amp; Restore</h2>
      <section className="group">
        <button className="list-row tap" onClick={() => exportData().then(() => setNote("File hadrohtrack-backup.json dibuat."))}>
          <span>Backup Data</span><span className="muted">Export JSON</span>
        </button>
        <button className="list-row tap" onClick={() => file.current?.click()}>
          <span>Restore Data</span><span className="muted">Import JSON</span>
        </button>
      </section>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) setText(await f.text());
        }}
      />
      {note && <p className="muted small pad-l">{note}</p>}

      {text !== null && (
        <div className="overlay" onClick={() => setText(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Restore data</h2>
            <p className="muted">Pilih cara memakai data dari file backup.</p>
            <button className="btn primary wide" onClick={() => run("merge")}>Merge data</button>
            <button className="btn ghost wide gap" onClick={() => confirm("Semua data saat ini akan dihapus. Lanjutkan?") && run("replace")}>
              Replace semua data
            </button>
            <button className="btn text-danger muted-btn" onClick={() => setText(null)}>Batal</button>
          </div>
        </div>
      )}
    </>
  );
}
