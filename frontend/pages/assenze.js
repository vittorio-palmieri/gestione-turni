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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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

  async function addAbsence() {
    if (!personId || !startDate || !endDate) {
      setErr("Seleziona persona + date inizio/fine");
      return;
    }

    setErr(null);
    try {
      await apiFetch("/absences", {
        method: "POST",
        body: {
          person_id: personId,
          kind,
          start_date: startDate,
          end_date: endDate,
          notes: notes.trim() || null,
        },
      });

      setNotes("");
      setStartDate("");
      setEndDate("");
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function deleteAbsence(id) {
    if (!confirm("Eliminare questa assenza?")) return;
    setErr(null);
    try {
      await apiFetch(`/absences/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  function personName(pid) {
    return people.find((p) => p.id === pid)?.full_name || pid;
  }

  return (
    <RequireAuth>
      <Layout>
        <h1>Assenze (Ferie / Malattia / Infortunio)</h1>

        {err && (
          <div className="card alert" style={{ marginBottom: 12 }}>
            {err}
          </div>
        )}

        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Nuova assenza</h3>

          <div className="row" style={{ flexWrap: "wrap" }}>
            <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Seleziona persona</option>
              {people.filter((p) => p.is_active).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>

            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="FERIE">FERIE</option>
              <option value="MALATTIA">MALATTIA</option>
              <option value="INFORTUNIO">INFORTUNIO</option>
            </select>

            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

            <button className="btn primary" onClick={addAbsence}>
              Aggiungi
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            <input
              className="input"
              placeholder="Note (opzionale)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="small" style={{ marginTop: 10 }}>
            Queste assenze BLOCCANO la pianificazione (ferie/malattia/infortunio).
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
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{personName(r.person_id)}</td>
                  <td style={{ fontWeight: 800 }}>{r.kind}</td>
                  <td>{r.start_date}</td>
                  <td>{r.end_date}</td>
                  <td className="small">{r.notes || "—"}</td>
                  <td>
                    <button className="btn danger" onClick={() => deleteAbsence(r.id)}>
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan="6" className="small">
                    Nessuna assenza inserita.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Layout>
    </RequireAuth>
  );
}