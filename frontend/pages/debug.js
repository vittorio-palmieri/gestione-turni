import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import RequireAuth from "../components/RequireAuth";
import { getToken, apiFetch } from "../lib/api";

export default function DebugPage() {
  const [tokenInfo, setTokenInfo] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [peopleStatus, setPeopleStatus] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      const t = getToken();
      setTokenInfo(t ? `✅ Token presente (lunghezza: ${t.length})` : "❌ Token assente");
    } catch (e) {
      setTokenInfo("❌ Token non leggibile (storage bloccato)");
    }

    setBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "(VUOTO)");
  }, []);

  async function testPeople() {
    setErr("");
    setPeopleStatus("...");
    try {
      const res = await apiFetch("/people");
      setPeopleStatus(`✅ /people OK (righe: ${res.length})`);
    } catch (e) {
      setPeopleStatus("❌ /people FALLITA");
      setErr(e.message);
    }
  }

  return (
    <RequireAuth>
      <Layout>
        <div className="card" style={{ maxWidth: 720 }}>
          <h2 style={{ marginTop: 0 }}>Debug</h2>

          <div className="small" style={{ marginBottom: 10 }}>
            Questa pagina serve solo per capire perché alcune chiamate danno “Failed to fetch”.
          </div>

          <div style={{ marginBottom: 10 }}>
            <b>API Base URL:</b>
            <div className="badge" style={{ display: "inline-block", marginLeft: 8 }}>
              {baseUrl}
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <b>Token:</b> {tokenInfo}
          </div>

          <button className="btn primary" onClick={testPeople}>
            Test /people
          </button>

          <div style={{ marginTop: 12 }}>
            <b>Risultato:</b> {peopleStatus}
          </div>

          {err && (
            <div className="alert" style={{ marginTop: 12 }}>
              {err}
            </div>
          )}
        </div>
      </Layout>
    </RequireAuth>
  );
}