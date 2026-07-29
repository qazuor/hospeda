/**
 * @fileoverview
 * Data migration: 0029-hos-296-fixture-role-grants
 *
 * Seed dual-write counterpart to HOS-296's multi-role cut. The baseline half
 * (a fresh `db:fresh-dev` builds correct fixtures) landed with the seeds
 * themselves; this is the delta for environments seeded BEFORE the cut.
 *
 * ## What the structural migration leaves behind
 *
 * `packages/db/src/migrations/0069_mushy_captain_america.sql` backfills
 * `user_role` from `users.role` — a **straight copy**, one row per user, per
 * spec §6.6. That is right for real accounts, but the dev/test fixtures were
 * never single-hatted; the seed code now grants them SETS:
 *
 * | Fixture | Set the baseline seeds grant | What the 0069 copy alone produces |
 * |---|---|---|
 * | 3 gastronomy commerce owners | `{USER, COMMERCE_OWNER}` | `{COMMERCE_OWNER}` — missing `USER` |
 * | `e2e-tourist@local.test` | `{USER}` | `{USER}` — already correct |
 * | 13 `*@local.test` test users | `{USER, <declared>}` | `{whatever the scalar last said}` |
 *
 * This migration converges each fixture onto the same set its seed produces
 * today.
 *
 * ## AC-11 is why this is not cosmetic
 *
 * `commerce/commerce-02-access-control` and `commerce/commerce-04-permission-gate`
 * sign in as `gastro-owner-julieta@local.test`, a PRE-SEEDED fixture — sweeping
 * raw SQL in `apps/e2e` (spec §7.2) does not cover them. `commerce-02` case 1
 * signs in as `e2e-tourist@local.test` and asserts it is REDIRECTED away from
 * `/mi-cuenta/comercio/`, so the ABSENCE of `COMMERCE_OWNER` there is as
 * load-bearing as the presence of `USER` — which is why the tourist fixture is
 * grant-only and never gains a hat it did not already have.
 *
 * ## Interaction with the 0069 backfill — no duplicates, no overwrites
 *
 * `grantRole` is `INSERT ... ON CONFLICT (user_id, role) DO NOTHING`. Where
 * 0069 already inserted the row (`grant_reason = 'migrated_from_users_role'`)
 * the grant here is a no-op that leaves the original provenance intact and
 * writes no audit row; where the row is absent it inserts with
 * `grant_reason = 'seed'`. The two carriles compose additively, in either
 * order, any number of times.
 *
 * ## Grants before revokes
 *
 * For the 13 test users the old scalar drift-heal (`update(users, { role })`)
 * became a SET sync: grant `{USER, declared}`, then revoke anything else. A
 * `tourist-*` fixture whose scalar had drifted to `HOST` (the host-onboarding
 * funnel used to overwrite it) is copied by 0069 as `{HOST}`, and only the
 * revoke restores the predictable baseline the smoke matrix depends on.
 * Ordering matters: `USER` is granted first, so a revoke can never trip
 * `revokeRole`'s last-role guard (AC-5).
 *
 * ## Why `group: 'required'` and not `'example'`
 *
 * These fixtures are dev/staging-only, which reads like `'example'` — but the
 * runner's production gate refuses an `'example'`-group migration
 * unconditionally, and that refusal throws for the WHOLE pending batch
 * (`runner.ts` → `evaluateProdDataMigrationGate`), which would wedge every
 * later `required` migration on production. Every existing migration here is
 * `'required'` for the same reason, including the ones targeting example data
 * (`0019`, `0023`, `0024`). Production safety comes from the targeting
 * instead: every account is matched by a literal `@local.test` fixture email
 * that cannot exist in production, so the migration writes nothing there.
 *
 * ## Why `destructive: false` despite issuing revokes
 *
 * `revokeRole` deletes a `user_role` row, and the flag exists so an operator
 * consciously approves irreversible production data loss. Neither applies: a
 * revoke can only fire for one of the 13 hard-coded `*@local.test` accounts —
 * an address space that by construction does not exist in production — and the
 * effect is restorative (it re-imposes the fixture's declared shape,
 * reproducible with `pnpm db:seed:test-users`). Marking it `true` would force
 * `--allow-destructive` on the next production `db:seed:migrate`, training
 * operators to pass a blanket opt-in that also unblocks genuinely destructive
 * migrations — a worse outcome than this flag being `false`.
 *
 * Baseline counterparts (dual-write rule): `src/example/gastronomies.seed.ts`,
 * `src/test-users/testUsers.seed.ts`.
 */
import { inArray, users } from '@repo/db';
import { RoleEnum, RoleGrantReason } from '@repo/schemas';
import { getUserRoles, grantRole, revokeRole } from '@repo/service-core';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0029-hos-296-fixture-role-grants',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * Minimal structural interface of the three multi-role primitives this
 * migration uses.
 *
 * Injected (with a real default) rather than imported-and-module-mocked because
 * `vi.mock('@repo/service-core')` does NOT reliably intercept for this module —
 * the same limitation `required/systemUser.seed.ts` documents for its own
 * `GrantRolePort`. The primitives open real database transactions, and this
 * migration's unit tests run with no database.
 *
 * @internal
 */
