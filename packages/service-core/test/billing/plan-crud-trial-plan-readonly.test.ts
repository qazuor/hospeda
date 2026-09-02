/**
 * HOS-1012 T-038 — a composed trial plan is not editable through the admin API.
 *
 * ## The decision, and why it is not a list filter
 *
 * Two options were on the table. **Hiding the trial plans from the admin plan
 * list** is the cheap one and it leaves the endpoint open: the id is still
 * guessable, still returned by `GET /admin/billing/plans/{id}`, and still
 * accepted by any caller that does not go through the UI — a script, a curl, a
 * future admin screen written by someone who never read this. **Refusing the
 * write** closes it for every caller of `PlanService.update`, present and
 * future, which is why that is what shipped.
 *
 * Refusing costs the operator nothing they should have been able to do. A trial
 * plan's stored entitlements and limits are a SNAPSHOT of `owner-pro` and
 * `owner-basico`, kept only so admin screens show something sensible instead of
 * an empty plan (which would read as *unlimited*). Editing it would not change
 * what the trial grants — gating resolves the composition live on every request
 * — it would only make the screen lie. The real values live on the source
 * plans, which stay fully editable and are reflected the instant they change.
 *
 * The plans stay LISTED and readable on purpose: an operator should be able to
 * see that they exist and what they currently show.
 */
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetDb, mockWithTransaction } = vi.hoisted(() => ({
    mockGetDb: vi.fn(),
    mockWithTransaction: vi.fn()
}));

const { mockInsertPlanAuditLog, mockDiffPlanFields } = vi.hoisted(() => ({
    mockInsertPlanAuditLog: vi.fn().mockResolvedValue(undefined),
    mockDiffPlanFields: vi.fn().mockReturnValue({ added: {}, removed: {}, changed: {} })
}));

vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    withTransaction: mockWithTransaction,
    billingPlans: {
        id: 'id',
        name: 'name',
        description: 'description',
        active: 'active',
        deletedAt: 'deletedAt',
        entitlements: 'entitlements',
        limits: 'limits',
        livemode: 'livemode',
        metadata: 'metadata'
    },
    billingPrices: {
        id: 'id',
        planId: 'planId',
        billingInterval: 'billingInterval',
        unitAmount: 'unitAmount',
        active: 'active'
    },
    billingSubscriptions: {
        planId: 'planId',
        status: 'status',
        mpSubscriptionId: 'mpSubscriptionId',
        deletedAt: 'deletedAt'
    },
    billingPlanPriceChanges: {
        id: 'id',
        planId: 'planId',
        priceId: 'priceId',
        billingInterval: 'billingInterval',
        oldAmount: 'oldAmount',
        newAmount: 'newAmount',
        direction: 'direction',
        status: 'status',
        effectiveAt: 'effectiveAt',
        actorId: 'actorId',
        metadata: 'metadata',
        updatedAt: 'updatedAt'
    },
    billingAuditLogs: { id: 'id' },
    and: vi.fn((...args: unknown[]) => ({ _and: args })),
    asc: vi.fn((col: unknown) => ({ _asc: col })),
    eq: vi.fn((col: unknown, val: unknown) => ({ _eq: { col, val } })),
    isNull: vi.fn((col: unknown) => ({ _isNull: col })),
    isNotNull: vi.fn((col: unknown) => ({ _isNotNull: col })),
    inArray: vi.fn((col: unknown, vals: unknown) => ({ _inArray: { col, vals } })),
    count: vi.fn(() => ({ _count: true })),
    sql: Object.assign(
        vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
            _sql: { strings, values }
        })),
        { join: vi.fn(() => ({ _sqlJoin: true })) }
    )
}));

vi.mock('../../src/services/billing/plan/plan.audit.js', () => ({
    insertPlanAuditLog: mockInsertPlanAuditLog,
    diffPlanFields: mockDiffPlanFields
}));

import { updatePlan } from '../../src/services/billing/plan/plan.crud.js';

/** Awaitable Drizzle-query-builder double, resolving to `resolvesTo`. */
function makeChain(resolvesTo: unknown = []) {
    const chain: Record<string, unknown> = {};
    const resolved = Promise.resolve(resolvesTo);

    chain.returning = vi.fn().mockResolvedValue(resolvesTo);
    chain.offset = vi.fn().mockResolvedValue(resolvesTo);
    chain.execute = vi.fn().mockResolvedValue(resolvesTo);

    for (const m of [
        'select',
        'from',
        'where',
        'orderBy',
        'limit',
        'groupBy',
        'insert',
        'values',
        'update',
        'set',
        'delete',
        'for'
    ]) {
        chain[m] = vi.fn().mockReturnValue(chain);
    }

    Object.assign(chain, resolved);
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock of Drizzle's awaitable query builder
    (chain as { then: unknown }).then = resolved.then.bind(resolved);
    (chain as { catch: unknown }).catch = resolved.catch.bind(resolved);
    return chain;
}

