// Single source of truth for "is this request the instance OPERATOR?".
// Under the multi-tenant model (migration 002) every invited user is a normal
// tenant: they own their rows and RLS scopes everything to `user_id`. There is no
// per-data "admin" anymore - authorization for data lives in the database.
// The OPERATOR is the one elevated role that remains: the single super-admin who
// runs this instance and is allowed to approve access requests and send invites
// (gates /admin/invites and POST /api/invites only). It is pinned to one Supabase
// auth user id via OWNER_USER_ID.
// FAIL CLOSED: if OWNER_USER_ID is unset/empty, nobody is the operator, so the
// invite-approval surface is denied. The rest of /admin still works for any
// authenticated tenant (their own journal), and public reads are unaffected.

type MaybeUser = { id?: string | null } | null | undefined;

/** The configured operator user id, trimmed. Empty string means "not configured". */
export function getOperatorId(): string {
  return (process.env.OWNER_USER_ID ?? "").trim();
}

/** True only when `user` is the configured operator. Fails closed when unconfigured. */
export function isOperator(user: MaybeUser): boolean {
  const operatorId = getOperatorId();
  if (!operatorId) return false;
  return !!user?.id && user.id === operatorId;
}