export interface RolePrimitivesPort {
    /** Additive, idempotent "grant if absent". */
    grantRole(params: {
        userId: string;
        role: RoleEnum;
        grantedBy: null;
        reason: string;
        ctx: { tx: SeedMigrationCtx['db'] };
    }): Promise<{ error?: { message: string } }>;
    /** Idempotent revoke that refuses to remove a user's last hat. */
    revokeRole(params: {
        userId: string;
        role: RoleEnum;
        revokedBy: null;
        reason: string;
        ctx: { tx: SeedMigrationCtx['db'] };
    }): Promise<{ error?: { message: string } }>;
    /** The set of hats a user currently holds. */
    getUserRoles(params: {
        userId: string;
        ctx: { tx: SeedMigrationCtx['db'] };
    }): Promise<readonly RoleEnum[]>;
}

/** The real primitives, used whenever `up()` is called without an override. */
const DEFAULT_ROLE_PRIMITIVES: RolePrimitivesPort = {
    grantRole,
    revokeRole,
    getUserRoles
};

/**
 * One fixture account this migration converges, keyed by email.
 *
 * `mode` decides whether extra hats are revoked:
 * - `'grant-only'` — union the target set in, leave anything else alone.
 *   Mirrors `example/gastronomies.seed.ts`, which only grants.
 * - `'exact-set'` — grant the target set, then revoke every other held role.
 *   Mirrors `syncTestUserRoles` in `test-users/testUsers.seed.ts`.
 */
interface FixtureRoleTarget {
    /** Fixture email — the only stable key; these rows carry random DB ids. */
    readonly email: string;
    /** The set of hats the fixture must hold after this migration. */
    readonly roles: readonly RoleEnum[];
    /** Whether hats outside {@link FixtureRoleTarget.roles} are revoked. */
    readonly mode: 'grant-only' | 'exact-set';
}

/**
 * The fixture accounts, frozen as literals rather than imported from the seed
 * modules on purpose: a data-migration must keep meaning exactly what it meant
 * the day it was written, and the seed constants are free to change.
 *
 * Sources at authoring time:
 * - `packages/seed/src/example/gastronomies.seed.ts` — `COMMERCE_OWNERS`, `E2E_TOURIST`
 * - `packages/seed/src/test-users/testUsers.seed.ts` — `TEST_USERS`
 */
const FIXTURE_ROLE_TARGETS: readonly FixtureRoleTarget[] = [
    // ── example/gastronomies.seed.ts — commerce owners (AC-11) ───────────────
    {
        email: 'gastro-owner-julieta@local.test',
        roles: [RoleEnum.USER, RoleEnum.COMMERCE_OWNER],
        mode: 'grant-only'
    },
    {
        email: 'gastro-owner-rodrigo@local.test',
        roles: [RoleEnum.USER, RoleEnum.COMMERCE_OWNER],
        mode: 'grant-only'
    },
    {
        email: 'gastro-owner-valentina@local.test',
        roles: [RoleEnum.USER, RoleEnum.COMMERCE_OWNER],
        mode: 'grant-only'
    },
    // ── example/gastronomies.seed.ts — the e2e tourist ───────────────────────
    // Grant-only, and deliberately NOT COMMERCE_OWNER (see the AC-11 note above).
    {
        email: 'e2e-tourist@local.test',
        roles: [RoleEnum.USER],
        mode: 'grant-only'
    },
    // ── test-users/testUsers.seed.ts — the 13-account smoke matrix ───────────
    { email: 'editor@local.test', roles: [RoleEnum.USER, RoleEnum.EDITOR], mode: 'exact-set' },
    { email: 'sponsor@local.test', roles: [RoleEnum.USER, RoleEnum.SPONSOR], mode: 'exact-set' },
    { email: 'tourist-free@local.test', roles: [RoleEnum.USER], mode: 'exact-set' },
    { email: 'tourist-plus@local.test', roles: [RoleEnum.USER], mode: 'exact-set' },
    { email: 'tourist-vip@local.test', roles: [RoleEnum.USER], mode: 'exact-set' },
    { email: 'host-basico@local.test', roles: [RoleEnum.USER, RoleEnum.HOST], mode: 'exact-set' },
    { email: 'host-pro@local.test', roles: [RoleEnum.USER, RoleEnum.HOST], mode: 'exact-set' },
    { email: 'host-premium@local.test', roles: [RoleEnum.USER, RoleEnum.HOST], mode: 'exact-set' },
    {
        email: 'host-pro-plus-addon@local.test',
        roles: [RoleEnum.USER, RoleEnum.HOST],
        mode: 'exact-set'
    },
    { email: 'host-trial@local.test', roles: [RoleEnum.USER, RoleEnum.HOST], mode: 'exact-set' },
    {
        email: 'complex-basico@local.test',
        roles: [RoleEnum.USER, RoleEnum.CLIENT_MANAGER],
        mode: 'exact-set'
    },
    {
        email: 'complex-pro@local.test',
        roles: [RoleEnum.USER, RoleEnum.CLIENT_MANAGER],
        mode: 'exact-set'
    },
    {
        email: 'complex-premium@local.test',
        roles: [RoleEnum.USER, RoleEnum.CLIENT_MANAGER],
        mode: 'exact-set'
    }
] as const;

