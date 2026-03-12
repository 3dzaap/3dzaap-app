export type PlanSlug = "trial" | "starter" | "pro" | "business";

export type FeatureKey =
  | "calculator"
  | "filaments"
  | "orders"
  | "financial"
  | "branding";

export type CompanyRole = "owner" | "admin" | "member";

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  createdAt: string;
}

export interface Membership {
  userId: string;
  companyId: string;
  role: CompanyRole;
}

export interface Subscription {
  companyId: string;
  plan: PlanSlug;
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

export interface PlanDefinition {
  slug: PlanSlug;
  name: string;
  description: string;
  monthlyPriceCents: number;
  currency: "eur";
  features: FeatureKey[];
}
