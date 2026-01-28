import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import RequireAuth from "../components/RequireAuth";
import { apiFetch } from "../lib/api";

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function mondayOf(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function Assenze() {
  const [people, setPeople] = useState([]);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);

  // form
  const [personId, setPersonId] = useState("");
  const [kind, setKind] = useState("FERIE");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  // filtri elenco
  const [filterPerson, setFilterPerson] = useState("ALL");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  async function load() {
    setErr(null);
    setOk(null);
    try {
      const p = await apiFetch("/people");
      setPeople(p);

      // carico tutto, poi filtro lato UI (più semplice)
      const a = await apiFetch("/absences");
      setRows(a);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();

    // default filtro: settimana corrente
    const mon = mondayOf(new Date());
    setFilterFrom(iso(mon));
    setFilterTo(iso(addDays(mon, 6)));
  }, []);

  function personName(pid) {
    return people.find((p) => p.id === pid)?.full_name || pid;
  }

  function setThisWeek() {
    const mon = mondayOf(new Date());
    setStartDate(iso(mon));
    setEndDate(iso(addDays(mon, 6)));
  }

  function validate() {
    if (!personId) return "Seleziona una persona";
    if (!startDate || !endDate) return "Inserisci data inizio e fine";
    if (endDate < startDate) return "La fine non può essere prima dell’inizio";
    return null;
  }

  async function addAbsence() {
    const v = validate();
    if (v) {
      setErr(v);
      setOk(null);
      return;
    }

    setErr(null);
    setOk(null);

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

      setOk("Assenza inserita ✅");
      setNotes("");
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function deleteAbsence(id) {
    if (!confirm("Eliminare questa assenza?")) return;
    setErr(null);
    setOk(null);
    try {
      await apiFetch(`/absences/${id}`, { method: "DELETE" });
      setOk("Assenza eliminata ✅");
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  const filtered = useMemo(() => {
    let out = [...rows];

    if (filterPerson !== "ALL") {
      out = out.filter((r) => r.person_id === filterPerson);
    }

    if (filterFrom) {
      out = out.filter((r) => r.end_date >= filterFrom);
    }
    if (filterTo) {
      out = out.filter((r) => r.start_date <= filterTo);
    }

    // ordina per data
    out.sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
    return out;
  }, [rows, filterPerson, filterFrom, filterTo]);

  return (
    <RequireAuth>
      <Layout>
        <h1>Assenze (FERIE / MALATTIA / INFORTUNIO)</h1>

        {err && <div className="alert" style={{ marginBottom: 12 }}>{err}</div>}
        {ok && <div className="card" style={{ border: "1px solid #bbf7d0", marginBottom: 12 }}>{ok}</div>}

        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Nuova assenza</h3>

          <div className="row" style={{ flexWrap: "wrap" }}>
            <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Seleziona persona</option>
              {people.filter(p => p.is_active).map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>

            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="FERIE">FERIE</option>
              <option value="MALATTIA">MALATTIA</option>
              <option value="INFORTUNIO">INFORTUNIO</option>
            </select>

            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

            <button className="btn secondary" onClick={setThisWeek}>Questa settimana</button>
            <button className="btn primary" onClick={addAbsence}>Aggiungi</button>
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
            Queste assenze <b>BLOCCANO</b> la pianificazione.
          </div>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Filtri elenco</h3>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <select value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)}>
              <option value="ALL">Tutte le persone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>

            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />

            <button className="btn" onClick={() => { setFilterPerson("ALL"); setFilterFrom(""); setFilterTo(""); }}>
              Reset filtri
            </button>
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
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{personName(r.person_id)}</td>
                  <td style={{ fontWeight: 800 }}>{r.kind}</td>
                  <td>{r.start_date}</td>
                  <td>{r.end_date}</td>
                  <td className="small">{r.notes || "—"}</td>
                  <td>
                    <button className="btn danger" onClick={() => deleteAbsence(r.id)}>🗑️</button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="small">Nessuna assenza nel filtro selezionato.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Layout>
    </RequireAuth>
  );
}