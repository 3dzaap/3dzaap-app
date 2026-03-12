import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

Deno.serve(async (req) => {
  const { priceId } = await req.json();
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return new Response("Membership not found", { status: 404 });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
  const session = await stripe.checkout.sessions.create({
    customer_email: user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    subscription_data: {
      metadata: { company_id: membership.company_id },
    },
    success_url: `${Deno.env.get("APP_URL")}/billing?success=1`,
    cancel_url: `${Deno.env.get("APP_URL")}/billing`,
  });

  return Response.json({ url: session.url });
});
