/**
 * HOS-2328 (spec HOS-2335 §6.3) — `get_my_plan`: the owner's plan per vertical.
 *
 * Real: the tool, the executor, `readMyPlan`, the labels (`@repo/i18n`), the
 * portal links and the effective-set resolver (`readEffectiveSet` over an
 * in-test catalog, see the harness). Mocked at their module boundary (their
 * own suites and routes cover the queries): the plan-state, trial and add-on
 * readers.
 *
 * @module test/mcp/tools/plan/get-my-plan
 */

import { ServiceErrorCode } from '@repo/schemas';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ACCOMMODATION_VERSION,
    arrangeSubscriptionAndTrial,
    catalog,
    context,
    courtesySource,
    extraSources,
    grantSource,
    mocks,
    NOW,
    ownerActor,
    resetWorld,
    SITE,
    subscriptionRow,
    VENUE_TRIAL_VERSION
} from './my-plan.harness';

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    readOwnPlanState: (...args: unknown[]) => mocks.readOwnPlanState(...args)
}));
vi.mock('../../../../src/services/billing-addon/owner-recurring-addons.service', () => ({
    readOwnerAddonHoldings: (...args: unknown[]) => mocks.readOwnerAddonHoldings(...args)
}));
vi.mock('../../../../src/services/listing-notices/listing-notices.service', () => ({
    readTrialSummary: (...args: unknown[]) => mocks.readTrialSummary(...args),
    readOwnTrialPlan: (...args: unknown[]) => mocks.readOwnTrialPlan(...args)
}));
vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: (...args: unknown[]) => mocks.effectiveSet(...args),
        billing: { coverage: (...args: unknown[]) => mocks.coverage(...args) }
    })
}));
vi.mock('../../../../src/services/plan-catalog/plan-of-version.service', () => ({
    readPlanOfVersion: (...args: unknown[]) => mocks.readPlanOfVersion(...args)
}));

import { buildToolInputJsonSchema } from '../../../../src/lib/mcp/bind-tool';
import { getMyPlanTool } from '../../../../src/mcp/tools/plan/get-my-plan';
import type { MyPlanResult } from '../../../../src/mcp/tools/plan/my-plan-types';
import { MCP_TOOL_DEFINITIONS } from '../../../../src/mcp/tools/registry';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import { injectClock } from '../../../../src/utils/clock';
import { validateApiEnv } from '../../../../src/utils/env';
import { apiLogger } from '../../../../src/utils/logger';

/** Runs the tool and returns its data, failing the test on a refusal. */
async function myPlan(input: Record<string, unknown> = {}): Promise<MyPlanResult> {
    const outcome = await runTool({
        definition: getMyPlanTool,
        actor: ownerActor(),
        input,
        context
    });
    if (!outcome.ok) {
        throw new Error(`get_my_plan refused: ${outcome.failure.message}`);
    }
    return outcome.data as MyPlanResult;
}

