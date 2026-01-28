import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { clearToken } from "../lib/api";

export default function Layout({ children }) {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false);

  const menu = [
    { href: "/planning", label: "Planning" },
    { href: "/riposi", label: "Riposi" },
    { href: "/assenze", label: "Assenze" },
    { href: "/people", label: "Persone" },
    { href: "/shifts", label: "Turni" },
    { href: "/password", label: "Password" },
  ];

  useEffect(() => {
    function onResize() {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setOpen(false);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function logout() {
    clearToken();
    router.push("/login");
  }

  function NavLinks() {
    return (
      <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {menu.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: router.pathname === item.href ? "#374151" : "transparent",
              color: "#fff",
              textDecoration: "none",
              fontWeight: router.pathname === item.href ? 800 : 600,
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* MOBILE TOP BAR */}
      {isMobile && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 56,
            background: "#1f2937",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
            zIndex: 50,
          }}
        >
          <button
            className="btn"
            onClick={() => setOpen(true)}
            style={{
              background: "#374151",
              color: "#fff",
              padding: "10px 12px",
              borderRadius: 10,
              fontWeight: 800,
            }}
          >
            ☰
          </button>

          <div style={{ fontWeight: 900 }}>Gestione Turni</div>

          <button
            className="btn"
            onClick={logout}
            style={{
              background: "#374151",
              color: "#fff",
              padding: "10px 12px",
              borderRadius: 10,
              fontWeight: 800,
            }}
          >
            Logout
          </button>
        </div>
      )}

      {/* OVERLAY (mobile) */}
      {isMobile && open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 60,
          }}
        />
      )}

      {/* SIDEBAR */}
      <aside
        style={{
          width: 240,
          background: "#1f2937",
          color: "#fff",
          padding: 20,
          position: isMobile ? "fixed" : "sticky",
          top: isMobile ? 0 : 0,
          left: isMobile ? (open ? 0 : -260) : 0,
          height: "100vh",
          zIndex: 70,
          transition: "left 0.2s ease",
          boxShadow: isMobile ? "0 10px 30px rgba(0,0,0,0.25)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: "0 0 16px 0" }}>Gestione Turni</h3>

          {isMobile && (
            <button
              className="btn"
              onClick={() => setOpen(false)}
              style={{
                background: "#374151",
                color: "#fff",
                padding: "8px 10px",
                borderRadius: 10,
                fontWeight: 900,
              }}
            >
              ✕
            </button>
          )}
        </div>

        <NavLinks />

        {!isMobile && (
          <div style={{ marginTop: 16 }}>
            <button className="btn" style={{ width: "100%" }} onClick={logout}>
              Logout
            </button>
          </div>
        )}
      </aside>

      {/* MAIN */}
      <main
        style={{
          flex: 1,
          padding: isMobile ? "76px 14px 14px 14px" : 24,
          background: "#f9fafb",
          marginLeft: isMobile ? 0 : 0,
          width: "100%",
        }}
      >
        {children}
      </main>
    </div>
  );
}