/**
 * Converges one fixture account onto its declared set of hats.
 *
 * Grants run before revokes so `USER` is always in place by the time a revoke
 * could otherwise strand the account (AC-5 / AC-12).
 *
 * Both primitives are enlisted in the migration's transaction via
 * `ctx: { tx }`. That is not optional: without it `grantRole` calls
 * `withTransaction` with no existing handle and opens a SECOND, independent
 * transaction on the pool — one that cannot see this migration's uncommitted
 * writes, and that `revokeRole`'s `SELECT ... FOR UPDATE` on the same `users`
 * row could deadlock against.
 *
 * @param params.target - The fixture's declared target set and mode.
 * @param params.userId - Resolved `users.id` for that fixture.
 * @param params.tx - The migration's transaction-scoped client (`ctx.db`).
 * @param params.primitives - The role primitives to call.
 * @returns Counts of hats actually granted and revoked (no-ops count as 0).
 * @throws {Error} When a grant or revoke fails.
 */
async function syncFixtureRoles(params: {
    target: FixtureRoleTarget;
    userId: string;
    tx: SeedMigrationCtx['db'];
    primitives: RolePrimitivesPort;
}): Promise<{ granted: number; revoked: number }> {
    const { target, userId, tx, primitives } = params;
    const ctx = { tx };

    const before = new Set<RoleEnum>(await primitives.getUserRoles({ userId, ctx }));
    const desired = new Set<RoleEnum>(target.roles);

    let granted = 0;
    for (const role of desired) {
        if (before.has(role)) {
            continue;
        }
        const result = await primitives.grantRole({
            userId,
            role,
            grantedBy: null,
            reason: RoleGrantReason.SEED,
            ctx
        });
        if (result.error) {
            throw new Error(`Failed to grant ${role} to ${target.email}: ${result.error.message}`);
        }
        granted++;
    }

    if (target.mode === 'grant-only') {
        return { granted, revoked: 0 };
    }

    let revoked = 0;
    for (const role of before) {
        if (desired.has(role)) {
            continue;
        }
        const result = await primitives.revokeRole({
            userId,
            role,
            revokedBy: null,
            reason: RoleGrantReason.SEED,
            ctx
        });
        if (result.error) {
            throw new Error(
                `Failed to revoke ${role} from ${target.email}: ${result.error.message}`
            );
        }
        revoked++;
    }

    return { granted, revoked };
}

/**
 * Applies the fixture role convergence.
 *
 * Idempotent: a second run finds every target set already satisfied and issues
 * zero writes.
 *
 * @param ctx - Migration context; `ctx.db` is the transaction-scoped client.
 * @param primitives - Role primitives override. The runner never passes this;
 *   it exists so unit tests can run without a database (see
 *   {@link RolePrimitivesPort}).
 * @returns Summary plus per-stage counters for the runner's log/ledger output.
 */
export async function up(
    ctx: SeedMigrationCtx,
    primitives: RolePrimitivesPort = DEFAULT_ROLE_PRIMITIVES
): Promise<SeedMigrationResult> {
    const emails = FIXTURE_ROLE_TARGETS.map((target) => target.email);

    // One lookup for every fixture. Accounts that do not exist (any production
    // environment, and any dev DB seeded without `--example` / `--test-users`)
    // are simply absent from the result and skipped.
    const rows = await ctx.db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.email, emails));

    const idByEmail = new Map(rows.map((row) => [row.email, row.id]));

    let matched = 0;
    let granted = 0;
    let revoked = 0;

    for (const target of FIXTURE_ROLE_TARGETS) {
        const userId = idByEmail.get(target.email);
        if (!userId) {
            continue;
        }
        matched++;
        const result = await syncFixtureRoles({ target, userId, tx: ctx.db, primitives });
        granted += result.granted;
        revoked += result.revoked;
    }

    return {
        summary:
            matched === 0
                ? `No HOS-296 dev fixture accounts present (0 of ${FIXTURE_ROLE_TARGETS.length}) — nothing to converge.`
                : `Converged role sets for ${matched} of ${FIXTURE_ROLE_TARGETS.length} dev fixture account(s): ${granted} hat(s) granted, ${revoked} revoked.`,
        counts: {
            fixturesDeclared: FIXTURE_ROLE_TARGETS.length,
            fixturesMatched: matched,
            rolesGranted: granted,
            rolesRevoked: revoked
        }
    };
}
