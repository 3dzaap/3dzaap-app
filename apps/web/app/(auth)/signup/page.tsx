import { Card } from "@3dzaap/ui/components/card";
import { SiteHeader } from "../../../components/site-header";

export default function SignupPage() {
  return (
    <>
      <SiteHeader />
      <main className="container page">
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Card eyebrow="Onboarding" title="Criar conta e empresa">
            <form className="form">
              <label className="label">
                Nome da empresa
                <input className="input" placeholder="Minha empresa 3D" />
              </label>
              <label className="label">
                Email do responsável
                <input className="input" type="email" placeholder="fundador@empresa.com" />
              </label>
              <label className="label">
                Palavra-passe
                <input className="input" type="password" placeholder="••••••••" />
              </label>
              <button className="button primary" type="submit">Criar conta de teste</button>
            </form>
            <p style={{ color: "#475569", marginTop: 16 }}>
              Nesta fase o fluxo já reflete o modelo correto: utilizador, empresa, membership e assinatura trial.
            </p>
          </Card>
        </div>
      </main>
    </>
  );
}
