import Link from "next/link";
import type { ReactNode } from "react";
import { getMockSession } from "../lib/mock-session";

export function DashboardShell({ children }: { children: ReactNode }) {
  const session = getMockSession();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 24 }}>
          <span style={{ color: "#f59e0b" }}>3D</span>ZAAP
        </div>
        <div className="stack" style={{ marginBottom: 24 }}>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/pricing">Planos</Link>
          <Link href="/billing">Assinatura</Link>
        </div>
        <div className="notice">
          <strong>{session.companyName}</strong>
          <div>Plano atual: {session.plan.toUpperCase()}</div>
          <div>{session.email}</div>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
