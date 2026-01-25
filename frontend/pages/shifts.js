import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import RequireAuth from '../components/RequireAuth';
import { apiFetch } from '../lib/api';

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [err, setErr] = useState(null);
  const [savingId, setSavingId] = useState(null);
  // Aggiungi turno
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  function normTime(t) {
    if (!t) return null;
    return t.length === 5 ? `${t}:00` : t; // 09:00 -> 09:00:00
  }

  async function load() {
    setErr(null);
    try {
      const data = await apiFetch('/shifts');
      setShifts(data);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  function patchLocal(id, patch) {
    setShifts(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function addShift() {
    if (!newName.trim()) return;
    setErr(null);
    try {
      await apiFetch('/shifts', {
        method: 'POST',
        body: {
          name: newName.trim(),
          start_time: normTime(newStart),
          end_time: normTime(newEnd),
          notes: null
        }
      });
      setNewName(''); setNewStart(''); setNewEnd('');
      await load(); // <-- IMPORTANTISSIMO: ricarica la lista
    } catch (e) {
      setErr(e.message);
    }
  }

  async function saveShift(s) {
    setSavingId(s.id);
    setErr(null);
    try {
      await apiFetch(`/shifts/${s.id}`, {
        method: 'PUT',
        body: {
          name: s.name,
          start_time: normTime(s.start_time),
          end_time: normTime(s.end_time),
          notes: s.notes || null
        }
      });
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteShift(s) {
    if (!confirm(`Eliminare "${s.name}"?`)) return;
    setErr(null);
    try {
      await apiFetch(`/shifts/${s.id}`, { method: 'DELETE' });
      await load(); // <-- ricarica lista dopo delete
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <RequireAuth>
      <Layout>
        <div className="topbar">
          <div>
            <h1 style={{ margin: '0 0 4px 0' }}>Turni</h1>
            <div className="small">Aggiungi 1 turno, rinomina, orari, elimina.</div>
          </div>
        </div>

        {err && <div className="card alert" style={{ marginBottom: 12 }}>{err}</div>}

        {/* BOX AGGIUNGI TURNO */}
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Aggiungi turno</h3>
          <div className="row">
            <input className="input" placeholder="Nome turno" value={newName} onChange={e => setNewName(e.target.value)} />
            <input className="input" placeholder="Inizio (09:00)" value={newStart} onChange={e => setNewStart(e.target.value)} />
            <input className="input" placeholder="Fine (18:00)" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
            <button className="btn primary" onClick={addShift}>Aggiungi</button>
          </div>
        </div>

        {/* LISTA TURNI + 🗑️ */}
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Nome</th>
                <th style={{ width: 140 }}>Inizio</th>
                <th style={{ width: 140 }}>Fine</th>
                <th>Note</th>
                <th style={{ width: 210 }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map(s => (
                <tr key={s.id}>
                  <td><span className="badge">{s.sort_order}</span></td>
                  <td><input className="input" value={s.name} onChange={e => patchLocal(s.id, { name: e.target.value })} /></td>
                  <td><input className="input" value={s.start_time || ''} onChange={e => patchLocal(s.id, { start_time: e.target.value })} /></td>
                  <td><input className="input" value={s.end_time || ''} onChange={e => patchLocal(s.id, { end_time: e.target.value })} /></td>
                  <td><input className="input" value={s.notes || ''} onChange={e => patchLocal(s.id, { notes: e.target.value })} /></td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn primary" onClick={() => saveShift(s)} disabled={savingId === s.id}>
                        {savingId === s.id ? 'Salvo...' : 'Salva'}
                      </button>
                      <button className="btn danger" onClick={() => deleteShift(s)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              {shifts.length === 0 && (
                <tr><td colSpan="6" className="small">Nessun turno. Aggiungine uno sopra.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Layout>
    </RequireAuth>
  );
}