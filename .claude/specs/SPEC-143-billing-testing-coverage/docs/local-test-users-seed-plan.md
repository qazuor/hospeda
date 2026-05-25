# Local Test Users Seed — Design Spec

**Status**: Design (next session implements)
**Owner**: SPEC-143 Block 1 (entitlement/limit testing)
**Authored**: 2026-05-24

## Motivation

Block 1 smoke testing on staging burns 5-10min per iteration (commit + push + merge PR + redeploy via Coolify + re-validate). Most of what we're testing — entitlement gates, limit enforcement, route permission models, UI gates, form persistence — is server-side / client-side logic that has **zero dependency on the real MercadoPago integration**. The only flows that genuinely need staging are:

- MP checkout (start-paid, polling fallback, webhook signature verification) — these need real MP credentials + Cloudflare proxy.
- Cloudflare cache revalidation behavior.

For everything else, local dev (with seeded test users covering every role × plan combination) is the right surface. This doc specifies the seed.

## Goal

A single command — `pnpm seed:test-users` (or equivalent) — that creates the full matrix of test users needed for SPEC-143 Block 1, Block 2, Block 3, and Block 5 (the smoke blocks that DON'T need staging). Each user has:

1. A Better Auth credentials account (well-known email + password) so login works locally.
2. The correct role (USER, HOST, etc.) on the `users` table.
3. (For billing-relevant users) A `billing_customers` row linked to the user.
4. (For paid-tier users) A `billing_subscriptions` row with `status='active'` pointing to the correct plan, so the runtime `loadEntitlements` populates `userLimits` and `userEntitlements` correctly.

The seed must be **idempotent** — re-running it must not create duplicates and must NOT fail if the users already exist.

## User matrix (13 users)

### Naming convention

Email: `<slug>@local.test`. Password: `Password123!` for all (dev-only convenience).

### Staff users (no billing)

| Email | Role | Notes |
|-------|------|-------|
| `super-admin@local.test` | `SUPER_ADMIN` | Already seeded by `admin-user.json`-style fixture; reuse if exists |
| `admin@local.test` | `ADMIN` | Already seeded by `admin-user.json`; reuse |
| `editor@local.test` | `EDITOR` | New — content moderator |
| `sponsor@local.test` | `SPONSOR` | New — for sponsorship flows (separate billing tier) |

### Tourist users (USER role)

| Email | Plan | Status |
|-------|------|--------|
| `tourist-free@local.test` | `tourist-free` | No active sub (free tier — defaults via `buildDefaultEntitlementsResult`) |
| `tourist-plus@local.test` | `tourist-plus` | `billing_subscriptions.status='active'` |
| `tourist-vip@local.test` | `tourist-vip` | `billing_subscriptions.status='active'` |

### Owner users (HOST role)

| Email | Plan | Status | MAX_ACCOMMODATIONS | MAX_PHOTOS |
|-------|------|--------|--------------------|------------|
| `host-basico@local.test` | `owner-basico` | `active` | 1 | 5 |
| `host-pro@local.test` | `owner-pro` | `active` | 3 | 15 |
| `host-premium@local.test` | `owner-premium` | `active` | -1 (unlimited) | -1 (unlimited) |

### Complex users (CLIENT_MANAGER role)

| Email | Plan | Status |
|-------|------|--------|
| `complex-basico@local.test` | `complex-basico` | `active` |
| `complex-pro@local.test` | `complex-pro` | `active` |
| `complex-premium@local.test` | `complex-premium` | `active` |

## Implementation plan

### Step 1 — Investigation (next session)

Before coding, the next session must answer:

1. **Better Auth signup from a seed script**: can it be done programmatically? Two options:
   - **Option A**: hit `POST /api/auth/sign-up/email` against a running local API (requires `pnpm dev` first; couples seed to runtime).
   - **Option B**: import Better Auth's `auth.api.signUpEmail()` from `@repo/auth-ui/server` (or wherever the auth instance is exported) and call it directly inside the seed script. Cleaner; same code path as runtime signup.
   - **Option C**: manually create rows in `users` + `accounts` tables with a hashed password. Bypasses Better Auth's invariants; **not recommended** unless A and B both fail.

2. **qzpay-drizzle billing customer + subscription creation**: which API to use?
   - The `billing-customer-sync-service` middleware auto-creates `billing_customers` on user signup. Per engram `spec-143/finding-19`, this service has a known race condition (create → delete ~470ms) — verify it's been fixed before relying on the auto-creation, OR explicitly call `qzpay.customers.create()` inside the seed after signup completes.
   - For subscriptions: call `qzpay.subscriptions.create({ customerId, planId, status: 'active' })` directly. Plans are pre-seeded by the required seed (`billingPlans.seed.ts`).

3. **Role assignment**: Better Auth signup creates users with role=`USER` by default. After signup, the seed must `UPDATE users SET role = '<TARGET_ROLE>' WHERE email = ...`. Direct SQL is fine here (it's a dev-only seed).

### Step 2 — Implementation

Create `packages/seed/src/optional/testUsers.seed.ts`:

```ts
import { eq } from 'drizzle-orm';
import { getDb, users } from '@repo/db';
import { getAuth } from '<better-auth-instance-path>'; // resolve in step 1
import type { BillingPlanSlug } from '@repo/billing';
import { getQZPayBilling } from '<billing-init-path>'; // resolve in step 1

interface TestUserSpec {
    readonly email: string;
    readonly displayName: string;
    readonly role: 'USER' | 'HOST' | 'CLIENT_MANAGER' | 'EDITOR' | 'SPONSOR' | 'ADMIN' | 'SUPER_ADMIN';
    readonly planSlug?: BillingPlanSlug; // undefined for staff / free-tier USER
}

const TEST_USERS: readonly TestUserSpec[] = [
    // Staff
    { email: 'editor@local.test', displayName: 'Editor Local', role: 'EDITOR' },
    { email: 'sponsor@local.test', displayName: 'Sponsor Local', role: 'SPONSOR' },
    // Tourists
    { email: 'tourist-free@local.test', displayName: 'Turista Free', role: 'USER' /* no plan = free defaults */ },
    { email: 'tourist-plus@local.test', displayName: 'Turista Plus', role: 'USER', planSlug: 'tourist-plus' },
    { email: 'tourist-vip@local.test',  displayName: 'Turista VIP',  role: 'USER', planSlug: 'tourist-vip' },
    // Hosts
    { email: 'host-basico@local.test',  displayName: 'Host Basico',  role: 'HOST', planSlug: 'owner-basico' },
    { email: 'host-pro@local.test',     displayName: 'Host Pro',     role: 'HOST', planSlug: 'owner-pro' },
    { email: 'host-premium@local.test', displayName: 'Host Premium', role: 'HOST', planSlug: 'owner-premium' },
    // Complexes
    { email: 'complex-basico@local.test',  displayName: 'Complex Basico',  role: 'CLIENT_MANAGER', planSlug: 'complex-basico' },
    { email: 'complex-pro@local.test',     displayName: 'Complex Pro',     role: 'CLIENT_MANAGER', planSlug: 'complex-pro' },
    { email: 'complex-premium@local.test', displayName: 'Complex Premium', role: 'CLIENT_MANAGER', planSlug: 'complex-premium' },
];

const PW = 'Password123!';

export async function seedTestUsers(): Promise<void> {
    const db = getDb();
    const auth = getAuth();
    const billing = getQZPayBilling();

    for (const spec of TEST_USERS) {
        // 1. Idempotency check — skip if user already exists.
        const existing = await db.query.users.findFirst({ where: eq(users.email, spec.email) });
        if (existing) {
            console.log(`[test-users] Skipping ${spec.email} — already exists`);
            continue;
        }

        // 2. Create via Better Auth so credentials work for login.
        const signUpResult = await auth.api.signUpEmail({
            body: {
                email: spec.email,
                password: PW,
                name: spec.displayName,
            },
        });
        const userId = signUpResult.user.id;

        // 3. Promote role (Better Auth defaults to USER).
        if (spec.role !== 'USER') {
            await db.update(users).set({ role: spec.role }).where(eq(users.id, userId));
        }

        // 4. Mark email as verified (skip the verification flow for seeds).
        await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));

        // 5. Create billing customer + active subscription if plan is specified.
        if (spec.planSlug) {
            const customer = await billing.customers.create({
                email: spec.email,
                externalId: userId,
                metadata: { source: 'local-test-users-seed' },
            });
            const plan = await billing.plans.getBySlug(spec.planSlug);
            await billing.subscriptions.create({
                customerId: customer.id,
                planId: plan.id,
                status: 'active',
                // active immediately, no trial, no scheduled change
            });
        }

        console.log(`[test-users] ✓ ${spec.email} (${spec.role}${spec.planSlug ? ' + ' + spec.planSlug : ''})`);
    }
}
```

(Pseudo-code — exact API names to be resolved during implementation. Replace placeholder imports.)

### Step 3 — CLI wiring

Add to `packages/seed/src/cli.ts` a new flag `--test-users` so the command is `pnpm --filter @repo/seed seed --test-users`. Or add a dedicated script `pnpm --filter @repo/seed seed:test-users`. Either works; the dedicated script is more discoverable.

Add a root-level alias: `"db:seed:test-users": "pnpm --filter @repo/seed seed:test-users"` in the root `package.json`.

### Step 4 — Documentation

- Update `packages/seed/CLAUDE.md` with the test users matrix and the command.
- Update root `CLAUDE.md` ("Development Guidelines" or a new "Local testing" section) noting that for entitlement/limit work, prefer local + `pnpm db:seed:test-users` over staging redeploys.
- Update `.claude/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md` with a note that Block 1 sections 1.15-A/B/C/E, 2.x (mostly), and 3.x can be exercised locally with the test users seed. Block 4 (webhooks) and the MP checkout pieces still need staging.

### Step 5 — Validate

After implementing, validate by:

1. `pnpm db:fresh-dev` (full reset)
2. `pnpm db:seed:test-users` (create the 13 users)
3. `pnpm dev` (start all apps)
4. Open `http://localhost:4321/auth/signin/`, sign in as `host-basico@local.test` / `Password123!`
5. Visit `/mi-cuenta/`, then go through the publicar flow.
6. Re-run smoke section 1.15-A.1 locally: create accommodation #1 (201), create accommodation #2 (403 LIMIT_REACHED with `details.limitKey: max_accommodations`).
7. Confirm entitlement banners and limit gates behave as expected, etc.

## Open questions for the next session

1. Better Auth `signUpEmail` API path — confirm and import correctly.
2. qzpay-drizzle subscription creation: does it accept `status: 'active'` directly, or does it require a state-machine transition (e.g., insert as `incomplete`, then UPDATE to `active`)?
3. Should `billing_customers.email` match the user signup email, or use an MP-test-buyer pattern? For local testing we never call MP, so the user signup email is fine — but document the rationale to avoid confusion.
4. Where to put the seed in the run order: it should run AFTER `billingPlans.seed.ts` (plans must exist) but should NOT run as part of `--required` or `--example` defaults (it's an explicit, separate command).
5. Cleanup: should there be a `pnpm db:seed:test-users:reset` that deletes them? Or rely on `db:fresh-dev`? Document the answer.

## Out-of-scope for this seed

- Real MP checkout flows. Use staging.
- Webhook signature verification. Use staging.
- Cloudflare cache + revalidation. Use staging.
- Cron schedule + polling behavior in production-like timing. Local cron runs differently; staging is the truth.
- Multi-user concurrent operations (race conditions, lock testing). Local is single-process; use the integration test infra for those.
- Email delivery (verification, password reset). Local is a black hole; staging has Brevo.
