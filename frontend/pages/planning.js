import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import RequireAuth from "../components/RequireAuth";
import { apiFetch, getToken } from "../lib/api";

function mondayOf(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Lun=0
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

function hhmm(t) {
  if (!t) return "";
  // "09:00:00" -> "09:00"
  return t.length >= 5 ? t.slice(0, 5) : t;
}
function toTimeStr(v) {
  if (!v) return null;
  // "09:00" -> "09:00:00"
  return v.length === 5 ? `${v}:00` : v;
}

export default function Planning() {
  const [monday, setMonday] = useState(mondayOf());
  const mondayISO = useMemo(() => iso(monday), [monday]);

  const [plan, setPlan] = useState(null);
  const [abs, setAbs] = useState(null);
  const [meta, setMeta] = useState(null); // { meta: {dayIndex: {shiftId: {override_start_time, override_end_time, role}}}}
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(null);

  // pannello dettagli aperto: "day|shift"
  const [openKey, setOpenKey] = useState(null);

  // stato edit dettagli per cella (solo mentre pannello aperto)
  const [metaDraft, setMetaDraft] = useState({}); // key -> { role, start, end }

  async function loadAll() {
    try {
      setErr(null);
      const p = await apiFetch(`/weeks/${mondayISO}/plan`);
      const a = await apiFetch(`/weeks/${mondayISO}/absences`);
      setPlan(p || {});
      setAbs(a || {});

      // meta (se endpoint non esiste ancora, non rompiamo tutto)
      try {
        const m = await apiFetch(`/weeks/${mondayISO}/meta`);
        setMeta(m || {});
      } catch (e) {
        // se non hai ancora messo il backend meta, vedrai qui l’errore
        setMeta({ meta: {} });
      }
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    loadAll();
    // chiudi pannelli quando cambi settimana
    setOpenKey(null);
    setMetaDraft({});
  }, [mondayISO]);

  // id -> nome
  const peopleById = useMemo(() => {
    const m = new Map();
    (plan?.people || []).forEach((p) => m.set(p.id, p.full_name));
    return m;
  }, [plan]);
  const nameOf = (id) => peopleById.get(id) || id;

  // extra blocco (ferie/malattia/infortunio)
  const extraOf = (pid, d) =>
    abs?.extra?.[d]?.[pid] || abs?.extra?.[String(d)]?.[pid] || null;

  // riposi/permessi (warning)
  const rotOf = (pid, d) => {
    const rip = abs?.riposi?.[d] || abs?.riposi?.[String(d)] || [];
    const per = abs?.permessi?.[d] || abs?.permessi?.[String(d)] || [];
    if (rip.includes(pid)) return "RIPOSO";
    if (per.includes(pid)) return "PERMESSO";
    return null;
  };

  // alerts safe
  const alerts = plan?.alerts || {
    duplicates: {},
    not_planned: {},
    riposo_saltato: {},
    permesso_saltato: {},
    extra_absence_saltata: {},
  };

  const dupMap = useMemo(() => {
    const out = {};
    const dups = alerts.duplicates || {};
    for (const dayKey of Object.keys(dups)) {
      const arr = dups[dayKey] || [];
      out[Number(dayKey)] = new Set(arr.map((x) => x.person_id));
    }
    return out;
  }, [alerts]);

  const notPlannedCount = (d) =>
    (alerts.not_planned?.[d] || alerts.not_planned?.[String(d)] || []).length;
  const duplicatesCount = (d) =>
    (alerts.duplicates?.[d] || alerts.duplicates?.[String(d)] || []).length;

  // meta getter
  function getMeta(dayIndex, shiftId) {
    const dayObj = meta?.meta?.[dayIndex] || meta?.meta?.[String(dayIndex)] || {};
    return dayObj?.[shiftId] || null;
  }

  // tempo effettivo (override > default turno)
  function effectiveTime(dayIndex, shiftObj) {
    const m = getMeta(dayIndex, shiftObj.id);
    const st = hhmm(m?.override_start_time) || hhmm(shiftObj.start_time);
    const en = hhmm(m?.override_end_time) || hhmm(shiftObj.end_time);
    const role = m?.role || "";
    return { st, en, role };
  }

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

  // ✅ Export PDF (NO fetch -> NO CORS)
  function exportPdf() {
    try {
      const token = getToken();
      const base = process.env.NEXT_PUBLIC_API_BASE_URL;
      const url = `${base}/weeks/${mondayISO}/export.pdf?token=${encodeURIComponent(token)}`;
      window.open(url, "_blank");
    } catch (e) {
      setErr(e.message);
    }
  }

  function openDetails(dayIndex, shiftObj) {
    const key = `${dayIndex}|${shiftObj.id}`;
    const m = getMeta(dayIndex, shiftObj.id);
    const draft = {
      role: m?.role || "",
      start: hhmm(m?.override_start_time) || "",
      end: hhmm(m?.override_end_time) || "",
    };
    setMetaDraft((prev) => ({ ...prev, [key]: draft }));
    setOpenKey((prev) => (prev === key ? null : key));
  }

  async function saveDetails(dayIndex, shiftObj) {
    const key = `${dayIndex}|${shiftObj.id}`;
    const d = metaDraft[key] || { role: "", start: "", end: "" };

    try {
      setSaving(`meta-${key}`);
      await apiFetch(`/weeks/${mondayISO}/meta`, {
        method: "PUT",
        body: {
          day_index: dayIndex,
          shift_id: shiftObj.id,
          override_start_time: toTimeStr(d.start),
          override_end_time: toTimeStr(d.end),
          role: d.role || null,
        },
      });
      await loadAll();
      setOpenKey(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(null);
    }
  }

  function roleLabel(role) {
    if (role === "APERTURA") return "Apertura";
    if (role === "CHIUSURA") return "Chiusura";
    return "—";
  }

  // Anomalie leggibili (per lista sotto) – le lasciamo come prima
  const readableAlerts = useMemo(() => {
    const a = alerts || {};
    const out = {
      duplicates: [],
      not_planned: [],
      riposo_saltato: [],
      permesso_saltato: [],
      extra_absence_saltata: [],
    };

    Object.keys(a.duplicates || {}).forEach((d) => {
      (a.duplicates[d] || []).forEach((it) => {
        out.duplicates.push({ day: Number(d), person: nameOf(it.person_id), count: it.count });
      });
    });

    Object.keys(a.not_planned || {}).forEach((d) => {
      (a.not_planned[d] || []).forEach((pid) => {
        out.not_planned.push({ day: Number(d), person: nameOf(pid) });
      });
    });

    Object.keys(a.riposo_saltato || {}).forEach((d) => {
      (a.riposo_saltato[d] || []).forEach((it) => {
        out.riposo_saltato.push({ day: Number(d), person: nameOf(it.person_id), shift: it.shift_name || "-" });
      });
    });

    Object.keys(a.permesso_saltato || {}).forEach((d) => {
      (a.permesso_saltato[d] || []).forEach((it) => {
        out.permesso_saltato.push({ day: Number(d), person: nameOf(it.person_id), shift: it.shift_name || "-" });
      });
    });

    Object.keys(a.extra_absence_saltata || {}).forEach((d) => {
      (a.extra_absence_saltata[d] || []).forEach((it) => {
        out.extra_absence_saltata.push({ day: Number(d), person: nameOf(it.person_id), kind: it.kind, shift: it.shift_name || "-" });
      });
    });

    return out;
  }, [alerts, peopleById]);

  return (
    <RequireAuth>
      <Layout>
        <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
          <button className="btn" onClick={() => setMonday(addDays(monday, -7))}>←</button>
          <b>Settimana {mondayISO} → {iso(addDays(monday, 6))}</b>
          <button className="btn" onClick={() => setMonday(addDays(monday, 7))}>→</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <button className="btn" onClick={loadAll}>🔄 Refresh</button>
          <button className="btn primary" onClick={() => alert("💾 Salvataggio automatico attivo")}>💾 Salva (auto)</button>
          <button className="btn danger" onClick={resetWeek}>♻️ Reset settimana</button>
          <button className="btn secondary" onClick={exportPdf}>📄 Esporta PDF</button>
        </div>

        {err && <div className="card alert">{err}</div>}

        {!plan?.shifts ? (
          <div className="card">Caricamento…</div>
        ) : (
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="grid">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Turno</th>
                  {days.map((d, i) => {
                    const np = notPlannedCount(i);
                    const du = duplicatesCount(i);
                    return (
                      <th key={d} style={{ minWidth: 260 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                          <div>
                            {d} <span className="badge">{iso(addDays(monday, i)).slice(5)}</span>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            {np > 0 && <span className="badge" title="Non pianificati">NP:{np}</span>}
                            {du > 0 && <span className="badge" title="Doppioni">D:{du}</span>}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {plan.shifts.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 800 }}>
                      {s.name}
                      <div className="small">{hhmm(s.start_time)}–{hhmm(s.end_time)}</div>
                    </td>

                    {days.map((_, di) => {
                      const row = plan.grid?.[di] || plan.grid?.[String(di)] || {};
                      const val = row?.[s.id] || "";

                      const ex = val ? extraOf(val, di) : null;
                      const rot = val ? rotOf(val, di) : null;
                      const isDup = val ? (dupMap?.[di]?.has(val) || false) : false;

                      const { st, en, role } = effectiveTime(di, s);

                      let bg = "transparent";
                      if (ex) bg = "#fee2e2";        // rosso chiaro (bloccante)
                      else if (rot) bg = "#fef3c7";  // giallo chiaro (warning)

                      const cellStyle = {
                        background: bg,
                        border: isDup ? "2px solid #dc2626" : "1px solid #e2e8f0",
                        borderRadius: 10,
                        padding: 8,
                      };

                      const key = `${di}|${s.id}`;
                      const draft = metaDraft[key] || { role: "", start: "", end: "" };

                      return (
                        <td key={di}>
                          <div style={cellStyle}>
                            <select
                              value={val}
                              onChange={(e) => setCell(di, s.id, e.target.value)}
                              disabled={saving === `${di}-${s.id}`}
                            >
                              <option value="">—</option>
                              {plan.people.filter((p) => p.is_active).map((p) => {
                                const blocked = !!extraOf(p.id, di);
                                const r = rotOf(p.id, di);
                                const exLabel = extraOf(p.id, di);
                                return (
                                  <option key={p.id} value={p.id} disabled={blocked}>
                                    {p.full_name}
                                    {exLabel ? ` (${exLabel})` : r ? ` (${r})` : ""}
                                  </option>
                                );
                              })}
                            </select>

                            <div className="small" style={{ marginTop: 6 }}>
                              {roleLabel(role)} • {st || "—"}–{en || "—"}
                            </div>

                            <button
                              className="btn secondary"
                              style={{ marginTop: 6, width: "100%" }}
                              onClick={() => openDetails(di, s)}
                            >
                              Dettagli orario / Apertura-Chiusura
                            </button>

                            {openKey === key && (
                              <div style={{ marginTop: 8 }}>
                                <div className="small">Ruolo</div>
                                <select
                                  value={draft.role}
                                  onChange={(e) =>
                                    setMetaDraft((prev) => ({
                                      ...prev,
                                      [key]: { ...draft, role: e.target.value },
                                    }))
                                  }
                                >
                                  <option value="">—</option>
                                  <option value="APERTURA">APERTURA</option>
                                  <option value="CHIUSURA">CHIUSURA</option>
                                </select>

                                <div style={{ height: 8 }} />

                                <div className="small">Inizio (override)</div>
                                <input
                                  className="input"
                                  type="time"
                                  value={draft.start}
                                  onChange={(e) =>
                                    setMetaDraft((prev) => ({
                                      ...prev,
                                      [key]: { ...draft, start: e.target.value },
                                    }))
                                  }
                                />

                                <div style={{ height: 8 }} />

                                <div className="small">Fine (override)</div>
                                <input
                                  className="input"
                                  type="time"
                                  value={draft.end}
                                  onChange={(e) =>
                                    setMetaDraft((prev) => ({
                                      ...prev,
                                      [key]: { ...draft, end: e.target.value },
                                    }))
                                  }
                                />

                                <div style={{ height: 10 }} />

                                <button
                                  className="btn primary"
                                  style={{ width: "100%" }}
                                  disabled={saving === `meta-${key}`}
                                  onClick={() => saveDetails(di, s)}
                                >
                                  {saving === `meta-${key}` ? "Salvo..." : "Salva dettagli"}
                                </button>
                              </div>
                            )}

                            {ex && <div className="small" style={{ marginTop: 6 }}>⛔ {ex}</div>}
                            {!ex && rot && <div className="small" style={{ marginTop: 6 }}>⚠ {rot}</div>}
                            {isDup && <div className="small" style={{ marginTop: 6 }}>🔁 Doppione</div>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 style={{ marginTop: 20 }}>Anomalie (dettaglio)</h3>
        <div className="card">
          <h4>⛔ Assenze bloccanti</h4>
          {readableAlerts.extra_absence_saltata.length === 0 ? "Nessuna" :
            <ul>{readableAlerts.extra_absence_saltata.map((x,i)=>(
              <li key={i}>{days[x.day]}: {x.person} — {x.shift} ({x.kind})</li>
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