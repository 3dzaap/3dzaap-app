import { Card } from "@3dzaap/ui/components/card";
import { DashboardShell } from "../../components/dashboard-shell";
import { getMockSession } from "../../lib/mock-session";
import { PLANS } from "@3dzaap/utils";

export default function BillingPage() {
  const session = getMockSession();
  const currentPlan = PLANS[session.plan];

  return (
    <DashboardShell>
      <div className="stack">
        <div>
          <span className="badge">Billing</span>
          <h1 className="h1" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>Assinatura e upgrades</h1>
          <p className="lead">Próximo passo: ligar esta página ao checkout do Stripe e ao portal de gestão da subscrição.</p>
        </div>
        <Card eyebrow="Plano atual" title={currentPlan.name}>
          <p style={{ color: "#475569" }}>{currentPlan.description}</p>
          <div className="kpi">
            {currentPlan.monthlyPriceCents === 0 ? "Trial" : `€${(currentPlan.monthlyPriceCents / 100).toFixed(2)}`}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
