import { Card } from "@3dzaap/ui/components/card";
import { SiteHeader } from "../../components/site-header";
import { PLANS } from "@3dzaap/utils";

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="container page stack">
        <div>
          <span className="badge">Billing foundation</span>
          <h1 className="h1" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>Planos e feature gating</h1>
          <p className="lead">
            Estrutura inicial pronta para ligar ao Stripe. Os preços podem ser ajustados no dashboard da Stripe sem alterar a matriz funcional.
          </p>
        </div>
        <div className="grid3">
          {Object.values(PLANS).map((plan) => (
            <Card key={plan.slug} eyebrow={plan.slug.toUpperCase()} title={plan.name}>
              <div className="kpi">
                {plan.monthlyPriceCents === 0 ? "Trial" : `€${(plan.monthlyPriceCents / 100).toFixed(2)}`}
              </div>
              <p style={{ color: "#475569" }}>{plan.description}</p>
              <ul style={{ paddingLeft: 18, color: "#475569", lineHeight: 1.8 }}>
                {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
