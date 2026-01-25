import { useEffect } from "react";
import { useRouter } from "next/router";
import { getToken } from "../lib/api";

export default function RequireAuth({ children }) {
  const router = useRouter();

  useEffect(() => {
    const t = getToken();
    if (!t) router.replace("/login");
  }, [router]);

  return children;
}