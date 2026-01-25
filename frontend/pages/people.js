import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import RequireAuth from '../components/RequireAuth';
import { apiFetch } from '../lib/api';

export default function People() {
  const [people, setPeople] = useState([]);
  const [fullName, setFullName] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState(null);

  async function load() {
    setErr(null);
    try { setPeople(await apiFetch('/people')); }
    catch(e){ setErr(e.message); }
  }
  useEffect(()=>{ load(); }, []);

  async function add() {
    if (!fullName.trim()) return;
    try {
      await apiFetch('/people', { method:'POST', body:{ full_name: fullName.trim(), notes: notes.trim() || null } });
      setFullName(''); setNotes('');
      await load();
    } catch(e){ setErr(e.message); }
  }

  async function toggleActive(p) {
    try {
      await apiFetch(`/people/${p.id}`, {
        method:'PUT',
        body: { full_name: p.full_name, is_active: !p.is_active, notes: p.notes ?? null }
      });
      await load();
    } catch(e){ setErr(e.message); }
  }

  return (
    <RequireAuth>
      <Layout>
        <div className="topbar">
          <div>
            <h1 style={{margin:'0 0 4px 0'}}>Risorse</h1>
            <div className="small">Il cestino disattiva (non cancella lo storico).</div>
          </div>
        </div>

        {err && <div className="card alert" style={{marginBottom:12}}>{err}</div>}

        <div className="card" style={{marginBottom:12}}>
          <h3 style={{marginTop:0}}>Aggiungi persona</h3>
          <div className="row">
            <input className="input" placeholder="Nome e cognome" value={fullName} onChange={e=>setFullName(e.target.value)} />
            <input className="input" placeholder="Note (opzionale)" value={notes} onChange={e=>setNotes(e.target.value)} />
            <button className="btn primary" onClick={add}>Aggiungi</button>
          </div>
        </div>

        <div className="card">
          <table className="grid">
            <thead>
              <tr><th>Nome</th><th>Stato</th><th>Azioni</th></tr>
            </thead>
            <tbody>
              {people.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{fontWeight:800}}>{p.full_name}</div>
                    {p.notes && <div className="small">{p.notes}</div>}
                  </td>
                  <td>{p.is_active ? <span className="badge">Attivo</span> : <span className="badge">Disattivo</span>}</td>
                  <td>
                    {p.is_active ? (
                      <button className="btn danger" title="Disattiva" onClick={() => {
                        if (confirm(`Disattivare ${p.full_name}?`)) toggleActive(p);
                      }}>
                        🗑️
                      </button>
                    ) : (
                      <button className="btn" title="Riattiva" onClick={() => toggleActive(p)}>
                        ♻️
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {people.length===0 && <tr><td colSpan="3" className="small">Nessuna persona ancora.</td></tr>}
            </tbody>
          </table>
        </div>
      </Layout>
    </RequireAuth>
  );
}