describe('get_my_plan', () => {
    beforeAll(() => {
        validateApiEnv();
        injectClock({ clock: { now: () => NOW } });
    });

    beforeEach(() => {
        resetWorld();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('is a registered read-only READ_OWN tool with one flat input object', () => {
        // Act
        const schema = buildToolInputJsonSchema({ definition: getMyPlanTool });

        // Assert
        expect(MCP_TOOL_DEFINITIONS.map((tool) => tool.name)).toContain('get_my_plan');
        expect(getMyPlanTool.isWrite).toBe(false);
        expect(getMyPlanTool.emailUnverifiedOperation).toBe('READ_OWN');
        expect(schema.type).toBe('object');
        expect(schema).not.toHaveProperty('anyOf');
        expect(getMyPlanTool.inputSchema.safeParse({ vertical: 'boats' }).success).toBe(false);
        expect(getMyPlanTool.inputSchema.safeParse({ id: 'x' }).success).toBe(false);
    });

    it('refuses without BILLING_VIEW_OWN and reads nothing', async () => {
        // Act
        const outcome = await runTool({
            definition: getMyPlanTool,
            actor: ownerActor({ billing: false }),
            input: {},
            context
        });

        // Assert
        expect(outcome.ok).toBe(false);
        expect(outcome.ok ? undefined : outcome.failure.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(mocks.readOwnPlanState).not.toHaveBeenCalled();
        expect(mocks.readTrialSummary).not.toHaveBeenCalled();
    });

    it('AC-C13: returns the accommodation subscription and the venue trial with status, dates, trial days and catalog includes', async () => {
        // Arrange
        arrangeSubscriptionAndTrial();

        // Act
        const result = await myPlan();

        // Assert
        expect(result.plans).toBeUndefined();
        expect(result.items.map((item) => item.vertical)).toEqual(['accommodation', 'venue']);
        const [accommodation, venue] = result.items;
        expect(accommodation).toEqual({
            vertical: 'accommodation',
            verticalLabel: 'Alojamiento',
            plan: { slug: 'owner-basico', name: 'Básico', version: ACCOMMODATION_VERSION },
            status: 'ACTIVE',
            trialState: null,
            statusLabel: 'Activa',
            nextChargeAt: '2026-12-01T10:00:00.000Z',
            serviceEndsAt: null,
            graceEndsAt: null,
            trialDaysLeft: null,
            coverageEndsAt: null,
            includes: {
                // In catalog key order (`CATALOG_KEY_DEFINITIONS`).
                entitlements: ['Responder reseñas', 'Estadísticas básicas'],
                limits: [{ label: 'Fotos por alojamiento', value: 15 }]
            },
            addons: [],
            actionUrl: `${SITE}/es/mi-cuenta/suscripcion/`
        });
        expect(venue).toMatchObject({
            vertical: 'venue',
            verticalLabel: 'Comer y salir',
            plan: { slug: 'venue-basico', name: 'Básico', version: VENUE_TRIAL_VERSION },
            status: 'TRIAL',
            trialState: 'TRIAL_ACTIVE',
            statusLabel: 'En prueba',
            nextChargeAt: null,
            trialDaysLeft: 7,
            coverageEndsAt: null,
            includes: {
                entitlements: ['Carta con secciones, platos y enlace a tu carta'],
                limits: []
            }
        });
        expect(JSON.stringify(result)).not.toContain('view_basic_stats');
    });

    it('AC-C14: editing the catalog rows of the plan version changes includes with no code change', async () => {
        // Arrange
        arrangeSubscriptionAndTrial();
        const before = await myPlan({ vertical: 'accommodation' });

        // Act: the catalog drops one entitlement row and adds a limit row
        catalog.set(ACCOMMODATION_VERSION, {
            entitlements: [{ key: 'view_basic_stats', planQuota: null }],
            limits: [
                { key: 'max_photos_per_accommodation', value: 30 },
                { key: 'max_accommodations', value: 2 }
            ]
        });
        const after = await myPlan({ vertical: 'accommodation' });

        // Assert
        expect(before.items[0]?.includes?.entitlements).toContain('Responder reseñas');
        expect(after.items[0]?.includes).toEqual({
            entitlements: ['Estadísticas básicas'],
            limits: [
                { label: 'Alojamientos publicados', value: 2 },
                { label: 'Fotos por alojamiento', value: 30 }
            ]
        });
    });

    it('AC-C15: an owner with no title gets an empty list and the plans pages, not an error', async () => {
        // Act
        const result = await myPlan();
        const one = await myPlan({ vertical: 'venue' });

        // Assert
        expect(result).toEqual({
            items: [],
            plans: [
                { vertical: 'accommodation', url: `${SITE}/es/planes/anfitriones/` },
                { vertical: 'venue', url: `${SITE}/es/planes/comer-y-salir/` },
                { vertical: 'experience', url: `${SITE}/es/planes/experiencias/` }
            ]
        });
        expect(one).toEqual({
            items: [],
            plans: [{ vertical: 'venue', url: `${SITE}/es/planes/comer-y-salir/` }]
        });
    });

    it('AC-P2: a recurring add-on with no end date renews with the subscription, with no invented date', async () => {
        // Arrange
        arrangeSubscriptionAndTrial();
        mocks.readOwnerAddonHoldings.mockResolvedValue([
            {
                slug: 'extra-photos-20',
                name: 'Catalog photos pack',
                status: 'ACTIVE',
                endsAt: null,
                verticals: ['accommodation']
            },
            {
                slug: 'visibility-boost-7d',
                name: 'Catalog boost',
                status: 'ACTIVE',
                endsAt: new Date('2026-11-25T00:00:00.000Z'),
                verticals: ['accommodation']
            }
        ]);

        // Act
        const result = await myPlan();
        const [accommodation, venue] = result.items;

        // Assert
        expect(accommodation?.addons).toEqual([
            {
                name: 'Pack de fotos extra (+20 fotos)',
                status: 'ACTIVE',
                endsAt: null,
                renewsWithSubscription: true
            },
            {
                name: 'Impulso de visibilidad (7 días)',
                status: 'ACTIVE',
                endsAt: '2026-11-25T00:00:00.000Z',
                renewsWithSubscription: false
            }
        ]);
        expect(accommodation?.addonsUrl).toBe(`${SITE}/es/mi-cuenta/complementos/`);
        expect(venue?.addons).toEqual([]);
        expect(venue).not.toHaveProperty('addonsUrl');
    });

    it('AC-P2: an add-on whose checkout is still open does not renew with the subscription', async () => {
        // Arrange
        arrangeSubscriptionAndTrial();
        mocks.readOwnerAddonHoldings.mockResolvedValue([
            {
                slug: 'extra-photos-20',
                name: 'Catalog photos pack',
                status: 'PENDING_AUTHORIZATION',
                endsAt: null,
                verticals: ['accommodation']
            }
        ]);

        // Act
        const [accommodation] = (await myPlan({ vertical: 'accommodation' })).items;

        // Assert
        expect(accommodation?.addons).toEqual([
            {
                name: 'Pack de fotos extra (+20 fotos)',
                status: 'PENDING_AUTHORIZATION',
                endsAt: null,
                renewsWithSubscription: false
            }
        ]);
    });

    it('M1: a charged add-on whose listing is gone is shown flagged, unattributed when no vertical fits', async () => {
        // Arrange
        arrangeSubscriptionAndTrial();
        mocks.readOwnerAddonHoldings.mockResolvedValue([
            {
                slug: 'extra-photos-20',
                name: 'Catalog photos pack',
                status: 'ACTIVE',
                endsAt: null,
                verticals: [],
                listingGone: true
            },
            {
                slug: 'extra-photos-20',
                name: 'Catalog photos pack',
                status: 'ACTIVE',
                endsAt: null,
                verticals: ['accommodation'],
                listingGone: true
            }
        ]);

        // Act
        const result = await myPlan();

        // Assert
        const flagged = {
            name: 'Pack de fotos extra (+20 fotos)',
            status: 'ACTIVE',
            endsAt: null,
            renewsWithSubscription: true,
            listingGone: true
        };
        expect(result.items[0]?.addons).toEqual([flagged]);
        expect(result.items[1]?.addons).toEqual([]);
        expect(result.unattributedAddons).toEqual([flagged]);
        expect(result.addonsUrl).toBe(`${SITE}/es/mi-cuenta/complementos/`);
    });

    it('a TRIAL_ACTIVE trial whose clock already ended is not a running trial', async () => {
        // Arrange
        arrangeSubscriptionAndTrial();
        mocks.readTrialSummary.mockResolvedValue({
            status: 'TRIAL_ACTIVE',
            startedAt: '2026-11-01T12:00:00.000Z',
            endsAt: '2026-11-15T12:00:00.000Z',
            totalDays: 14,
            origins: { base: 14, promo: 0, support: 0 }
        });

        // Act
        const result = await myPlan({ vertical: 'venue' });

        // Assert
        expect(result.items).toEqual([]);
    });

    it('labels in the user locale (en)', async () => {
        // Arrange
        arrangeSubscriptionAndTrial();

        // Act
        const outcome = await runTool({
            definition: getMyPlanTool,
            actor: ownerActor(),
            input: { vertical: 'accommodation' },
            context: { ...context, locale: 'en' }
        });

        // Assert
        const item = outcome.ok ? (outcome.data as MyPlanResult).items[0] : undefined;
        expect(item).toMatchObject({
            verticalLabel: 'Accommodation',
            statusLabel: 'Active',
            plan: { name: 'Basic' }
        });
        expect(item?.includes?.entitlements).toContain('Basic statistics');
    });

    describe('AC-C16: a courtesy or a permanent grant counts as a plan', () => {
        const GRANT_VERSION = '55555555-5555-4555-8555-555555555555';
        const COURTESY_END = new Date('2027-02-01T00:00:00.000Z');

        function arrangeVersion(version: string, slug: string, name: string): void {
            catalog.set(version, {
                entitlements: [{ key: 'view_basic_stats', planQuota: null }],
                limits: [{ key: 'max_photos_per_accommodation', value: 30 }]
            });
            mocks.readPlanOfVersion.mockImplementation(
                async ({ planVersionId }: { planVersionId: string }) =>
                    planVersionId === version ? { slug, name } : null
            );
        }

        it('a permanent grant only: the anchored plan, «Acceso permanente», no end date', async () => {
            // Arrange
            arrangeVersion(GRANT_VERSION, 'owner-pro', 'Catalog pro');
            extraSources.set('accommodation', [grantSource(GRANT_VERSION)]);

            // Act
            const result = await myPlan({ vertical: 'accommodation' });

            // Assert
            expect(result.items).toHaveLength(1);
            expect(result.items[0]).toMatchObject({
                vertical: 'accommodation',
                plan: { slug: 'owner-pro', name: 'Profesional', version: GRANT_VERSION },
                status: 'PERMANENT_GRANT',
                statusLabel: 'Acceso permanente',
                coverageEndsAt: null,
                nextChargeAt: null,
                trialState: null
            });
            expect(result.items[0]?.includes?.limits).toEqual([
                { label: 'Fotos por alojamiento', value: 30 }
            ]);
            expect(result).not.toHaveProperty('plans');
        });

        it('a courtesy only: the paused plan, «Cortesía», ending when the courtesy ends', async () => {
            // Arrange: a courtesy pauses the principal; billing reports a COURTESY source
            arrangeVersion(ACCOMMODATION_VERSION, 'owner-basico', 'Catalog basic');
            mocks.readOwnPlanState.mockResolvedValue({
                subscriptions: [
                    subscriptionRow({
                        status: 'PAUSED',
                        nextCharge: null,
                        pause: { reason: 'COURTESY', expectedEndAt: COURTESY_END }
                    })
                ],
                deferredCourtesies: []
            });
            extraSources.set('accommodation', [
                courtesySource(ACCOMMODATION_VERSION, COURTESY_END)
            ]);

            // Act
            const result = await myPlan({ vertical: 'accommodation' });

            // Assert
            expect(result.items).toHaveLength(1);
            expect(result.items[0]).toMatchObject({
                plan: { slug: 'owner-basico', name: 'Básico', version: ACCOMMODATION_VERSION },
                status: 'COURTESY',
                statusLabel: 'Cortesía',
                coverageEndsAt: COURTESY_END.toISOString(),
                nextChargeAt: null
            });
        });

        it('a live subscription plus a courtesy in the same vertical: one item, from the subscription', async () => {
            // Arrange
            arrangeSubscriptionAndTrial();
            extraSources.set('accommodation', [
                courtesySource(ACCOMMODATION_VERSION, COURTESY_END)
            ]);

            // Act
            const result = await myPlan({ vertical: 'accommodation' });

            // Assert
            expect(result.items).toHaveLength(1);
            expect(result.items[0]).toMatchObject({
                status: 'ACTIVE',
                statusLabel: 'Activa',
                coverageEndsAt: null
            });
        });

        it('a permanent grant wins over a running trial in the same vertical', async () => {
            // Arrange
            arrangeSubscriptionAndTrial();
            arrangeVersion(GRANT_VERSION, 'venue-pro', 'Catalog venue pro');
            extraSources.set('venue', [grantSource(GRANT_VERSION)]);

            // Act
            const result = await myPlan({ vertical: 'venue' });

            // Assert
            expect(result.items).toHaveLength(1);
            expect(result.items[0]).toMatchObject({
                status: 'PERMANENT_GRANT',
                trialDaysLeft: null
            });
        });

        it('branch 5: a courtesy-paused subscription billing reports no courtesy for stays PAUSED', async () => {
            // Arrange: the pause says COURTESY, coverage reports no COURTESY source
            arrangeVersion(ACCOMMODATION_VERSION, 'owner-basico', 'Catalog basic');
            mocks.readOwnPlanState.mockResolvedValue({
                subscriptions: [
                    subscriptionRow({
                        status: 'PAUSED',
                        nextCharge: null,
                        pause: { reason: 'COURTESY', expectedEndAt: COURTESY_END }
                    })
                ],
                deferredCourtesies: []
            });

            // Act
            const result = await myPlan({ vertical: 'accommodation' });

            // Assert
            expect(result.items).toHaveLength(1);
            expect(result.items[0]).toMatchObject({
                status: 'PAUSED',
                statusLabel: 'Pausada',
                plan: { slug: 'owner-basico' },
                coverageEndsAt: null
            });
        });

        it('a coverage failure falls back to the trial, and is logged', async () => {
            // Arrange
            arrangeSubscriptionAndTrial();
            mocks.coverage.mockRejectedValue(new Error('coverage down'));
            const warn = vi.spyOn(apiLogger, 'warn');

            // Act
            const result = await myPlan({ vertical: 'venue' });

            // Assert
            expect(result.items).toHaveLength(1);
            expect(result.items[0]?.status).toBe('TRIAL');
            expect(warn).toHaveBeenCalledWith(
                expect.objectContaining({ vertical: 'venue', error: 'coverage down' }),
                expect.stringContaining('coverage could not be read')
            );
        });

        it('labels the grant in the user locale (pt)', async () => {
            // Arrange
            arrangeVersion(GRANT_VERSION, 'owner-pro', 'Catalog pro');
            extraSources.set('accommodation', [grantSource(GRANT_VERSION)]);

            // Act
            const outcome = await runTool({
                definition: getMyPlanTool,
                actor: ownerActor(),
                input: { vertical: 'accommodation' },
                context: { ...context, locale: 'pt' }
            });

            // Assert
            const item = outcome.ok ? (outcome.data as MyPlanResult).items[0] : undefined;
            expect(item?.statusLabel).toBe('Acesso permanente');
        });
    });

    it('shows the grace and service-end dates of a subscription and no next charge outside ACTIVE', async () => {
        // Arrange
        mocks.readOwnPlanState.mockResolvedValue({
            subscriptions: [
                subscriptionRow({
                    status: 'GRACE_PERIOD',
                    nextCharge: null,
                    graceEndsAt: new Date('2026-11-28T03:00:00.000Z'),
                    serviceEndsAt: new Date('2026-12-15T03:00:00.000Z')
                })
            ],
            deferredCourtesies: []
        });

        // Act
        const [item] = (await myPlan()).items;

        // Assert
        expect(item).toMatchObject({
            status: 'GRACE_PERIOD',
            statusLabel: 'Pago pendiente',
            nextChargeAt: null,
            graceEndsAt: '2026-11-28T03:00:00.000Z',
            serviceEndsAt: '2026-12-15T03:00:00.000Z'
        });
    });

    it('reports includes as null when the effective set cannot be read, never invented', async () => {
        // Arrange
        arrangeSubscriptionAndTrial();
        mocks.effectiveSet.mockRejectedValue(new Error('redis down'));

        // Act
        const result = await myPlan({ vertical: 'accommodation' });

        // Assert
        expect(result.items[0]?.includes).toBeNull();
        expect(result.items[0]?.status).toBe('ACTIVE');
    });

    it('links in the user locale and reads only the actor', async () => {
        // Arrange
        arrangeSubscriptionAndTrial();

        // Act
        const outcome = await runTool({
            definition: getMyPlanTool,
            actor: ownerActor(),
            input: { vertical: 'accommodation' },
            context: { ...context, locale: 'en' }
        });

        // Assert
        expect(outcome.ok).toBe(true);
        const data = outcome.ok ? (outcome.data as MyPlanResult) : undefined;
        expect(data?.items[0]?.actionUrl).toBe(`${SITE}/en/mi-cuenta/suscripcion/`);
        expect(mocks.readOwnPlanState).toHaveBeenCalledWith({
            userId: ownerActor().id,
            now: NOW
        });
        expect(mocks.readOwnerAddonHoldings).toHaveBeenCalledWith({ userId: ownerActor().id });
    });
});
