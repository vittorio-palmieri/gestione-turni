import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import RequireAuth from "../components/RequireAuth";
import { apiFetch } from "../lib/api";

export default function Assenze() {
  const [people, setPeople] = useState([]);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);

  const [personId, setPersonId] = useState("");
  const [kind, setKind] = useState("FERIE");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    setErr(null);
    try {
      const p = await apiFetch("/people");
      setPeople(p);
      const a = await apiFetch("/absences");
      setRows(a);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!personId || !start || !end) return;
    setErr(null);
    try {
      await apiFetch("/absences", {
        method: "POST",
        body: {
          person_id: personId,
          kind,
          start_date: start,
          end_date: end,
          notes: notes || null
        }
      });
      setNotes("");
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function del(id) {
    if (!confirm("Eliminare questa assenza?")) return;
    setErr(null);
    try {
      await apiFetch(`/absences/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <RequireAuth>
      <Layout>
        <h1>Assenze (FERIE / MALATTIA / INFORTUNIO)</h1>

        {err && <div className="card alert" style={{ marginBottom: 12 }}>{err}</div>}

        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Nuova assenza</h3>
          <div className="row">
            <select value={personId} onChange={e => setPersonId(e.target.value)}>
              <option value="">Seleziona persona</option>
              {people.filter(p => p.is_active).map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>

            <select value={kind} onChange={e => setKind(e.target.value)}>
              <option value="FERIE">FERIE</option>
              <option value="MALATTIA">MALATTIA</option>
              <option value="INFORTUNIO">INFORTUNIO</option>
            </select>

            <input type="date" value={start} onChange={e => setStart(e.target.value)} />
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} />

            <button className="btn primary" onClick={add}>Aggiungi</button>
          </div>

          <div style={{ marginTop: 10 }}>
            <input className="input" placeholder="Note (opzionale)" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Elenco assenze</h3>
          <table className="grid">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Tipo</th>
                <th>Dal</th>
                <th>Al</th>
                <th>Note</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{people.find(p => p.id === r.person_id)?.full_name || r.person_id}</td>
                  <td><b>{r.kind}</b></td>
                  <td>{r.start_date}</td>
                  <td>{r.end_date}</td>
                  <td className="small">{r.notes || "—"}</td>
                  <td>
                    <button className="btn danger" onClick={() => del(r.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan="6" className="small">Nessuna assenza.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Layout>
    </RequireAuth>
  );
}