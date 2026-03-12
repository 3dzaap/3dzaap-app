import Link from "next/link";
import { Card } from "@3dzaap/ui/components/card";
import { SiteHeader } from "../components/site-header";
import { PLANS } from "@3dzaap/utils";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="container page">
        <section className="hero">
          <div>
            <span className="badge">Foundation sprint em andamento</span>
            <h1 className="h1">3DZAAP Print Manager para operações de impressão 3D</h1>
            <p className="lead">
              Nesta primeira etapa estamos a construir a espinha dorsal do SaaS: autenticação,
              multi-tenant, assinaturas, gating por plano e dashboard base. A landing atual
              continua a ser a frente comercial enquanto o produto autenticado é estruturado.
            </p>
            <div className="buttonRow">
              <Link className="button primary" href="/signup">Começar teste</Link>
              <Link className="button secondary" href="/pricing">Ver planos</Link>
            </div>
          </div>
          <Card eyebrow="Core SaaS" title="Módulos homologados preservados">
            <ul style={{ margin: 0, paddingLeft: 18, color: "#475569", lineHeight: 1.8 }}>
              <li>Calculadora</li>
              <li>Filamentos</li>
              <li>Pedidos</li>
              <li>Financeiro</li>
              <li>Back office</li>
            </ul>
            <p style={{ color: "#475569", marginTop: 16 }}>
              O HTML funcional segue como fonte de verdade. Nesta fase não alteramos regras de negócio.
            </p>
          </Card>
        </section>

        <section className="stack">
          <h2>Planos definidos</h2>
          <div className="grid3">
            {Object.values(PLANS).map((plan) => (
              <Card key={plan.slug} eyebrow={plan.slug.toUpperCase()} title={plan.name}>
                <p style={{ color: "#475569" }}>{plan.description}</p>
                <div className="kpi">
                  {plan.monthlyPriceCents === 0 ? "Grátis" : `€${(plan.monthlyPriceCents / 100).toFixed(2)}`}
                </div>
                <ul style={{ paddingLeft: 18, color: "#475569", lineHeight: 1.7 }}>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
