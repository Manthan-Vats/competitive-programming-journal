import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isOperator } from "@/lib/auth/operator";
import { AdminShell } from "./admin-shell";

// Multi-tenant: /admin is each invited user's own journal. We require a logged-in
// user (middleware also gates this); per-row data access is enforced by RLS. The
// single OPERATOR additionally sees the invite-approval surface - we compute that
// flag here and pass it to the shell so the nav link only shows for them.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // The shell's "view public" link needs the user's public handle (their portfolio lives at
  // /u/<handle> now that "/" is the marketing landing). Null when they haven't set one yet.
  const { data: profile } = await supabase
    .from("profile")
    .select("username")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <AdminShell isOperator={isOperator(user)} publicHandle={(profile?.username as string) || null}>
      {children}
    </AdminShell>
  );
}
