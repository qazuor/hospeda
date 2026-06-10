/**
 * Promo code validate + apply — SPEC-143 T-143-38.
 *
 * Validates the user-facing promo code endpoints end-to-end:
 *
 * ```
 * POST /api/v1/protected/billing/promo-codes/validate
 *   { code, customerId?, planId? }
 *   → qzpay-hono pre-built route (NOT hospeda custom — see PIN below)
 *     → billing.promoCodes.validate (qzpay-core)
 *   → 200 { success, data: { valid, promoCode, discountPercent? | discountAmount?, error? } }
 *
 * POST /api/v1/protected/billing/promo-codes/apply
 *   { code, customerId, amount? }
 *   → hospeda custom PromoCodeService.apply → applyPromoCode
 *     (race-safe, SELECT FOR UPDATE on billing_promo_codes)
 *     → tx: increment usedCount + INSERT billing_promo_code_usage
 *   → 200 { success, data: { id, promoCode, amount, discountAmount } }
 * ```
 *
 * IMPORTANT contracts pinned by this suite (with PIN tests where the
 * production behavior diverges from what the codebase appears to promise):
 *
 *   1. ROUTE SHADOWING (engram `bug/promo-validate-route-shadow`):
 *      Hospeda's custom `/promo-codes/validate` route in
 *      `apps/api/src/routes/billing/promo-codes.ts:299` is DEAD CODE.
 *      qzpay-hono's pre-built `/promo-codes/validate` (billing.routes.ts:522)
 *      is mounted FIRST in `apps/api/src/routes/billing/index.ts:183`
 *      and wins by Hono route precedence. As a result:
 *        - Response shape is qzpay-core (`{valid, promoCode, error?, discountPercent? | discountAmount?}`)
 *          NOT hospeda's documented shape (`{valid, errorCode?, errorMessage?, discountAmount?}`).
 *        - Validation checks are qzpay-core's subset only (active, validFrom/Until,
 *          maxRedemptions, applicablePlanIds, maxRedemptionsPerCustomer via subs).
 *          MISSING: minAmount, newCustomersOnly, hospeda's PROMO_CODE_* errorCode strings.
 *      Tests assert the qzpay-core shape because that is what production returns;
 *      a follow-up fix that addresses the shadow flips these to hospeda's shape.
 *
 *   2. APPLY is hospeda-only (no shadow). The /apply endpoint runs the
 *      hospeda custom service which (a) does a SELECT FOR UPDATE on the
 *      promo code row, (b) increments `usedCount`, (c) inserts a
 *      `billing_promo_code_usage` row — all in the SAME transaction.
 *
 *   3. APPLY consumes the redemption IMMEDIATELY. There is NO "reserve
 *      then commit on payment success" two-phase handshake. The task
 *      notes ("code applied then payment canceled → use-count not
 *      consumed") describe behavior that does NOT exist. Pinned as a gap.
 *
 *   4. APPLY skips most of validate's checks (planRestriction, minAmount,
 *      newCustomersOnly, maxUsesPerUser). A direct POST to /apply with a
 *      planRestriction-incompatible context succeeds and consumes the
 *      redemption. Pinned as a bug — additive to the shadowing issue.
 *
 *   5. Promo codes are seeded via raw SQL (no factory exists in
 *      `billing-factories.ts`). qzpay-drizzle's column names are
 *      `used_count` / `max_uses`; the mapper translates these to
 *      `currentRedemptions` / `maxRedemptions` in qzpay-core's DTO.
 *
 * @module test/e2e/flows/billing/promo-code
 */

import { vi } from 'vitest';

const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — promo-code.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { billingPromoCodeUsage, billingPromoCodes, eq, sql } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import { createTestBillingCustomer } from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

