import { Card } from "@3dzaap/ui/components/card";
import { DashboardShell } from "../../../components/dashboard-shell";
import { getMockSession } from "../../../lib/mock-session";
import { hasFeature } from "@3dzaap/utils";

const moduleCards = [
  { key: "calculator", title: "Calculadora", description: "Primeiro módulo a ser migrado com paridade funcional." },
  { key: "filaments", title: "Filamentos", description: "CRUD de materiais e insumos homologados." },
  { key: "orders", title: "Pedidos", description: "Gestão operacional de encomendas e estados." },
  { key: "financial", title: "Financeiro", description: "Receitas, custos e visão do negócio." },
  { key: "branding", title: "Personalização", description: "Logo, cores e nome da empresa no plano Business." },
] as const;

export default function DashboardPage() {
  const session = getMockSession();

  return (
    <DashboardShell>
      <div className="stack">
        <div>
          <span className="badge">Dashboard base</span>
          <h1 className="h1" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>Olá, {session.companyName}</h1>
          <p className="lead">A primeira etapa entrega a casca do produto: multi-tenant, plano, billing e guards por feature.</p>
        </div>
        <div className="grid3">
          {moduleCards.map((module) => (
            <Card key={module.key} eyebrow={hasFeature(session.plan, module.key) ? "Disponível" : "Bloqueado"} title={module.title}>
              <p style={{ color: "#475569" }}>{module.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