/** Sequenced db double: each successive select/update takes the next result. */
function buildMockDb(selectResults: unknown[] = [], updateResults: unknown[] = []) {
    let selectIdx = 0;
    let updateIdx = 0;
    const updatePayloads: unknown[] = [];

    const db = {
        select: vi.fn().mockImplementation(() => makeChain(selectResults[selectIdx++] ?? [])),
        insert: vi.fn().mockImplementation(() => makeChain([{ id: 'mock-generated-id' }])),
        update: vi.fn().mockImplementation(() => {
            const result = updateResults[updateIdx++] ?? [];
            const chain = makeChain(result);
            const originalSet = chain.set as ReturnType<typeof vi.fn>;
            chain.set = vi.fn().mockImplementation((payload: unknown) => {
                updatePayloads.push(payload);
                return originalSet(payload);
            });
            return chain;
        }),
        delete: vi.fn().mockImplementation(() => makeChain([]))
    };

    return { db, updatePayloads };
}

/** Minimal `billing_plans` row; `metadata` is what this suite varies. */
function planRow(metadata: Record<string, unknown>): Record<string, unknown> {
    return {
        id: 'plan-uuid-1',
        name: 'owner-trial',
        description: 'Prueba gratuita',
        active: false,
        deletedAt: null,
        livemode: false,
        metadata,
        entitlements: ['publish_accommodations', 'featured_listing'],
        limits: { max_accommodations: 1 },
        displayName: 'Prueba gratuita',
        monthlyPriceArs: 0,
        annualPriceArs: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z')
    };
}

const TRIAL_METADATA = {
    slug: 'owner-trial',
    displayName: 'Prueba gratuita',
    category: 'owner',
    trialComposition: { entitlementsFrom: 'owner-pro', limitsFrom: 'owner-basico' }
};

const ORDINARY_METADATA = {
    slug: 'owner-basico',
    displayName: 'Básico',
    category: 'owner'
};

describe('updatePlan() — composed trial plans are read-only (HOS-1012 T-038)', () => {
    let harness: ReturnType<typeof buildMockDb>;

    /** Arranges a plan row carrying `metadata`, plus the price rows the happy path reads. */
    function arrange(metadata: Record<string, unknown>) {
        const row = planRow(metadata);
        harness = buildMockDb(
            [
                [row], // getPlanByIdInternal
                [], // monthly price lookup (no price rows on a trial plan)
                [], // annual price lookup
                [] // final price fetch
            ],
            [[row]] // update … returning
        );
        mockWithTransaction.mockImplementation(async (fn: (db: unknown) => Promise<unknown>) =>
            fn(harness.db)
        );
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('REFUSES an entitlements edit on a trial plan', async () => {
        arrange(TRIAL_METADATA);

        const result = await updatePlan('plan-uuid-1', {
            entitlements: ['publish_accommodations', 'custom_branding']
        });

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error.message).toContain('composed trial plan');
        // And it is a REFUSAL, not a no-op that still wrote something.
        expect(harness.db.update).not.toHaveBeenCalled();
        expect(mockInsertPlanAuditLog).not.toHaveBeenCalled();
    });

    it('REFUSES a limits edit on a trial plan', async () => {
        arrange(TRIAL_METADATA);

        const result = await updatePlan('plan-uuid-1', { limits: { max_accommodations: 10 } });

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(harness.db.update).not.toHaveBeenCalled();
    });

    it('REFUSES even an innocuous edit — the refusal is the plan, not the field', async () => {
        // A description edit cannot desynchronise anything, and is still
        // refused: an allowlist of "safe" fields is one review away from
        // acquiring an unsafe one.
        arrange(TRIAL_METADATA);

        const result = await updatePlan('plan-uuid-1', { description: 'Cambio inocuo' });

        expect(result.success).toBe(false);
        expect(harness.db.update).not.toHaveBeenCalled();
    });

    it('is keyed on the COMPOSITION, not on a slug list', async () => {
        // A fourth vertical's trial plan, named nothing this file knows about,
        // is refused for free. A slug allowlist would need remembering.
        arrange({ ...TRIAL_METADATA, slug: 'lodging-trial' });

        const result = await updatePlan('plan-uuid-1', { description: 'x' });

        expect(result.success).toBe(false);
    });

    it('ignores a MALFORMED composition — a half-written key does not lock a plan', async () => {
        // Symmetric with the gating path, which treats a malformed composition
        // as "not a trial plan". A stray metadata key must not be able to make
        // an ordinary plan permanently uneditable.
        arrange({ ...ORDINARY_METADATA, trialComposition: { entitlementsFrom: 'owner-pro' } });

        const result = await updatePlan('plan-uuid-1', { description: 'Editable' });

        expect(result.success).toBe(true);
        expect(harness.db.update).toHaveBeenCalled();
    });

    it('leaves ORDINARY plans fully editable — the source plans stay operator-owned', async () => {
        // This is the half that makes the refusal acceptable: `owner-pro` and
        // `owner-basico` ARE the trial's real values, and they stay editable.
        arrange(ORDINARY_METADATA);

        const result = await updatePlan('plan-uuid-1', {
            entitlements: ['publish_accommodations', 'featured_listing']
        });

        expect(result.success).toBe(true);
        expect(harness.db.update).toHaveBeenCalled();
    });
});
