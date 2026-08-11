/**
 * @fileoverview Unit tests for HostTradeUsageService declaration (HOS-376 T-019).
 *
 * Covers the three channels of spec §6.2 and the sealing of `expiresAt`:
 * - QR      → declaredBy=HOST,     creationChannel=QR
 * - selector→ declaredBy=PROVIDER, creationChannel=LINKED_SELECTOR
 * - email   → declaredBy=PROVIDER, creationChannel=EMAIL_LOOKUP
 *
 * Plus the refusals that make the channels safe: an email that resolves to
 * nobody (or to somebody who is not a host) answers HOST_NOT_FOUND and writes
 * NOTHING, and a provider declaring on someone else's listing gets 404 rather
 * than 403.
 */
import type {
    HostTradeBenefitUsageModel,
    HostTradeModel,
    HostTradeReviewModel,
    UserModel
} from '@repo/db';
import { hostTradeBenefitUsages } from '@repo/db';
import { HostTradeUsageStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostTradeUsageService } from '../../../src/services/hostTrade/host-trade-usage.service';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const HT_ID = getMockId('attraction', 'ht-usage-1');
const OWNER_ID = getMockId('user', 'provider-owner-1');
const HOST_ID = getMockId('user', 'host-1');
const OTHER_ID = getMockId('user', 'other-1');

const makeHostTrade = (overrides: Record<string, unknown> = {}) => ({
    id: HT_ID,
    slug: 'plomero-centro',
    name: 'Plomero Centro',
    category: 'PLOMERIA',
    ownerUserId: OWNER_ID,
    revokedAt: null,
    deletedAt: null,
    ...overrides
});

/** Actor that is a host: holds HOST_TRADE_VIEW, the directory's only gate. */
const hostActor = () =>
    new ActorFactoryBuilder()
        .withId(HOST_ID)
        .withPermissions([PermissionEnum.HOST_TRADE_VIEW])
        .build();

/** Actor that owns the listing. Providers get no permission — ownership only. */
const providerActor = () => new ActorFactoryBuilder().withId(OWNER_ID).withPermissions([]).build();

function buildService(
    options: {
        isHost?: boolean;
        hostTrade?: Record<string, unknown>;
        /** A standing REJECTED usage for the pair, declared by this side. */
        rejectedBy?: 'HOST' | 'PROVIDER';
        /** An existing PENDING usage for the pair, opened by this side. */
        pendingBy?: 'HOST' | 'PROVIDER';
        /** Provider ids this host has already reviewed, for the `hasReview` flag. */
        reviewedTradeIds?: readonly string[];
    } = {}
) {
    const model = createModelMock();
    // `findByIds` is not part of the default mock surface, but the host-facing
    // lists resolve every provider on a page through it in a single query.
    const hostTradeModel = createModelMock(['findByIds']);
    const userModel = createModelMock();

    model.create = vi.fn(async (data: Record<string, unknown>) => ({ id: 'created', ...data }));
    model.findLinkedHosts = vi.fn(async () => [HOST_ID]);
    // The guards ask two different questions through `findOne`, and the fixture
    // rows carry the side that opened them. The mock therefore honours a
    // `declaredBy` filter when the query has one and ignores it when it does
    // not — modelling the database rather than the caller's intent. A mock that
    // answered "yes, a pending exists" regardless of the where would make the
    // pending guard's scope untestable: narrowing it to one side would change
    // nothing the tests can see.
    const matchesSide = (where: Record<string, unknown>, side?: 'HOST' | 'PROVIDER') =>
        side !== undefined && (where.declaredBy === undefined || where.declaredBy === side);

    model.findOne = vi.fn(async (where: Record<string, unknown>) => {
        if (where.status === 'REJECTED') {
            return matchesSide(where, options.rejectedBy) ? { id: 'rejected-1' } : null;
        }
        if (where.status === 'PENDING') {
            return matchesSide(where, options.pendingBy) ? { id: 'pending-1' } : null;
        }
        return null;
    });
    hostTradeModel.findById = vi.fn(async () => options.hostTrade ?? makeHostTrade());
    hostTradeModel.findByIds = vi.fn(async (ids: readonly string[]) =>
        ids.map((id) => makeHostTrade({ id }))
    );
    userModel.findOne = vi.fn(async () => null);

    const isHostUser = vi.fn(async () => options.isHost ?? true);

    // Only the host-facing lists touch it, and only to answer "already
    // reviewed?". The mock honours the `hostTradeId` membership filter the
    // service sends, so a test can assert the flag is per-provider rather than
    // per-page.
    const reviewModel = createModelMock();
    reviewModel.findAll = vi.fn(async (where: Record<string, unknown>) => {
        const reviewed = options.reviewedTradeIds ?? [];
        const requested = (where.hostTradeId as string[] | undefined) ?? [];
        const matched = reviewed.filter((id) => requested.includes(id));
        return { items: matched.map((id) => ({ hostTradeId: id })), total: matched.length };
    });

    const service = new HostTradeUsageService(
        { logger: mockLogger },
        model as unknown as HostTradeBenefitUsageModel,
        hostTradeModel as unknown as HostTradeModel,
        userModel as unknown as UserModel,
        isHostUser,
        reviewModel as unknown as HostTradeReviewModel
    );

    return { service, model, hostTradeModel, userModel, isHostUser, reviewModel };
}

