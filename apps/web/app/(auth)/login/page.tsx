import Link from "next/link";
import { Card } from "@3dzaap/ui/components/card";
import { SiteHeader } from "../../../components/site-header";

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="container page">
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <Card eyebrow="Autenticação" title="Entrar no 3DZAAP">
            <form className="form">
              <label className="label">
                Email
                <input className="input" type="email" placeholder="voce@empresa.com" />
              </label>
              <label className="label">
                Palavra-passe
                <input className="input" type="password" placeholder="••••••••" />
              </label>
              <button className="button primary" type="submit">Entrar</button>
            </form>
            <p style={{ color: "#475569", marginTop: 16 }}>
              Ainda nesta sprint o formulário será ligado ao Supabase Auth real.
            </p>
            <p style={{ color: "#475569" }}>
              Não tem conta? <Link href="/signup" style={{ color: "#2563eb" }}>Criar conta</Link>
            </p>
          </Card>
        </div>
      </main>
    </>
  );
}
