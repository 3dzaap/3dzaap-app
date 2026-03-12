import type { PlanSlug } from "@3dzaap/types";

export interface AppSession {
  userId: string;
  email: string;
  companyName: string;
  plan: PlanSlug;
}

export function getMockSession(): AppSession {
  return {
    userId: "demo-user",
    email: "founder@3dzaap.com",
    companyName: "Demo Prints Studio",
    plan: "trial",
  };
}
