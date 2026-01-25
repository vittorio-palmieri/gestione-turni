import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import RequireAuth from "../components/RequireAuth";
import { apiFetch } from "../lib/api";

function getMonday(d = new Date()) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}
function fmtISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const dayNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export default function Riposi() {
  const [people, setPeople] = useState([]);
  const [err, setErr] = useState(null);

  const [monday, setMonday] = useState(getMonday());
  const mondayIso = useMemo(() => fmtISO(monday), [monday]);
  const [abs, setAbs] = useState(null);

  async function loadPeople() {
    setErr(null);
    try { setPeople(await apiFetch("/people")); }
    catch (e) { setErr(e.message); }
  }

  async function loadAbsences() {
    setErr(null);
    try { setAbs(await apiFetch(`/weeks/${mondayIso}/absences`)); }
    catch (e) { setErr(e.message); }
  }

  useEffect(() => { loadPeople(); }, []);
  useEffect(() => { loadAbsences(); }, [mondayIso]);

  async function setRotation(personId, dayIndexRiposo) {
    setErr(null);
    try {
      const baseDate = fmtISO(addDays(monday, dayIndexRiposo)); // data reale di riposo
      await apiFetch(`/people/${personId}/rotation`, {
        method: "PUT",
        body: { base_riposo_date: baseDate },
      });
      await loadPeople();
      await loadAbsences();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <RequireAuth>
      <Layout>
        <div className="topbar">
          <div>
            <h1 style={{ margin: "0 0 4px 0" }}>Riposi / Permessi</h1>
            <div className="small">
              Rotazione 8 giorni: 6 lavoro + 1 riposo + 1 permesso.
            </div>
          </div>

          <div className="row">
            <button className="btn" onClick={() => setMonday(addDays(monday, -7))}>←</button>
            <div className="small">Settimana: <b>{mondayIso}</b></div>
            <button className="btn" onClick={() => setMonday(addDays(monday, 7))}>→</button>
          </div>
        </div>

        {err && <div className="card alert" style={{ marginBottom: 12 }}>{err}</div>}

        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Imposta “RIPOSO” nella settimana corrente</h3>
          <div className="small">
            Se scegli “Dom” nella settimana 12–18, allora Dom è RIPOSO e Lun è PERMESSO. La coppia successiva cadrà su Lun/Mar la settimana 26–01 (come Paone).
          </div>

          <table className="grid" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Persona</th>
                <th>RIPOSO (giorno settimana)</th>
                <th>Imposta</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 800 }}>{p.full_name}</td>
                  <td>
                    <select defaultValue="" onChange={(e) => { p._tmpRip = e.target.value; }}>
                      <option value="">(scegli giorno)</option>
                      {dayNames.map((dn, idx) => (
                        <option key={dn} value={idx}>{dn}</option>
                      ))}
                    </select>
                    <div className="small">
                      Base attuale: {p.rotation_base_riposo_date ? String(p.rotation_base_riposo_date) : "—"}
                    </div>
                  </td>
                  <td>
                    <button
                      className="btn primary"
                      onClick={() => {
                        const v = p._tmpRip;
                        if (v === undefined || v === "") return;
                        setRotation(p.id, Number(v));
                      }}
                    >
                      Imposta
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Calcolo settimana: {mondayIso}</h3>
          {!abs ? (
            <div className="small">Caricamento...</div>
          ) : (
            <table className="grid">
              <thead>
                <tr>
                  <th>Giorno</th>
                  <th>RIPOSO</th>
                  <th>PERMESSO</th>
                </tr>
              </thead>
              <tbody>
                {dayNames.map((dn, d) => {
                  const ripIds = abs.riposi?.[d] || [];
                  const perIds = abs.permessi?.[d] || [];
                  const ripNames = ripIds.map(id => people.find(p => p.id === id)?.full_name || id);
                  const perNames = perIds.map(id => people.find(p => p.id === id)?.full_name || id);
                  return (
                    <tr key={dn}>
                      <td style={{ fontWeight: 800 }}>{dn}</td>
                      <td className="small">{ripNames.length ? ripNames.join(", ") : "—"}</td>
                      <td className="small">{perNames.length ? perNames.join(", ") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Layout>
    </RequireAuth>
  );
}