describe('SPEC-143 T-143-38 — promo code validate + apply', () => {
    let app: ReturnType<typeof initApp>;
    let client: E2EApiClient;
    let userId: string;
    let customerId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        const user = await createTestUser({
            email: `promo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
        });
        userId = user.id;
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        customerId = customer.customerId;

        // The actor must carry ACCESS_API_ADMIN to bypass the Hono sibling
        // middleware collision in /promo-codes. Five admin-tier routes
        // (list/create/get/update/delete) and two protected routes
        // (validate/apply) all register middleware via `app.use(*)` on the
        // SAME `promoCodesRouter` Hono instance. Hono applies wildcard
        // middleware from EVERY sibling, so the admin auth middleware leaks
        // onto /validate and /apply. Tests have two options:
        //   (a) admin-tier actor that satisfies all leaked middlewares; or
        //   (b) skip the route layer entirely and call the service.
        // We use (a) so we still exercise the route factory + zod + response.
        // The customer-self-redemption invariant (apply checks
        // body.customerId !== billingCustomerId unless admin) is intentionally
        // not exercised here because the route is unreachable to a plain
        // user. Documented engram: "Hono sibling middleware collision".
        const actor = createMockAdminActor({
            id: userId,
            permissions: [
                PermissionEnum.ACCESS_API_PUBLIC,
                PermissionEnum.ACCESS_API_PRIVATE,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.BILLING_PROMO_CODE_READ,
                PermissionEnum.BILLING_PROMO_CODE_MANAGE
            ]
        });
        client = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Insert a `billing_promo_codes` row. Defaults to a 10% percentage code
     * that is active and unrestricted. Column names use the
     * qzpay-drizzle vocabulary (`used_count`, `max_uses`, `valid_plans`).
     */
    async function seedPromoCode(
        overrides: {
            readonly code?: string;
            readonly type?: 'percentage' | 'fixed';
            readonly value?: number;
            readonly maxUses?: number | null;
            readonly usedCount?: number;
            readonly validPlans?: readonly string[] | null;
            readonly active?: boolean;
            readonly expiresAtSecondsFromNow?: number | null;
        } = {}
    ): Promise<{ id: string; code: string }> {
        const id = randomUUID();
        const code = overrides.code ?? `TEST${Date.now().toString(36).toUpperCase()}`;
        const type = overrides.type ?? 'percentage';
        const value = overrides.value ?? 10;
        const maxUses = overrides.maxUses ?? null;
        const usedCount = overrides.usedCount ?? 0;
        const validPlans = overrides.validPlans ?? null;
        const active = overrides.active ?? true;
        const expiresAt =
            overrides.expiresAtSecondsFromNow !== undefined &&
            overrides.expiresAtSecondsFromNow !== null
                ? new Date(Date.now() + overrides.expiresAtSecondsFromNow * 1000)
                : null;

        // Build a Postgres text[] literal manually. Drizzle's sql`` template
        // does NOT auto-convert JS arrays to Postgres array params — pg
        // throws "Array value must start with {" otherwise. Quote each
        // element and join with commas inside braces.
        const validPlansLiteral =
            validPlans === null
                ? null
                : `{${validPlans.map((p) => `"${p.replace(/"/g, '\\"')}"`).join(',')}}`;

        await testDb.getDb().execute(sql`
            INSERT INTO billing_promo_codes (
                id, code, type, value,
                config, max_uses, used_count,
                valid_plans, active, expires_at, livemode
            ) VALUES (
                ${id}, ${code}, ${type}, ${value},
                ${'{}'}::jsonb, ${maxUses}, ${usedCount},
                ${validPlansLiteral}::text[], ${active}, ${expiresAt}, false
            )
        `);

        return { id, code };
    }

    /** Read the current usedCount + usage row count for a promo code. */
    async function fetchPromoState(
        promoId: string
    ): Promise<{ usedCount: number; usageRows: number }> {
        const [row] = await testDb
            .getDb()
            .select({ usedCount: billingPromoCodes.usedCount })
            .from(billingPromoCodes)
            .where(eq(billingPromoCodes.id, promoId));
        const usageRows = await testDb
            .getDb()
            .select()
            .from(billingPromoCodeUsage)
            .where(eq(billingPromoCodeUsage.promoCodeId, promoId));
        return { usedCount: row?.usedCount ?? 0, usageRows: usageRows.length };
    }

    // ─── Tests ────────────────────────────────────────────────────────────────

    it('validate (PROD: qzpay-hono pre-built wins) returns valid:true with the qzpay-core shape — discountPercent for percentage codes', async () => {
        // ARRANGE — 20% off code.
        const { code } = await seedPromoCode({ type: 'percentage', value: 20 });

        // ACT
        const response = await client.post('/api/v1/protected/billing/promo-codes/validate', {
            code,
            userId
        });

        // ASSERT — 200 envelope (the qzpay-hono route returns 200 via
        // c.json({success, data})). Hospeda's createResponse path is bypassed
        // entirely because that custom route never matches.
        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: {
                readonly valid: boolean;
                readonly promoCode: Record<string, unknown> | null;
                readonly discountPercent?: number;
                readonly discountAmount?: number;
                readonly error?: string;
            };
        };
        expect(body.success).toBe(true);
        expect(body.data.valid).toBe(true);
        // qzpay-core returns the full promoCode object on every result
        // (success + failures alike). Pin the presence so a refactor that
        // drops it surfaces here.
        expect(body.data.promoCode).not.toBeNull();
        // Percentage code → discountPercent (NOT discountAmount). The hospeda
        // custom route, if it ran, would compute a `discountAmount` from
        // amount * pct / 100. The qzpay route does NOT take `amount` and
        // therefore cannot compute the discountAmount preview.
        expect(body.data.discountPercent).toBe(20);
        expect(body.data.discountAmount).toBeUndefined();
    });

    it('validate (PROD) returns valid:false with shape { promoCode: null, error } when the code does not exist', async () => {
        // ACT
        const response = await client.post('/api/v1/protected/billing/promo-codes/validate', {
            code: `MISSING_${Date.now()}`,
            userId
        });

        // ASSERT — qzpay-core shape on not_found: promoCode is null, error
        // is a plain string. Hospeda would have surfaced errorCode='PROMO_CODE_NOT_FOUND'
        // — pin the qzpay shape here.
        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: {
                readonly valid: boolean;
                readonly promoCode: Record<string, unknown> | null;
                readonly error?: string;
            };
        };
        expect(body.success).toBe(true);
        expect(body.data.valid).toBe(false);
        expect(body.data.promoCode).toBeNull();
        expect(body.data.error).toContain('not found');
    });

    it('validate (PROD) returns valid:false for an inactive code with promoCode populated and qzpay-core error message', async () => {
        const { code } = await seedPromoCode({ active: false });

        const response = await client.post('/api/v1/protected/billing/promo-codes/validate', {
            code,
            userId
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: {
                readonly valid: boolean;
                readonly promoCode: Record<string, unknown> | null;
                readonly error?: string;
            };
        };
        expect(body.data.valid).toBe(false);
        // qzpay-core retorna el promoCode (no null) cuando existe el row pero
        // está inactivo, junto con error string. Pin del shape.
        expect(body.data.promoCode).not.toBeNull();
        expect(body.data.error).toContain('not active');
    });

    it('apply consumes the redemption: usedCount++ and a billing_promo_code_usage row lands inside the SELECT-FOR-UPDATE transaction', async () => {
        // ARRANGE — fixed-off code: 1_500 centavos off, applied to a 5_000
        // centavos amount → finalAmount=3_500.
        const { id: promoId, code } = await seedPromoCode({ type: 'fixed', value: 1500 });

        const pre = await fetchPromoState(promoId);
        expect(pre.usedCount).toBe(0);
        expect(pre.usageRows).toBe(0);

        // ACT — apply is hospeda's custom route (not shadowed); the
        // response carries hospeda's shape `{id, promoCode, amount, discountAmount}`.
        const response = await client.post('/api/v1/protected/billing/promo-codes/apply', {
            code,
            customerId,
            amount: 5000
        });

        // Apply uses hospeda's createProtectedRoute → POST default 201.
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: {
                readonly promoCode: string;
                readonly amount: number;
                readonly discountAmount: number;
            };
        };
        expect(body.success).toBe(true);
        expect(body.data.promoCode).toBe(code);
        expect(body.data.discountAmount).toBe(1500);
        expect(body.data.amount).toBe(3500);

        // ASSERT — DB state: usedCount incremented + usage row inserted
        // atomically by the redemption transaction.
        const post = await fetchPromoState(promoId);
        expect(post.usedCount).toBe(1);
        expect(post.usageRows).toBe(1);
    });

    it('PINS BUG (route shadowing): a lowercase request still resolves via qzpay-core, which does its own findByCode normalization', async () => {
        // ARRANGE — stable uppercase code so we can flip the request casing.
        const upperCaseCode = `SAVE${Date.now().toString(36).toUpperCase()}`;
        await seedPromoCode({ code: upperCaseCode, type: 'percentage', value: 15 });

        // ACT — request the SAME code but lowercase.
        const lowerCaseCode = upperCaseCode.toLowerCase();
        expect(lowerCaseCode).not.toBe(upperCaseCode);
        const response = await client.post('/api/v1/protected/billing/promo-codes/validate', {
            code: lowerCaseCode,
            userId
        });

        // ASSERT — qzpay-core's findByCode normalizes the code internally
        // (storage layer uses ILIKE or case-folded lookup). The lookup
        // succeeds and the code is treated as valid. If a future refactor
        // drops the normalization, this assertion flips to valid:false.
        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: { readonly valid: boolean; readonly discountPercent?: number };
        };
        expect(body.success).toBe(true);
        expect(body.data.valid).toBe(true);
        expect(body.data.discountPercent).toBe(15);
    });

    it('PINS BUG: apply silently bypasses planRestriction even though qzpay-core validate would reject it — applies & consumes the redemption', async () => {
        // BUG PIN — even with the route shadowing on validate, apply remains
        // hospeda's custom code and DOES NOT re-check `valid_plans`. A
        // user posting directly to /apply skips both validate guards
        // entirely and gets the discount. Engram topic:
        // `bug/promo-validate-route-shadow` (validate) +
        // additive: applyPromoCode (promo-code.redemption.ts:572-633)
        // only re-checks active, expired, and maxUses inside the FOR UPDATE
        // lock — see file-level note 4.
        const allowedPlan = 'plan-allowed';
        const { id: promoId, code } = await seedPromoCode({
            type: 'percentage',
            value: 25,
            validPlans: [allowedPlan]
        });

        // Apply, no planId param at all (the endpoint does not even accept it).
        // Returns 200 + consumes the redemption.
        const applyResponse = await client.post('/api/v1/protected/billing/promo-codes/apply', {
            code,
            customerId,
            amount: 4000
        });
        expect(applyResponse.status).toBe(201);
        const applyBody = (await applyResponse.json()) as {
            readonly data: { readonly discountAmount: number };
        };
        expect(applyBody.data.discountAmount).toBe(1000); // 25% of 4_000

        // ASSERT (BUG PIN) — the redemption was consumed despite the
        // planRestriction mismatch. When apply is hardened to re-check
        // validPlans, flip `usedCount` to 0.
        const post = await fetchPromoState(promoId);
        expect(post.usedCount).toBe(1);
    });

    it('PINS GAP: apply consumes the redemption immediately — there is no "reserve then commit on payment success" two-phase flow', async () => {
        // GAP PIN: the task notes describe "code applied then payment
        // canceled (code use-count not consumed)" which does NOT exist.
        // applyPromoCode runs a single transaction that locks + increments
        // + inserts the usage row and commits. There is NO downstream
        // signal from the payment flow to reverse on failure/cancel.
        //
        // Consequence: a user whose payment is rejected has already
        // consumed the code against maxUses + their per-user limit. A
        // retry may be rejected as MAX_USES even though the original
        // charge never settled.
        const { id: promoId, code } = await seedPromoCode({
            type: 'fixed',
            value: 500,
            maxUses: 2
        });

        const response = await client.post('/api/v1/protected/billing/promo-codes/apply', {
            code,
            customerId,
            amount: 3000
        });
        expect(response.status).toBe(201);

        // ASSERT (GAP PIN) — usedCount is ALREADY at 1 and the usage row
        // is ALREADY inserted; a hypothetical "payment failed" signal would
        // have nothing to roll back. When the fix introduces a reserve/
        // commit two-phase pattern, flip both numbers to 0 and add a new
        // assertion for the commit path.
        const post = await fetchPromoState(promoId);
        expect(post.usedCount).toBe(1);
        expect(post.usageRows).toBe(1);
    });
});
