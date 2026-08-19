/**
 * Server-side gate for the "add credit" form.
 *
 * The form itself is a client component, so the check lives here: a locked
 * vendor never reaches the form at all, instead of filling it in and being
 * refused by the API on submit.
 *
 * Gating the ROUTE rather than each button is deliberate. Several places link to
 * /dashboard/credit/new (the header CTA and three CTAs in credits-client), and
 * disabling each one would leave the policy duplicated in client state that a
 * stale render could get wrong. One server-side check covers all of them and
 * cannot be bypassed.
 */

import { redirect } from "next/navigation";
import { getVendorEntitlement } from "@/lib/entitlement-guard";

export default async function AddCreditGate({ children }: { children: React.ReactNode }) {
  const result = await getVendorEntitlement();

  // No session — the dashboard middleware already handles the redirect to
  // /login, so leave that path alone rather than second-guessing it here.
  if (result && !result.entitlement.canWrite) {
    redirect("/dashboard/upgrade?blocked=credit");
  }

  return <>{children}</>;
}
