import type { FeatureKey, PlanDefinition, PlanSlug } from "@3dzaap/types";

export const PLANS: Record<PlanSlug, PlanDefinition> = {
  trial: {
    slug: "trial",
    name: "Teste",
    description: "Acesso total durante o período experimental.",
    monthlyPriceCents: 0,
    currency: "eur",
    features: ["calculator", "filaments", "orders", "financial", "branding"],
  },
  starter: {
    slug: "starter",
    name: "Starter",
    description: "Calculadora e gestão de filamentos.",
    monthlyPriceCents: 1900,
    currency: "eur",
    features: ["calculator", "filaments"],
  },
  pro: {
    slug: "pro",
    name: "Pro",
    description: "Starter mais gestão de pedidos.",
    monthlyPriceCents: 3900,
    currency: "eur",
    features: ["calculator", "filaments", "orders"],
  },
  business: {
    slug: "business",
    name: "Business",
    description: "Pro mais financeiro e personalização da marca.",
    monthlyPriceCents: 7900,
    currency: "eur",
    features: ["calculator", "filaments", "orders", "financial", "branding"],
  },
};

export function hasFeature(plan: PlanSlug, feature: FeatureKey): boolean {
  return PLANS[plan].features.includes(feature);
}

export function assertFeature(plan: PlanSlug, feature: FeatureKey): void {
  if (!hasFeature(plan, feature)) {
    throw new Error(`Plan ${plan} does not include feature ${feature}`);
  }
}
