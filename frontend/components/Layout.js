import Link from "next/link";
import { useRouter } from "next/router";
import { clearToken } from "../lib/api";

export default function Layout({ children }) {
  const router = useRouter();

  const menu = [
    { href: "/planning", label: "Planning" },
    { href: "/riposi", label: "Riposi" },
    { href: "/assenze", label: "Assenze" },
    { href: "/people", label: "Persone" },
    { href: "/shifts", label: "Turni" },
  ];

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 220, background: "#1f2937", color: "#fff", padding: 20 }}>
        <h3 style={{ marginBottom: 20 }}>Gestione Turni</h3>

        <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                background: router.pathname === item.href ? "#374151" : "transparent",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: 16 }}>
          <button className="btn" style={{ width: "100%" }} onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: 24, background: "#f9fafb" }}>{children}</main>
    </div>
  );
}