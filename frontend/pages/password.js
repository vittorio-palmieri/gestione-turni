import { useState } from "react";
import Layout from "../components/Layout";
import RequireAuth from "../components/RequireAuth";
import { apiFetch, clearToken } from "../lib/api";
import { useRouter } from "next/router";

export default function PasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [nextPwd, setNextPwd] = useState("");
  const [nextPwd2, setNextPwd2] = useState("");
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!current || !nextPwd) {
      setErr("Compila tutti i campi.");
      return;
    }
    if (nextPwd !== nextPwd2) {
      setErr("La nuova password non coincide.");
      return;
    }
    if (nextPwd.length < 8) {
      setErr("La nuova password deve avere almeno 8 caratteri.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: { current_password: current, new_password: nextPwd },
      });

      setMsg("Password aggiornata ✅. Devi rifare login.");
      // forziamo logout
      clearToken();
      setTimeout(() => router.push("/login"), 700);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <Layout>
        <div className="card" style={{ maxWidth: 520 }}>
          <h2 style={{ marginTop: 0 }}>Cambia password</h2>

          {err && <div className="alert" style={{ marginBottom: 12 }}>{err}</div>}
          {msg && <div className="card" style={{ border: "1px solid #bbf7d0", marginBottom: 12 }}>{msg}</div>}

          <form onSubmit={submit}>
            <div className="small">Password attuale</div>
            <input
              className="input"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />

            <div style={{ height: 12 }} />

            <div className="small">Nuova password</div>
            <input
              className="input"
              type="password"
              value={nextPwd}
              onChange={(e) => setNextPwd(e.target.value)}
              autoComplete="new-password"
            />

            <div style={{ height: 12 }} />

            <div className="small">Ripeti nuova password</div>
            <input
              className="input"
              type="password"
              value={nextPwd2}
              onChange={(e) => setNextPwd2(e.target.value)}
              autoComplete="new-password"
            />

            <div style={{ height: 14 }} />

            <button className="btn primary" disabled={loading} style={{ width: "100%" }}>
              {loading ? "Salvo..." : "Aggiorna password"}
            </button>
          </form>
        </div>
      </Layout>
    </RequireAuth>
  );
}