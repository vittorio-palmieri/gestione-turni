import { useState } from "react";
import { useRouter } from "next/router";
import { apiFetch, setToken } from "../lib/api";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("admin@gestione-turni.local");
  const [password, setPassword] = useState("Admin!2026Turni");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, password },
        token: null,
      });
      setToken(data.access_token);
      router.push("/planning");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Login</h1>
        {err && <div className="card alert" style={{ marginBottom: 12 }}>{err}</div>}

        <form onSubmit={onSubmit}>
          <div className="small">Email</div>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />

          <div style={{ height: 10 }} />

          <div className="small">Password</div>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

          <div style={{ height: 14 }} />

          <button className="btn primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Accesso..." : "Entra"}
          </button>
        </form>
      </div>
    </div>
  );
}