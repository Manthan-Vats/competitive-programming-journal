import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Landing } from "@/components/landing";
import { Metadata } from "next";

// The public root "/" is the SolveLog marketing landing for logged-out visitors. Logged-in users
// are sent straight to their journal. The operator's own public portfolio now lives at
// /u/<their-handle> (the same render that used to be here), so a stranger never lands on someone
// else's personal data.

export const metadata: Metadata = {
  title: "SolveLog - remember every problem you solve",
  description:
    "You grind hundreds of problems for placements, then forget most of them. SolveLog keeps every problem you solve, breaks down the pattern with AI, and brings it back with spaced repetition so it actually sticks. Invite-only.",
  openGraph: {
    title: "SolveLog - remember every problem you solve",
    description:
      "Capture every problem you solve, understand the pattern, and never forget it. Built for the placement grind.",
    type: "website",
  },
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/admin");

  return <Landing />;
}
