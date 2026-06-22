import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isOperator } from "@/lib/auth/operator";
import { InvitesClient } from "./invites-client";

// Operator-only surface (defense-in-depth on top of the nav hiding): re-check the
// operator here so a non-operator tenant who guesses the URL is bounced.
export default async function InvitesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isOperator(user)) {
    redirect("/admin");
  }

  const admin = createAdminClient();
  const { data: requests } = await admin
    .from("access_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return <InvitesClient initialRequests={requests ?? []} />;
}
