import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import RequireAuth from "../components/RequireAuth";
import { apiFetch } from "../lib/api";

/* =======================
   UTIL DATE
======================= */
function mondayOf(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const days = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

/* =======================
   COMPONENT
======================= */
export default function Planning() {
  const [monday, setMonday] = useState(mondayOf());
  const mondayISO = useMemo(() => iso(monday), [monday]);

  const [plan, setPlan] = useState(null);
  const [abs, setAbs] = useState(null);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(null);

  /* =======================
     LOAD DATA
  ======================= */
  async function loadAll() {
    try {
      setErr(null);
      const p = await apiFetch(`/weeks/${mondayISO}/plan`);
      const a = await apiFetch(`/weeks/${mondayISO}/absences`);
      setPlan(p || {});
      setAbs(a || {});
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    loadAll();
  }, [mondayISO]);

  /* =======================
     MAP ID → NOME
  ======================= */
  const peopleById = useMemo(() => {
    const m = new Map();
    (plan?.people || []).forEach((p) => m.set(p.id, p.full_name));
    return m;
  }, [plan]);

  const nameOf = (id) => peopleById.get(id) || id;

  /* =======================
     ASSENZE / ROTAZIONI
  ======================= */
  // blocco (ferie/malattia/infortunio)
  const extraOf = (pid, d) =>
    abs?.extra?.[d]?.[pid] || abs?.extra?.[String(d)]?.[pid] || null;

  // riposi / permessi (warning)
  const rotOf = (pid, d) => {
    const rip = abs?.riposi?.[d] || abs?.riposi?.[String(d)] || [];
    const per = abs?.permessi?.[d] || abs?.permessi?.[String(d)] || [];
    if (rip.includes(pid)) return "RIPOSO";
    if (per.includes(pid)) return "PERMESSO";
    return null;
  };

  /* =======================
     SET CELL
  ======================= */
  async function setCell(day, shift, person) {
    const block = person ? extraOf(person, day) : null;
    if (block) {
      setErr(`⛔ BLOCCATO: ${nameOf(person)} è in ${block}`);
      return;
    }

    try {
      setSaving(`${day}-${shift}`);
      await apiFetch(`/weeks/${mondayISO}/cell`, {
        method: "PUT",
        body: { day_index: day, shift_id: shift, person_id: person || null },
      });
      await loadAll();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(null);
    }
  }

  async function resetWeek() {
    if (!confirm("Reset settimana?")) return;
    await apiFetch(`/weeks/${mondayISO}/clear`, { method: "POST" });
    await loadAll();
  }

  /* =======================
     ANOMALIE LEGGIBILI
  ======================= */
  const readableAlerts = useMemo(() => {
    const a = plan?.alerts || {};
    const out = {
      duplicates: [],
      not_planned: [],
      riposo_saltato: [],
      permesso_saltato: [],
      extra_absence_saltata: [],
    };

    Object.keys(a.duplicates || {}).forEach((d) => {
      (a.duplicates[d] || []).forEach((it) => {
        out.duplicates.push({
          day: Number(d),
          person: nameOf(it.person_id),
          count: it.count,
        });
      });
    });

    Object.keys(a.not_planned || {}).forEach((d) => {
      (a.not_planned[d] || []).forEach((pid) => {
        out.not_planned.push({
          day: Number(d),
          person: nameOf(pid),
        });
      });
    });

    Object.keys(a.riposo_saltato || {}).forEach((d) => {
      (a.riposo_saltato[d] || []).forEach((it) => {
        out.riposo_saltato.push({
          day: Number(d),
          person: nameOf(it.person_id),
          shift: it.shift_name || "-",
        });
      });
    });

    Object.keys(a.permesso_saltato || {}).forEach((d) => {
      (a.permesso_saltato[d] || []).forEach((it) => {
        out.permesso_saltato.push({
          day: Number(d),
          person: nameOf(it.person_id),
          shift: it.shift_name || "-",
        });
      });
    });

    Object.keys(a.extra_absence_saltata || {}).forEach((d) => {
      (a.extra_absence_saltata[d] || []).forEach((it) => {
        out.extra_absence_saltata.push({
          day: Number(d),
          person: nameOf(it.person_id),
          kind: it.kind,
          shift: it.shift_name || "-",
        });
      });
    });

    return out;
  }, [plan, peopleById]);

  /* =======================
     RENDER
  ======================= */
  return (
    <RequireAuth>
      <Layout>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <button className="btn" onClick={() => setMonday(addDays(monday, -7))}>←</button>
          <b>Settimana {mondayISO} → {iso(addDays(monday, 6))}</b>
          <button className="btn" onClick={() => setMonday(addDays(monday, 7))}>→</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button className="btn" onClick={loadAll}>🔄 Refresh</button>
          <button className="btn primary">💾 Salva (auto)</button>
          <button className="btn danger" onClick={resetWeek}>♻️ Reset settimana</button>
        </div>

        {err && <div className="card alert">{err}</div>}

        {!plan?.shifts ? (
          <div className="card">Caricamento…</div>
        ) : (
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="grid">
              <thead>
                <tr>
                  <th>Turno</th>
                  {days.map((d, i) => (
                    <th key={d}>{d} {iso(addDays(monday, i)).slice(5)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.shifts.map((s) => (
                  <tr key={s.id}>
                    <td><b>{s.name}</b></td>
                    {days.map((_, di) => {
                      const row = plan.grid?.[di] || {};
                      const val = row?.[s.id] || "";
                      return (
                        <td key={di}>
                          <select value={val} onChange={(e) => setCell(di, s.id, e.target.value)}>
                            <option value="">—</option>
                            {plan.people.filter(p => p.is_active).map((p) => (
                              <option key={p.id} value={p.id} disabled={!!extraOf(p.id, di)}>
                                {p.full_name}
                                {extraOf(p.id, di) ? ` (${extraOf(p.id, di)})` : rotOf(p.id, di) ? ` (${rotOf(p.id, di)})` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 style={{ marginTop: 20 }}>Anomalie</h3>

        <div className="card">
          <h4>⛔ Assenze bloccanti</h4>
          {readableAlerts.extra_absence_saltata.length === 0 ? "Nessuna" :
            <ul>{readableAlerts.extra_absence_saltata.map((x,i)=>(
              <li key={i}>{days[x.day]}: {x.person} — {x.shift} ({x.kind})</li>
            ))}</ul>
          }

          <h4>⚠ Riposo saltato</h4>
          {readableAlerts.riposo_saltato.length === 0 ? "Nessuno" :
            <ul>{readableAlerts.riposo_saltato.map((x,i)=>(
              <li key={i}>{days[x.day]}: {x.person} — {x.shift}</li>
            ))}</ul>
          }

          <h4>⚠ Permesso saltato</h4>
          {readableAlerts.permesso_saltato.length === 0 ? "Nessuno" :
            <ul>{readableAlerts.permesso_saltato.map((x,i)=>(
              <li key={i}>{days[x.day]}: {x.person} — {x.shift}</li>
            ))}</ul>
          }

          <h4>🔁 Doppioni</h4>
          {readableAlerts.duplicates.length === 0 ? "Nessuno" :
            <ul>{readableAlerts.duplicates.map((x,i)=>(
              <li key={i}>{days[x.day]}: {x.person} — {x.count} volte</li>
            ))}</ul>
          }

          <h4>👤 Non pianificati</h4>
          {readableAlerts.not_planned.length === 0 ? "Nessuno" :
            <ul>{readableAlerts.not_planned.map((x,i)=>(
              <li key={i}>{days[x.day]}: {x.person}</li>
            ))}</ul>
          }
        </div>
      </Layout>
    </RequireAuth>
  );
}