/** The single row handed to `model.create`, whatever the channel. */
function createdRow(model: ReturnType<typeof createModelMock>): Record<string, unknown> {
    const call = (model.create as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    return call?.[0] as Record<string, unknown>;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('HostTradeUsageService.declareAsHost — the QR channel', () => {
    it('creates a PENDING usage stamped HOST / QR with the actor as the host', async () => {
        const { service, model } = buildService();

        const result = await service.declareAsHost(
            { hostTradeId: HT_ID, servicedAt: '2026-08-01', note: 'Destapación' },
            hostActor()
        );

        expect(result.error).toBeUndefined();
        const row = createdRow(model);
        expect(row.declaredBy).toBe('HOST');
        expect(row.creationChannel).toBe('QR');
        // The QR path needs no identification mechanism precisely because the
        // host IS the session — both ids come from the actor.
        expect(row.hostUserId).toBe(HOST_ID);
        expect(row.declaredById).toBe(HOST_ID);
    });

    it('seals expiresAt 30 days out', async () => {
        const { service, model } = buildService();
        const before = Date.now();

        await service.declareAsHost({ hostTradeId: HT_ID, servicedAt: '2026-08-01' }, hostActor());

        const expiresAt = createdRow(model).expiresAt as Date;
        const elapsed = expiresAt.getTime() - before;
        const thirtyDays = 30 * 86_400_000;
        expect(elapsed).toBeGreaterThan(thirtyDays - 60_000);
        expect(elapsed).toBeLessThan(thirtyDays + 60_000);
    });

    it('refuses an actor without HOST_TRADE_VIEW', async () => {
        const { service, model } = buildService();
        const stranger = new ActorFactoryBuilder().withId(OTHER_ID).withPermissions([]).build();

        const result = await service.declareAsHost(
            { hostTradeId: HT_ID, servicedAt: '2026-08-01' },
            stranger
        );

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for a provider that does not exist', async () => {
        const { service, model, hostTradeModel } = buildService();
        hostTradeModel.findById = vi.fn(async () => null);

        const result = await service.declareAsHost(
            { hostTradeId: HT_ID, servicedAt: '2026-08-01' },
            hostActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });
});

describe('HostTradeUsageService.declareAsProvider — the selector channel', () => {
    it('creates a PENDING usage stamped PROVIDER / LINKED_SELECTOR', async () => {
        const { service, model } = buildService();

        const result = await service.declareAsProvider(
            { hostTradeId: HT_ID, hostUserId: HOST_ID, servicedAt: '2026-08-01' },
            providerActor()
        );

        expect(result.error).toBeUndefined();
        const row = createdRow(model);
        expect(row.declaredBy).toBe('PROVIDER');
        expect(row.creationChannel).toBe('LINKED_SELECTOR');
        expect(row.hostUserId).toBe(HOST_ID);
        expect(row.declaredById).toBe(OWNER_ID);
    });

    it('refuses a hostUserId that is not among the linked hosts', async () => {
        const { service, model } = buildService();
        model.findLinkedHosts = vi.fn(async () => [OTHER_ID]);

        const result = await service.declareAsProvider(
            { hostTradeId: HT_ID, hostUserId: HOST_ID, servicedAt: '2026-08-01' },
            providerActor()
        );

        // The selector's whole privacy property is that it only ever lists
        // hosts with a confirmed usage. Trusting the body would hand a provider
        // the ability to declare against any user id he can guess.
        expect(result.error?.code).toBe(ServiceErrorCode.HOST_NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND, not FORBIDDEN, on someone else listing', async () => {
        const { service, model, hostTradeModel } = buildService();
        hostTradeModel.findById = vi.fn(async () => makeHostTrade({ ownerUserId: OTHER_ID }));

        const result = await service.declareAsProvider(
            { hostTradeId: HT_ID, hostUserId: HOST_ID, servicedAt: '2026-08-01' },
            providerActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });
});

describe('HostTradeUsageService.declareAsProvider — the email channel', () => {
    it('creates a PENDING usage stamped PROVIDER / EMAIL_LOOKUP', async () => {
        const { service, model, userModel } = buildService();
        userModel.findOne = vi.fn(async () => ({ id: HOST_ID, email: 'anfitrion@example.com' }));

        const result = await service.declareAsProvider(
            {
                hostTradeId: HT_ID,
                hostEmail: 'anfitrion@example.com',
                servicedAt: '2026-08-01'
            },
            providerActor()
        );

        expect(result.error).toBeUndefined();
        const row = createdRow(model);
        expect(row.creationChannel).toBe('EMAIL_LOOKUP');
        expect(row.hostUserId).toBe(HOST_ID);
    });

    it('answers HOST_NOT_FOUND and writes nothing when the email matches nobody', async () => {
        const { service, model, userModel } = buildService();
        userModel.findOne = vi.fn(async () => null);

        const result = await service.declareAsProvider(
            { hostTradeId: HT_ID, hostEmail: 'typo@example.com', servicedAt: '2026-08-01' },
            providerActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.HOST_NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('answers HOST_NOT_FOUND when the email matches a user who is not a host', async () => {
        const { service, model, userModel } = buildService({ isHost: false });
        userModel.findOne = vi.fn(async () => ({ id: OTHER_ID, email: 'turista@example.com' }));

        const result = await service.declareAsProvider(
            { hostTradeId: HT_ID, hostEmail: 'turista@example.com', servicedAt: '2026-08-01' },
            providerActor()
        );

        // NG-6: the benefit only exists inside the directory, which requires
        // the host role. A confirmed usage from a non-host would unlock nothing
        // anyway, so accepting it would only inflate the public counter.
        expect(result.error?.code).toBe(ServiceErrorCode.HOST_NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('rejects a payload carrying neither identifier', async () => {
        const { service, model } = buildService();

        const result = await service.declareAsProvider(
            { hostTradeId: HT_ID, servicedAt: '2026-08-01' },
            providerActor()
        );

        expect(result.error).toBeDefined();
        expect(model.create).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Declaration guards (T-020)
// ---------------------------------------------------------------------------

const suspendedTrade = () =>
    makeHostTrade({
        declarationSuspendedAt: new Date('2026-08-01T00:00:00Z'),
        declarationSuspendedById: null,
        declarationSuspendReason: 'Automática'
    });

const hostDeclaration = { hostTradeId: HT_ID, servicedAt: '2026-08-01' };
const providerDeclaration = { hostTradeId: HT_ID, hostUserId: HOST_ID, servicedAt: '2026-08-01' };

describe('guard — SELF_USAGE_FORBIDDEN', () => {
    /**
     * The dual-role account: owns the listing AND holds the host permission.
     * Real and seeded (`host-provider@local.test`), not hypothetical — a host who
     * became a provider keeps being a host.
     */
    const ownerAsHostActor = () =>
        new ActorFactoryBuilder()
            .withId(OWNER_ID)
            .withPermissions([PermissionEnum.HOST_TRADE_VIEW])
            .build();

    // AC-17 already forbids reviewing your own listing (SELF_REVIEW_FORBIDDEN).
    // Declaring a usage on it is the same conflict one step earlier, and it is
    // the step that feeds `confirmedUsesCount` and `distinctHostsCount` — the
    // two numbers the directory ranks providers by.

    it('refuses the owner declaring on his own listing through the QR channel', async () => {
        const { service, model } = buildService();

        const result = await service.declareAsHost(
            { hostTradeId: HT_ID, servicedAt: '2026-08-01' },
            ownerAsHostActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.SELF_USAGE_FORBIDDEN);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('refuses the owner naming himself through the selector channel', async () => {
        const { service, model } = buildService();
        model.findLinkedHosts = vi.fn(async () => [OWNER_ID]);

        const result = await service.declareAsProvider(
            { hostTradeId: HT_ID, hostUserId: OWNER_ID, servicedAt: '2026-08-01' },
            providerActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.SELF_USAGE_FORBIDDEN);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('refuses the owner naming his own email through the email channel', async () => {
        const { service, model, userModel } = buildService();
        userModel.findOne = vi.fn(async () => ({ id: OWNER_ID, email: 'duenio@example.com' }));

        const result = await service.declareAsProvider(
            {
                hostTradeId: HT_ID,
                hostEmail: 'duenio@example.com',
                servicedAt: '2026-08-01'
            },
            providerActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.SELF_USAGE_FORBIDDEN);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('still allows an ordinary host, so the guard is about identity and not the listing', async () => {
        const { service, model } = buildService();

        const result = await service.declareAsHost(
            { hostTradeId: HT_ID, servicedAt: '2026-08-01' },
            hostActor()
        );

        expect(result.error).toBeUndefined();
        expect(model.create).toHaveBeenCalled();
    });
});

describe('guard — PROVIDER_REVOKED', () => {
    it('refuses a host declaring on a revoked listing', async () => {
        const { service, model } = buildService({
            hostTrade: makeHostTrade({ revokedAt: new Date('2026-07-01T00:00:00Z') })
        });

        const result = await service.declareAsHost(hostDeclaration, hostActor());

        expect(result.error?.code).toBe(ServiceErrorCode.PROVIDER_REVOKED);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('refuses a provider declaring on his own soft-deleted listing', async () => {
        const { service, model } = buildService({
            hostTrade: makeHostTrade({ deletedAt: new Date('2026-07-01T00:00:00Z') })
        });

        const result = await service.declareAsProvider(providerDeclaration, providerActor());

        expect(result.error?.code).toBe(ServiceErrorCode.PROVIDER_REVOKED);
        expect(model.create).not.toHaveBeenCalled();
    });
});

describe('guard — DECLARATION_SUSPENDED', () => {
    it('refuses the suspended provider', async () => {
        const { service, model } = buildService({ hostTrade: suspendedTrade() });

        const result = await service.declareAsProvider(providerDeclaration, providerActor());

        expect(result.error?.code).toBe(ServiceErrorCode.DECLARATION_SUSPENDED);
        expect(model.create).not.toHaveBeenCalled();
    });

    /**
     * The suspension freezes the LISTING, not one party's keyboard. A provider
     * under review for fabricated declarations would otherwise keep accruing
     * usages through the QR — the channel he controls the distribution of, and
     * the easiest one to hand to a friendly host.
     */
    it('refuses a host declaring on a suspended listing too', async () => {
        const { service, model } = buildService({ hostTrade: suspendedTrade() });

        const result = await service.declareAsHost(hostDeclaration, hostActor());

        expect(result.error?.code).toBe(ServiceErrorCode.DECLARATION_SUSPENDED);
        expect(model.create).not.toHaveBeenCalled();
    });
});

describe('guard — DECLARATION_BLOCKED', () => {
    /** AC-9 — a standing rejection blocks the DECLARANT over that pair. */
    it('refuses the provider re-declaring on a host who rejected him', async () => {
        const { service, model } = buildService({ rejectedBy: 'PROVIDER' });

        const result = await service.declareAsProvider(providerDeclaration, providerActor());

        expect(result.error?.code).toBe(ServiceErrorCode.DECLARATION_BLOCKED);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('refuses the host re-declaring after the provider rejected him', async () => {
        const { service, model } = buildService({ rejectedBy: 'HOST' });

        const result = await service.declareAsHost(hostDeclaration, hostActor());

        expect(result.error?.code).toBe(ServiceErrorCode.DECLARATION_BLOCKED);
        expect(model.create).not.toHaveBeenCalled();
    });

    /**
     * THE MIXED CASE, and the reason the block is scoped by side. The host
     * denying the provider's version does not cost the host his own voice: him
     * declaring afterwards is precisely how a mistaken rejection gets corrected.
     */
    it('lets the host declare although the PROVIDER has a standing rejection', async () => {
        const { service, model } = buildService({ rejectedBy: 'PROVIDER' });

        const result = await service.declareAsHost(hostDeclaration, hostActor());

        expect(result.error).toBeUndefined();
        expect(model.create).toHaveBeenCalled();
    });

    /**
     * Scoped by SIDE (`declaredBy`), never by the declarant's user id: a listing
     * that changes hands would otherwise hand the new owner a clean slate on
     * every pair the previous one was blocked from.
     */
    it('asks for the standing rejection by side, not by user id', async () => {
        const { service, model } = buildService();

        await service.declareAsProvider(providerDeclaration, providerActor());

        expect(model.findOne).toHaveBeenCalledWith(
            expect.objectContaining({
                hostTradeId: HT_ID,
                hostUserId: HOST_ID,
                status: 'REJECTED',
                declaredBy: 'PROVIDER',
                deletedAt: null
            }),
            undefined
        );
    });
});

describe('guard — USAGE_PENDING_EXISTS', () => {
    it('refuses the provider re-declaring over his own pending usage', async () => {
        const { service, model } = buildService({ pendingBy: 'PROVIDER' });

        const result = await service.declareAsProvider(providerDeclaration, providerActor());

        expect(result.error?.code).toBe(ServiceErrorCode.USAGE_PENDING_EXISTS);
        expect(model.create).not.toHaveBeenCalled();
    });

    /**
     * THE CROSS-SIDE CASE. Unlike the standing-rejection block, this guard is
     * NOT scoped by side: one PENDING per pair is a partial UNIQUE index in the
     * database, and the index does not care who opened it. Scoped by side, this
     * refusal would be a 409 the database raises anyway — as a crash.
     */
    it('refuses the host although it was the PROVIDER who opened the pending one', async () => {
        const { service, model } = buildService({ pendingBy: 'PROVIDER' });

        const result = await service.declareAsHost(hostDeclaration, hostActor());

        expect(result.error?.code).toBe(ServiceErrorCode.USAGE_PENDING_EXISTS);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('asks for the pending usage without naming a side', async () => {
        const { service, model } = buildService();

        await service.declareAsProvider(providerDeclaration, providerActor());

        const pendingQuery = (
            model.findOne as unknown as { mock: { calls: unknown[][] } }
        ).mock.calls
            .map((call) => call[0] as Record<string, unknown>)
            .find((where) => where.status === 'PENDING');
        expect(pendingQuery).toBeDefined();
        expect(pendingQuery).not.toHaveProperty('declaredBy');
    });
});

/**
 * The order is the point: several guards can be true at once, and the one that
 * answers has to be the one whose remedy is furthest away. Telling a provider
 * on a revoked listing to "wait for the pending usage to resolve" would send him
 * after something that still would not let him declare.
 */
describe('guard order — most permanent wins', () => {
    it('reports PROVIDER_REVOKED over DECLARATION_SUSPENDED', async () => {
        const { service } = buildService({
            hostTrade: makeHostTrade({
                revokedAt: new Date('2026-07-01T00:00:00Z'),
                declarationSuspendedAt: new Date('2026-08-01T00:00:00Z')
            })
        });

        const result = await service.declareAsProvider(providerDeclaration, providerActor());

        expect(result.error?.code).toBe(ServiceErrorCode.PROVIDER_REVOKED);
    });

    it('reports DECLARATION_SUSPENDED over DECLARATION_BLOCKED', async () => {
        const { service } = buildService({
            hostTrade: suspendedTrade(),
            rejectedBy: 'PROVIDER'
        });

        const result = await service.declareAsProvider(providerDeclaration, providerActor());

        expect(result.error?.code).toBe(ServiceErrorCode.DECLARATION_SUSPENDED);
    });

    it('reports DECLARATION_BLOCKED over USAGE_PENDING_EXISTS', async () => {
        const { service } = buildService({ rejectedBy: 'PROVIDER', pendingBy: 'HOST' });

        const result = await service.declareAsProvider(providerDeclaration, providerActor());

        expect(result.error?.code).toBe(ServiceErrorCode.DECLARATION_BLOCKED);
    });

    /**
     * SELF_USAGE_FORBIDDEN sits BETWEEN the listing-wide half and the pair half,
     * because the host it is about only exists once `resolveDeclaredHost` has
     * run. Both of its neighbours are pinned below: a chain is only ordered if
     * every adjacent pair is, and the guard added last is the one whose position
     * nothing else asserts.
     */
    it('reports DECLARATION_SUSPENDED over SELF_USAGE_FORBIDDEN', async () => {
        const { service } = buildService({
            hostTrade: makeHostTrade({
                declarationSuspendedAt: new Date('2026-08-01T00:00:00Z')
            })
        });

        const result = await service.declareAsProvider(
            { hostTradeId: HT_ID, hostUserId: OWNER_ID, servicedAt: '2026-08-01' },
            providerActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.DECLARATION_SUSPENDED);
    });

    it('reports SELF_USAGE_FORBIDDEN over DECLARATION_BLOCKED', async () => {
        const { service, model } = buildService({ rejectedBy: 'PROVIDER', pendingBy: 'PROVIDER' });
        // The owner has to survive host resolution to reach the guard being
        // measured — otherwise the selector answers HOST_NOT_FOUND first and the
        // test would pass on the wrong refusal.
        model.findLinkedHosts = vi.fn(async () => [OWNER_ID]);

        const result = await service.declareAsProvider(
            { hostTradeId: HT_ID, hostUserId: OWNER_ID, servicedAt: '2026-08-01' },
            providerActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.SELF_USAGE_FORBIDDEN);
    });

    /**
     * The pairwise cases above each hold exactly two conditions true. This one
     * holds ALL of them at once — the shape a real abandoned listing actually
     * has, since a provider who was revoked was usually suspended first and left
     * rejections and a pending row behind. The answer must still be the refusal
     * whose remedy is furthest away, not whichever check happens to run first.
     */
    it('reports PROVIDER_REVOKED when every condition is true at once', async () => {
        const { service, model } = buildService({
            hostTrade: makeHostTrade({
                revokedAt: new Date('2026-07-01T00:00:00Z'),
                declarationSuspendedAt: new Date('2026-08-01T00:00:00Z')
            }),
            rejectedBy: 'PROVIDER',
            pendingBy: 'PROVIDER'
        });

        const result = await service.declareAsProvider(providerDeclaration, providerActor());

        expect(result.error?.code).toBe(ServiceErrorCode.PROVIDER_REVOKED);
        expect(model.create).not.toHaveBeenCalled();
    });

    /**
     * Ownership outranks every state guard. A stranger probing someone else's
     * listing must not learn from the error code whether it is revoked,
     * suspended or perfectly healthy.
     */
    it('answers NOT_FOUND, not PROVIDER_REVOKED, on somebody else’s revoked listing', async () => {
        const { service } = buildService({
            hostTrade: makeHostTrade({
                ownerUserId: OTHER_ID,
                revokedAt: new Date('2026-07-01T00:00:00Z')
            })
        });

        const result = await service.declareAsProvider(providerDeclaration, providerActor());

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });
});

describe('HostTradeUsageService — the admin usage search (T-038)', () => {
    /**
     * The model mock's default `getTable()` returns `{}`, which makes the base
     * `adminList` reject every sort field before it reaches the query. The REAL
     * table is handed over instead, so these tests exercise the base's actual
     * where-building rather than a stub of it.
     */
    function buildSearchService() {
        const model = createModelMock();
        model.getTable = vi.fn(() => hostTradeBenefitUsages);
        model.findAll = vi.fn(async () => ({ items: [], total: 0 }));
        model.count = vi.fn(async () => 0);

        const service = new HostTradeUsageService(
            { logger: mockLogger },
            model as unknown as HostTradeBenefitUsageModel
        );

        return { service, model };
    }

    const auditorActor = () =>
        new ActorFactoryBuilder()
            .withId(OTHER_ID)
            .withPermissions([
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.HOST_TRADE_USAGE_VIEW_ALL
            ])
            .build();

    const lastWhere = (model: ReturnType<typeof createModelMock>) =>
        (model.findAll as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;

    /**
     * THE ONE THIS OVERRIDE EXISTS FOR. `status` is a key `AdminSearchBaseSchema`
     * RESERVES: the base reads it as a lifecycle filter and writes
     * `where.lifecycleState`, a column this table does not have. `buildWhereClause`
     * then warns and SKIPS the unknown key, so without the override
     * `?status=REJECTED` would answer with every usage in the system — filtered by
     * nothing, green in every test, and wrong only in production.
     */
    it('filters by the usage state machine, not by a lifecycle column', async () => {
        const { service, model } = buildSearchService();

        await service.adminList(auditorActor(), { status: 'REJECTED' } as never);

        expect(lastWhere(model).status).toBe('REJECTED');
        expect(lastWhere(model).lifecycleState).toBeUndefined();
    });

    /**
     * The filter built for abuse triage: the email fallback is the only channel
     * a provider can drive without the host being present (R-5), so isolating it
     * is how a suspected spam pattern gets read.
     */
    it('filters by creationChannel so the email fallback can be audited', async () => {
        const { service, model } = buildSearchService();

        await service.adminList(auditorActor(), { creationChannel: 'EMAIL_LOOKUP' } as never);

        expect(lastWhere(model).creationChannel).toBe('EMAIL_LOOKUP');
    });

    it('filters by provider', async () => {
        const { service, model } = buildSearchService();

        await service.adminList(auditorActor(), { hostTradeId: HT_ID } as never);

        expect(lastWhere(model).hostTradeId).toBe(HT_ID);
    });

    /** Comes free from the base; asserted because the audit screen relies on it. */
    it('maps the date range onto the createdAt column', async () => {
        const { service, model } = buildSearchService();

        await service.adminList(auditorActor(), {
            createdAfter: '2026-07-01T00:00:00.000Z',
            createdBefore: '2026-07-31T23:59:59.000Z'
        } as never);

        expect(lastWhere(model).createdAt_gte).toBeDefined();
        expect(lastWhere(model).createdAt_lte).toBeDefined();
    });

    it('refuses an actor without HOST_TRADE_USAGE_VIEW_ALL', async () => {
        const { service, model } = buildSearchService();
        const outsider = new ActorFactoryBuilder()
            .withId(OTHER_ID)
            .withPermissions([PermissionEnum.ACCESS_PANEL_ADMIN])
            .build();

        const result = await service.adminList(outsider, {} as never);

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.findAll).not.toHaveBeenCalled();
    });
});

describe('HostTradeUsageService.applyDeclarationSuspension (T-038)', () => {
    const adminActor = () =>
        new ActorFactoryBuilder()
            .withId(OTHER_ID)
            .withPermissions([PermissionEnum.HOST_TRADE_USAGE_MANAGE])
            .build();

    const lastPatch = (hostTradeModel: ReturnType<typeof createModelMock>) =>
        (hostTradeModel.update as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0]?.[1] as Record<string, unknown>;

    it('suspends the provider and records the reason', async () => {
        const { service, hostTradeModel } = buildService();

        const result = await service.applyDeclarationSuspension(
            { hostTradeId: HT_ID, reason: 'Declaraciones por email sin confirmar.' },
            adminActor()
        );

        expect(result.error).toBeUndefined();
        expect(lastPatch(hostTradeModel).declarationSuspendedAt).toBeInstanceOf(Date);
        expect(lastPatch(hostTradeModel).declarationSuspendReason).toBe(
            'Declaraciones por email sin confirmar.'
        );
    });

    /**
     * THE DIFFERENCE FROM THE AUTOMATIC PATH. The threshold suspension writes
     * `declarationSuspendedById: null` on purpose — NULL is what tells the admin
     * screen that no human decided it. An admin-applied one must carry the id,
     * or the two become indistinguishable and nobody can be asked why.
     */
    it('stamps the acting admin, unlike the automatic threshold suspension', async () => {
        const { service, hostTradeModel } = buildService();

        await service.applyDeclarationSuspension(
            { hostTradeId: HT_ID, reason: 'Motivo.' },
            adminActor()
        );

        expect(lastPatch(hostTradeModel).declarationSuspendedById).toBe(OTHER_ID);
    });

    it('refuses an actor without HOST_TRADE_USAGE_MANAGE', async () => {
        const { service, hostTradeModel } = buildService();

        const result = await service.applyDeclarationSuspension(
            { hostTradeId: HT_ID, reason: 'Motivo.' },
            hostActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(hostTradeModel.update).not.toHaveBeenCalled();
    });

    /**
     * Built by hand rather than through `buildService`: its `hostTrade` option
     * is resolved with `??`, so passing `null` falls through to the default
     * fixture and the absent-listing case cannot be expressed there.
     */
    it('answers NOT_FOUND for a listing that does not exist', async () => {
        const model = createModelMock();
        const hostTradeModel = createModelMock();
        hostTradeModel.findById = vi.fn(async () => null);

        const service = new HostTradeUsageService(
            { logger: mockLogger },
            model as unknown as HostTradeBenefitUsageModel,
            hostTradeModel as unknown as HostTradeModel
        );

        const result = await service.applyDeclarationSuspension(
            { hostTradeId: HT_ID, reason: 'Motivo.' },
            adminActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(hostTradeModel.update).not.toHaveBeenCalled();
    });

    /**
     * The cross of the two cases above, which is the only thing that pins their
     * ORDER: the 403 one names a listing that exists and the 404 one is asked
     * by an admin, so each passes whichever way round the gate and the lookup
     * run. Looking the listing up first would let anybody with a session tell
     * an absent id from a present one by the error code alone — without holding
     * the permission that would let them do anything about either.
     */
    it('answers FORBIDDEN, not NOT_FOUND, when an unauthorised actor names a listing that does not exist', async () => {
        const model = createModelMock();
        const hostTradeModel = createModelMock();
        hostTradeModel.findById = vi.fn(async () => null);

        const service = new HostTradeUsageService(
            { logger: mockLogger },
            model as unknown as HostTradeBenefitUsageModel,
            hostTradeModel as unknown as HostTradeModel
        );

        const result = await service.applyDeclarationSuspension(
            { hostTradeId: HT_ID, reason: 'Motivo.' },
            hostActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(hostTradeModel.findById).not.toHaveBeenCalled();
    });

    /** A reason is what the provider is owed when he asks why. */
    it('requires a reason', async () => {
        const { service, hostTradeModel } = buildService();

        const result = await service.applyDeclarationSuspension(
            { hostTradeId: HT_ID, reason: '' },
            adminActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(hostTradeModel.update).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// The host's own usages (T-046)
// ---------------------------------------------------------------------------

describe('HostTradeUsageService.listForHost — the host’s own record', () => {
    /** A service whose `findAll` records its arguments and answers a fixed page. */
    function buildListService() {
        const { service, model } = buildService();
        model.findAll = vi.fn(async () => ({
            items: [{ id: 'usage-1', hostUserId: HOST_ID, status: 'CONFIRMED' }],
            total: 1
        }));
        return { service, model };
    }

    /** The `where` object handed to `findAll`. */
    function whereOf(model: ReturnType<typeof createModelMock>): Record<string, unknown> {
        const call = (model.findAll as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
        return call?.[0] as Record<string, unknown>;
    }

    it('scopes to the caller and excludes soft-deleted rows', async () => {
        const { service, model } = buildListService();

        const res = await service.listForHost({ page: 1, pageSize: 20 }, hostActor());

        expect(res.error).toBeUndefined();
        expect(res.data?.total).toBe(1);
        expect(whereOf(model)).toEqual({ hostUserId: HOST_ID, deletedAt: null });
    });

    it('does NOT filter by declaredBy, unlike the pending inbox', async () => {
        // This is the whole point of the method. The inbox is scoped to
        // `declaredBy = 'PROVIDER'` because a host's own declaration waits on the
        // provider, not on him — correct for an inbox, and the reason a host had
        // no way to see his own QR declaration at all.
        const { service, model } = buildListService();

        await service.listForHost({ page: 1, pageSize: 20 }, hostActor());

        expect(whereOf(model)).not.toHaveProperty('declaredBy');
    });

    it('filters by status when one is asked for', async () => {
        const { service, model } = buildListService();

        await service.listForHost(
            { status: HostTradeUsageStatusEnum.CONFIRMED, page: 1, pageSize: 20 },
            hostActor()
        );

        expect(whereOf(model).status).toBe(HostTradeUsageStatusEnum.CONFIRMED);
    });

    it('returns every state when no status is given', async () => {
        const { service, model } = buildListService();

        await service.listForHost({ page: 1, pageSize: 20 }, hostActor());

        expect(whereOf(model)).not.toHaveProperty('status');
    });

    it('forwards the page window rather than letting findAll default it', async () => {
        // `findAll` defaults to 20 rows; a caller asking for page 3 that silently
        // got page 1 would render a history that never advances.
        const { service, model } = buildListService();

        await service.listForHost({ page: 3, pageSize: 5 }, hostActor());

        const call = (model.findAll as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
        expect(call?.[1]).toEqual({ page: 3, pageSize: 5 });
    });

    it('refuses an unauthenticated caller', async () => {
        const { service } = buildListService();
        const guest = new ActorFactoryBuilder().withId('').withPermissions([]).build();

        const res = await service.listForHost({ page: 1, pageSize: 20 }, guest);

        expect(res.error).toBeDefined();
    });

    it('needs no HOST_TRADE_* permission — the rows are already the caller’s', async () => {
        // Same reasoning as the pending inbox: a permission here would only decide
        // whether a host may read his own history, and would lock out someone
        // whose directory perk lapsed while confirmed usages stayed on file.
        const { service, model } = buildListService();
        const noPerms = new ActorFactoryBuilder().withId(HOST_ID).withPermissions([]).build();

        const res = await service.listForHost({ page: 1, pageSize: 20 }, noPerms);

        expect(res.error).toBeUndefined();
        expect(whereOf(model).hostUserId).toBe(HOST_ID);
    });
});

// ---------------------------------------------------------------------------
// Provider identity on the host's lists (T-046)
// ---------------------------------------------------------------------------

/**
 * A usage row names its provider by id and nothing else, which is unrenderable:
 * the host would be asked to confirm work done by `a3f9…-8c21`. The host cannot
 * resolve the name from the directory either — that list is scoped to the
 * destinations he currently hosts in and drops revoked providers, so exactly the
 * oldest rows would keep the raw uuid. Both host-facing lists therefore attach
 * the provider's identity server-side.
 */
describe('HostTradeUsageService — provider identity on the host’s lists', () => {
    const OTHER_HT_ID = getMockId('attraction', 'ht-usage-2');

    /** Two rows naming two different providers, plus a repeat of the first. */
    function buildEnrichedService(reviewedTradeIds?: readonly string[]) {
        const { service, model, hostTradeModel, reviewModel } = buildService({ reviewedTradeIds });
        const page = [
            { id: 'usage-1', hostTradeId: HT_ID, hostUserId: HOST_ID, status: 'PENDING' },
            { id: 'usage-2', hostTradeId: OTHER_HT_ID, hostUserId: HOST_ID, status: 'CONFIRMED' },
            { id: 'usage-3', hostTradeId: HT_ID, hostUserId: HOST_ID, status: 'REJECTED' }
        ];
        model.findAll = vi.fn(async () => ({ items: page, total: page.length }));
        model.findPendingForUser = vi.fn(async () => page);
        model.countPendingForUser = vi.fn(async () => page.length);
        return { service, model, hostTradeModel, reviewModel };
    }

    /** The id list handed to `findByIds` on its only call. */
    function idsAskedFor(hostTradeModel: ReturnType<typeof createModelMock>): string[] {
        const call = (hostTradeModel.findByIds as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0];
        return [...((call?.[0] as string[]) ?? [])].sort();
    }

    it('attaches the provider’s identity to every row of the history', async () => {
        const { service } = buildEnrichedService();

        const res = await service.listForHost({ page: 1, pageSize: 20 }, hostActor());

        expect(res.error).toBeUndefined();
        expect(res.data?.items[0]?.hostTrade).toEqual({
            id: HT_ID,
            slug: 'plomero-centro',
            name: 'Plomero Centro',
            category: 'PLOMERIA'
        });
        expect(res.data?.items[1]?.hostTrade?.id).toBe(OTHER_HT_ID);
    });

    it('flags which providers the host already reviewed, per provider and not per row', async () => {
        // Rows 1 and 3 name the SAME provider, so one review has to light both.
        // The card's button reads this to offer "edit" instead of "rate"; with a
        // per-row flag the second visit to the same plumber would keep offering
        // to write a review that already exists.
        const { service } = buildEnrichedService([HT_ID]);

        const res = await service.listForHost({ page: 1, pageSize: 20 }, hostActor());

        expect(res.error).toBeUndefined();
        expect(res.data?.items.map((item) => item.hasReview)).toEqual([true, false, true]);
    });

    it('reports hasReview false for every row when the host reviewed nobody', async () => {
        const { service } = buildEnrichedService();

        const res = await service.listForHost({ page: 1, pageSize: 20 }, hostActor());

        expect(res.data?.items.map((item) => item.hasReview)).toEqual([false, false, false]);
    });

    it('asks only about the providers on the page, in one query', async () => {
        // Same contract as `findByIds` above: one round trip for the page, and
        // a window sized to the page so a long review history cannot truncate
        // the answer into false negatives.
        const { service, reviewModel } = buildEnrichedService([HT_ID]);

        await service.listForHost({ page: 1, pageSize: 20 }, hostActor());

        const calls = (reviewModel.findAll as unknown as { mock: { calls: unknown[][] } }).mock
            .calls;
        expect(calls).toHaveLength(1);
        const [where, pagination] = calls[0] as [Record<string, unknown>, { pageSize: number }];
        expect(where.hostUserId).toBe(HOST_ID);
        expect([...(where.hostTradeId as string[])].sort()).toEqual([HT_ID, OTHER_HT_ID].sort());
        expect(pagination.pageSize).toBe(2);
    });

    it('attaches the same identity to the pending inbox', async () => {
        // The inbox is the screen that asks "did this happen?", so it is the one
        // that most needs to name who is asking.
        const { service } = buildEnrichedService();

        const res = await service.listPendingForHost({ page: 1, pageSize: 20 }, hostActor());

        expect(res.error).toBeUndefined();
        expect(res.data?.items[0]?.hostTrade?.name).toBe('Plomero Centro');
    });

    it('resolves the whole page in ONE query, with each id asked for once', async () => {
        // The alternative — findById per row — is N sequential round trips for a
        // page, and three rows naming two providers would issue three of them.
        const { service, hostTradeModel } = buildEnrichedService();

        await service.listForHost({ page: 1, pageSize: 20 }, hostActor());

        expect(hostTradeModel.findByIds).toHaveBeenCalledTimes(1);
        expect(idsAskedFor(hostTradeModel)).toEqual([HT_ID, OTHER_HT_ID].sort());
        expect(hostTradeModel.findById).not.toHaveBeenCalled();
    });

    it('keeps the row with a null identity when the provider does not resolve', async () => {
        // Dropping the row would silently shorten a history that `total` still
        // counts; throwing would fail the whole page over one unresolved name.
        const { service, hostTradeModel } = buildEnrichedService();
        hostTradeModel.findByIds = vi.fn(async () => []);

        const res = await service.listForHost({ page: 1, pageSize: 20 }, hostActor());

        expect(res.error).toBeUndefined();
        expect(res.data?.items).toHaveLength(3);
        expect(res.data?.items[0]?.hostTrade).toBeNull();
    });

    it('asks for nothing when the page is empty', async () => {
        const { service, model, hostTradeModel } = buildEnrichedService();
        model.findAll = vi.fn(async () => ({ items: [], total: 0 }));

        const res = await service.listForHost({ page: 1, pageSize: 20 }, hostActor());

        expect(res.data?.items).toEqual([]);
        expect(hostTradeModel.findByIds).not.toHaveBeenCalled();
    });
});
