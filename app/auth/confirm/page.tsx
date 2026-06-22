import { ModifiedBear } from "@/components/modified-bear";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { Cap } from "@/components/paper/bits";

// Landing page for the invite/confirm email link. Crucially this is a PAGE (GET), not a
// route handler - visiting it does NOT consume the one-time token. The token is verified
// only when the user submits the form below (a POST to /auth/confirm/accept), so email
// security scanners that pre-fetch links can't invalidate the invite before the human
// clicks. The form is a plain HTML POST, so it also works without JavaScript.
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    token_hash?: string;
    type?: string;
    next?: string;
  }>;
}) {
  const sp = await searchParams;
  const hasToken = Boolean(sp.code || sp.token_hash);

  return (
    <div className="cpj-desk min-h-screen w-full flex items-center justify-center p-6">
      <PaperSheet variant="page" className="cpj-develop w-full max-w-[360px] p-8 text-center">
        <div className="select-none">
          <ModifiedBear className="w-[34px] h-[34px] mx-auto text-ink" />
          <Cap className="mt-2.5">THE NUMBERS</Cap>
          <p className="font-body text-[18px] text-ink mt-2">you&apos;ve been invited.</p>
          <p className="font-mono text-[9px] tracking-[0.1em] text-ink-faint mt-1">
            confirm to enter the journal and set your password.
          </p>
        </div>

        {hasToken ? (
          <form action="/auth/confirm/accept" method="post" className="mt-6">
            {sp.code ? <input type="hidden" name="code" value={sp.code} /> : null}
            {sp.token_hash ? <input type="hidden" name="token_hash" value={sp.token_hash} /> : null}
            {sp.type ? <input type="hidden" name="type" value={sp.type} /> : null}
            {sp.next ? <input type="hidden" name="next" value={sp.next} /> : null}
            <button
              type="submit"
              className="cpj-press w-full inline-flex items-center justify-center rounded-[2px] bg-blood px-4 py-3 font-type text-[15px] text-[#FBE9E7]"
              style={{ boxShadow: "0 2px 0 var(--color-blood-deep)" }}
            >
              ▸ confirm &amp; enter
            </button>
          </form>
        ) : (
          <p className="mt-6 font-body text-[14px] text-ink-soft">
            this link is missing its token. ask the operator for a fresh invite.
          </p>
        )}
      </PaperSheet>
    </div>
  );
}
