/**
 * HOS-2184 T-030, AC-6 and AC-12 — the cross-user "not found" sweep.
 *
 * Every registered tool that takes a listing, inquiry or benefit-usage id is called, through
 * the MCP binding (`handleMcpToolCall`), by a user who does not own the
 * resource and by staff (ADMIN, SUPER_ADMIN, every permission). The answer must
 * be exactly the one a non-existent id gets, so the caller learns nothing about
 * whether the id exists: no 403, no entitlement error, no partial data. And the
 * call must not have changed anything: no listing write, no publication change,
 * no message, no confirmation token, and no read of the resource's data.
 *
 * The sweep is driven by the registry (`MCP_TOOL_DEFINITIONS`): a tool that is
 * registered without being added to {@link ID_TOOL_CASES} (or, if it takes no
 * resource id, to {@link NO_RESOURCE_INPUT_TOOLS}) fails the coverage test, so
 * a new tool cannot ship unswept.
 *
 * What is real: the tool handlers, the executor, the MCP binding and its audit
 * hook, the listing-access pipeline (step 3 / 4 / 5 / 6 decisions over mocked
 * ports) and the resource step. What is stubbed: the service-core services (on
 * their prototypes) and the readers, in the WORST case for the tool: for
 * listings the service returns the foreign row to the staff (what its own
 * permission check allows), so only the tool's ownership gate can refuse. The
 * inquiry ownership filter lives in the SQL of
 * `ConversationService.findOwnedConversation` (owner of the accommodation =
 * the actor), so there it is stubbed to what that query answers, and the sweep
 * asserts the tool asked it for the caller's own id and went no further.
 *
 * @module test/mcp/tools/cross-user-not-found.sweep
 */

import {
    PermissionEnum,
    PublicationStatusEnum,
    RoleEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    ConversationService,
    ExperienceService,
    HostTradeUsageService,
    MessageService,
    ServiceError,
    VenueService
} from '@repo/service-core';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn(),
    preTrialDraftLimits: vi.fn(),
    enforceGate: vi.fn(),
    effectiveKeys: vi.fn(),
    record: vi.fn(),
    latestReviews: vi.fn(),
    ownerReviews: vi.fn(),
    reviewerNames: vi.fn(),
    statsExtras: vi.fn(),
    readOwnerIds: vi.fn(),
    readListContext: vi.fn(),
    readThreadContext: vi.fn(),
    issueToken: vi.fn(),
    consumeToken: vi.fn(),
    catalog: vi.fn(),
    notifyUsageConfirmed: vi.fn(),
    notifyUsageRejected: vi.fn(),
    notifyUsageDeclared: vi.fn()
}));

vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: mocks.loadFacts,
        billing: { coverage: mocks.coverage },
        effectiveSet: mocks.effectiveSet,
        preTrialDraftLimits: mocks.preTrialDraftLimits
    })
}));
vi.mock('../../../src/utils/listing-access/user-gate', () => ({
    enforceUserGate: mocks.enforceGate,
    readEffectiveKeys: mocks.effectiveKeys
}));
vi.mock('../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: mocks.record }));
vi.mock('../../../src/mcp/tools/listing/listing-stats-readers', () => ({
    readLatestListingReviews: mocks.latestReviews
}));
vi.mock('../../../src/mcp/tools/review/owner-review-reader', () => ({
    readOwnerListingReviews: mocks.ownerReviews
}));
vi.mock('../../../src/mcp/tools/review/reviewer-names', () => ({
    readReviewerDisplayNames: mocks.reviewerNames
}));
vi.mock('../../../src/mcp/tools/listing/get-listing-stats.accommodation', () => ({
    readAccommodationStatsExtras: mocks.statsExtras
}));
vi.mock('../../../src/mcp/tools/inquiry/inquiry-readers', () => ({
    readOwnerAccommodationIds: mocks.readOwnerIds,
    readInquiryListContext: mocks.readListContext,
    readInquiryThreadContext: mocks.readThreadContext
}));
vi.mock('../../../src/mcp/tools/inquiry/confirmation-token-store', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../src/mcp/tools/inquiry/confirmation-token-store')
    >()),
    issueConfirmationToken: mocks.issueToken,
    consumeConfirmationToken: mocks.consumeToken
}));
vi.mock('../../../src/mcp/tools/confirmation-token-store', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/mcp/tools/confirmation-token-store')>()),
    issueConfirmationToken: mocks.issueToken,
    consumeConfirmationToken: mocks.consumeToken
}));
vi.mock('../../../src/lib/host-trade-notifications', () => ({
    notifyUsageConfirmed: mocks.notifyUsageConfirmed,
    notifyUsageRejected: mocks.notifyUsageRejected,
    notifyUsageDeclared: mocks.notifyUsageDeclared
}));
vi.mock('../../../src/utils/listing-catalog-relations', () => ({
    fetchVenueAmenities: mocks.catalog,
    fetchVenueFeatures: mocks.catalog,
    fetchExperienceAmenities: mocks.catalog,
    fetchExperienceFeatures: mocks.catalog
}));
vi.mock('../../../src/utils/accommodation-catalog-relations', () => ({
    fetchProtectedAmenities: mocks.catalog,
    fetchProtectedFeatures: mocks.catalog
}));

import { handleMcpToolCall } from '../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../src/lib/mcp/caller';
import { MCP_TOOL_DEFINITIONS } from '../../../src/mcp/tools/registry';
import { TOOL_NOT_FOUND_MESSAGE } from '../../../src/mcp/tools/tool-errors';
import { clearSlidingWindowStore } from '../../../src/middlewares/rate-limit';
import { ListingPublicationService } from '../../../src/services/listing-publication/listing-publication.service';
import { validateApiEnv } from '../../../src/utils/env';

const OWNER_A = '1f2e3d4c-5b6a-4789-8abc-def012345678';
const USER_B = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const STAFF_ID = '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b';
const LISTING_ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';
const CONVERSATION_ID = 'c9999999-9999-4999-8999-999999999999';
const USAGE_ID = 'b3333333-3333-4333-8333-333333333333';
const FOREIGN_ACCOMMODATION = 'a1111111-1111-4111-8111-111111111111';
const CALLERS_ACCOMMODATION = 'a2222222-2222-4222-8222-222222222222';
const CLIENT_ID = 'https://claude.ai/oauth/mcp-client-metadata';

type Vertical = (typeof VerticalEnum)['ACCOMMODATION' | 'VENUE' | 'EXPERIENCE'];

const VERTICALS: readonly Vertical[] = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
];

/** A caller of the sweep. */
interface Caller {
    readonly label: string;
    readonly actor: Actor;
}

const ALL_PERMISSIONS = Object.values(PermissionEnum);

const CALLERS: readonly Caller[] = [
    {
        label: 'another owner',
        actor: {
            id: USER_B,
            roles: [RoleEnum.HOST],
            permissions: [
                PermissionEnum.CONVERSATION_VIEW_OWN,
                PermissionEnum.CONVERSATION_REPLY_OWN
            ],
            emailVerified: true
        } as unknown as Actor
    },
    {
        label: 'an ADMIN with every permission',
        actor: {
            id: STAFF_ID,
            roles: [RoleEnum.ADMIN],
            permissions: ALL_PERMISSIONS,
            emailVerified: true
        } as unknown as Actor
    },
    {
        label: 'a SUPER_ADMIN with every permission',
        actor: {
            id: STAFF_ID,
            roles: [RoleEnum.SUPER_ADMIN],
            permissions: ALL_PERMISSIONS,
            emailVerified: true
        } as unknown as Actor
    }
];

/** What the service layer does for a resource the caller does not own. */
type ServiceMode = 'permissive' | 'not-found' | 'forbidden';
const SERVICE_MODES: readonly ServiceMode[] = ['permissive', 'not-found', 'forbidden'];

/** Whether the caller's plan grants everything, or nothing. */
type Plan = 'full' | 'none';
const PLANS: readonly Plan[] = ['full', 'none'];

/** The state of the world the tool is called in. */
interface World {
    readonly resource: 'foreign' | 'missing';
    readonly mode: ServiceMode;
    readonly plan: Plan;
}

const SERVICES = {
    [VerticalEnum.ACCOMMODATION]: AccommodationService,
    [VerticalEnum.VENUE]: VenueService,
    [VerticalEnum.EXPERIENCE]: ExperienceService
} as const;

const CAPABILITIES: Readonly<Record<Vertical, readonly string[]>> = {
    [VerticalEnum.ACCOMMODATION]: [
        'edit_accommodation_info',
        'publish_accommodations',
        'view_basic_stats',
        'view_advanced_stats',
        'recover_own_listing'
    ],
    [VerticalEnum.VENUE]: ['edit_venue_info', 'publish_venue', 'recover_own_listing'],
    [VerticalEnum.EXPERIENCE]: ['edit_experience_info', 'publish_experience', 'recover_own_listing']
};

const foreignListingRow = {
    id: LISTING_ID,
    ownerId: OWNER_A,
    name: 'Cabañas del Río',
    slug: 'cabanas-del-rio',
    publicationStatus: PublicationStatusEnum.PUBLISHED,
    description: 'Secret description',
    reviewsCount: 3,
    averageRating: 4.5
};

/** Spies that must stay untouched on a refused call (writes and data reads). */
function buildForbiddenSpies() {
    return {
        accommodationUpdate: vi.spyOn(AccommodationService.prototype, 'update'),
        venueUpdateOwn: vi.spyOn(VenueService.prototype, 'updateOwn'),
        experienceUpdateOwn: vi.spyOn(ExperienceService.prototype, 'updateOwn'),
        publish: vi.spyOn(ListingPublicationService.prototype, 'publish'),
        unpublish: vi.spyOn(ListingPublicationService.prototype, 'unpublish'),
        reactivate: vi.spyOn(ListingPublicationService.prototype, 'reactivate'),
        createMessage: vi.spyOn(MessageService.prototype, 'createMessage'),
        getThread: vi.spyOn(ConversationService.prototype, 'getThread'),
        markRead: vi.spyOn(ConversationService.prototype, 'markReadByOwner'),
        confirmUsage: vi.spyOn(HostTradeUsageService.prototype, 'confirmUsage'),
        rejectUsage: vi.spyOn(HostTradeUsageService.prototype, 'rejectUsage')
    };
}

/** Wires every collaborator for one world. Returns the spies the assertions read. */
function arrange(world: World) {
    const { resource, mode, plan } = world;
    const spies = buildForbiddenSpies();
    for (const spy of Object.values(spies)) {
        spy.mockImplementation((() => {
            throw new Error('a refused call must not reach this');
        }) as never);
    }

    // Listings: the service layer.
    const serviceAnswer = (() => {
        if (resource === 'missing') {
            return { error: { code: ServiceErrorCode.NOT_FOUND, message: 'missing' } };
        }
        if (mode === 'permissive') {
            return { data: foreignListingRow };
        }
        return {
            error: {
                code:
                    mode === 'forbidden' ? ServiceErrorCode.FORBIDDEN : ServiceErrorCode.NOT_FOUND,
                message: 'refused'
            }
        };
    })();
    const getById = Object.fromEntries(
        VERTICALS.map((vertical) => [
            vertical,
            vi
                .spyOn(
                    SERVICES[vertical].prototype as unknown as { getById: () => unknown },
                    'getById'
                )
                .mockResolvedValue(serviceAnswer as never)
        ])
    );

    // Listings: the listing-access ports.
    mocks.loadFacts.mockResolvedValue(
        resource === 'missing'
            ? { facts: null, ownerId: null }
            : {
                  facts: {
                      ownerId: OWNER_A,
                      publicationStatus: PublicationStatusEnum.PUBLISHED,
                      businessLines: ['standard']
                  },
                  ownerId: OWNER_A
              }
    );
    mocks.coverage.mockResolvedValue(
        plan === 'full'
            ? { covered: true, sources: [{ type: 'BASE' }] }
            : { covered: false, sources: [] }
    );
    mocks.preTrialDraftLimits.mockResolvedValue(new Map());
    mocks.effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: Vertical }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: plan === 'full',
                inheritsTouristVip: false,
                entries:
                    plan === 'full'
                        ? CAPABILITIES[vertical].map((key) => ({
                              key,
                              value: 1,
                              strategy: 'MAX' as const
                          }))
                        : []
            })
    );

    // Stats: the plan gate that runs before the ownership read.
    if (plan === 'full') {
        mocks.enforceGate.mockResolvedValue(undefined);
    } else {
        mocks.enforceGate.mockRejectedValue(
            new ServiceError(ServiceErrorCode.ENTITLEMENT_REQUIRED, 'no stats on this plan')
        );
    }
    mocks.effectiveKeys.mockResolvedValue({ view_advanced_stats: plan === 'full' });
    mocks.statsExtras.mockResolvedValue({ extras: { favorites: 0 } });
    mocks.latestReviews.mockResolvedValue([]);
    mocks.ownerReviews.mockResolvedValue({
        rows: [],
        total: 0,
        countsByState: { APPROVED: 0, PENDING: 0, REJECTED: 0 }
    });
    mocks.reviewerNames.mockResolvedValue(new Map());
    mocks.catalog.mockResolvedValue([]);

    // Inquiries: what `findOwnedConversation`'s SQL answers for a conversation
    // whose accommodation the actor does not own.
    const findOwned = vi
        .spyOn(ConversationService.prototype, 'findOwnedConversation')
        .mockImplementation((async () => {
            if (resource === 'foreign' && mode === 'not-found') {
                return { error: { code: ServiceErrorCode.NOT_FOUND, message: 'refused' } };
            }
            if (resource === 'foreign' && mode === 'forbidden') {
                return { error: { code: ServiceErrorCode.FORBIDDEN, message: 'refused' } };
            }
            return { data: null };
        }) as never);
    const listForOwner = vi.spyOn(ConversationService.prototype, 'listForOwner').mockResolvedValue({
        data: { items: [], total: 0, page: 1, pageSize: 20 }
    } as never);
    mocks.readOwnerIds.mockImplementation(async ({ ownerId }: { ownerId: string }) =>
        ownerId === OWNER_A ? [FOREIGN_ACCOMMODATION] : [CALLERS_ACCOMMODATION]
    );
    mocks.readListContext.mockResolvedValue({
        accommodationNames: new Map(),
        guestNames: new Map(),
        lastMessages: new Map(),
        unreadCounts: new Map()
    });
    mocks.readThreadContext.mockResolvedValue({ accommodationName: null, guestName: null });
    vi.spyOn(MessageService.prototype, 'assertMessageBodyAllowed').mockResolvedValue(
        undefined as never
    );

    // Benefit usages: the counterpart rule lives in the service
    // (`requireAnswerableBy`), so its read and the undo are stubbed to what it
    // answers for a usage the caller may not answer. A FORBIDDEN from it must
    // still reach the caller as not-found.
    const usageRefusal = async () =>
        resource === 'foreign' && mode === 'forbidden'
            ? { error: { code: ServiceErrorCode.FORBIDDEN, message: 'refused' } }
            : { error: { code: ServiceErrorCode.NOT_FOUND, message: 'Usage not found' } };
    const getAnswerableUsage = vi
        .spyOn(HostTradeUsageService.prototype, 'getAnswerableUsage')
        .mockImplementation(usageRefusal as never);
    const undoRejection = vi
        .spyOn(HostTradeUsageService.prototype, 'undoRejection')
        .mockImplementation(usageRefusal as never);

    return { ...spies, getById, findOwned, listForOwner, getAnswerableUsage, undoRejection };
}

type Spies = ReturnType<typeof arrange>;

/** One way of calling one id-taking tool. */
interface IdToolCase {
    /** Registry name of the tool. */
    readonly tool: string;
    /** Short label of the argument variant. */
    readonly variant: string;
    /** Raw `tools/call` arguments naming the foreign resource. */
    readonly args: Readonly<Record<string, unknown>>;
    /** `not-found`: an error result. `empty-page`: a filter that matches nothing. */
    readonly expects: 'not-found' | 'empty-page';
    /** Extra assertions on what the tool asked of its collaborators. */
    readonly verify?: (input: { readonly spies: Spies; readonly actor: Actor }) => void;
}

const listingCases = (
    tool: string,
    build: (vertical: Vertical) => Record<string, unknown>
): IdToolCase[] =>
    VERTICALS.map((vertical) => ({
        tool,
        variant: vertical,
        args: build(vertical),
        expects: 'not-found'
    }));

/**
 * Every tool of the registry that takes the id of a listing or an inquiry.
 * Add a row here when you register one.
 */
const ID_TOOL_CASES: readonly IdToolCase[] = [
    ...listingCases('get_listing', (vertical) => ({ vertical, id: LISTING_ID })),
    ...listingCases('update_listing_basic', (vertical) => ({
        vertical,
        id: LISTING_ID,
        description: 'Texto nuevo de la publicación.'
    })),
    ...listingCases('update_listing_amenities', (vertical) => ({
        vertical,
        id: LISTING_ID,
        kind: 'amenity',
        category: 'KITCHEN',
        add: ['a0000001-0000-4000-8000-000000000000']
    })),
    ...listingCases('get_listing_amenities', (vertical) => ({ vertical, id: LISTING_ID })),
    ...(['pause', 'resume'] as const).flatMap((action) =>
        VERTICALS.map(
            (vertical): IdToolCase => ({
                tool: 'set_listing_publication',
                variant: `${vertical}/${action}`,
                args: { vertical, id: LISTING_ID, action },
                expects: 'not-found'
            })
        )
    ),
    ...listingCases('get_listing_stats', (vertical) => ({ vertical, listingId: LISTING_ID })),
    ...listingCases('list_reviews', (vertical) => ({ vertical, listingId: LISTING_ID })),
    {
        tool: 'get_inquiry',
        variant: 'inquiry',
        args: { id: CONVERSATION_ID },
        expects: 'not-found',
        verify: ({ spies, actor }) => {
            expect(spies.findOwned).toHaveBeenCalledTimes(1);
            expect(spies.findOwned.mock.calls[0]?.[0]).toMatchObject({ id: actor.id });
        }
    },
    {
        tool: 'reply_inquiry',
        variant: 'preview',
        args: { inquiryId: CONVERSATION_ID, text: 'Hola, sí tenemos lugar.' },
        expects: 'not-found',
        verify: ({ spies, actor }) => {
            expect(spies.findOwned.mock.calls[0]?.[0]).toMatchObject({ id: actor.id });
        }
    },
    {
        tool: 'reply_inquiry',
        variant: 'send with a token',
        args: {
            inquiryId: CONVERSATION_ID,
            text: 'Hola, sí tenemos lugar.',
            confirmationToken: 'a-token-the-caller-somehow-holds'
        },
        expects: 'not-found',
        verify: ({ spies, actor }) => {
            expect(spies.findOwned.mock.calls[0]?.[0]).toMatchObject({ id: actor.id });
        }
    },
    ...(['confirm_benefit_usage', 'reject_benefit_usage'] as const).flatMap((tool) =>
        (
            [
                ['preview', {}],
                ['commit with a token', { confirmationToken: 'a-token-the-caller-somehow-holds' }]
            ] as const
        ).map(
            ([variant, extra]): IdToolCase => ({
                tool,
                variant,
                args: {
                    usageId: USAGE_ID,
                    ...(tool === 'reject_benefit_usage' ? { note: 'No vino.' } : {}),
                    ...extra
                },
                expects: 'not-found',
                verify: ({ spies, actor }) => {
                    // The service's counterpart check, asked for THIS caller.
                    expect(spies.getAnswerableUsage).toHaveBeenCalledTimes(1);
                    expect(spies.getAnswerableUsage.mock.calls[0]?.[0]).toEqual({
                        usageId: USAGE_ID
                    });
                    expect(spies.getAnswerableUsage.mock.calls[0]?.[1]).toMatchObject({
                        id: actor.id
                    });
                }
            })
        )
    ),
    {
        tool: 'undo_benefit_rejection',
        variant: 'usage',
        args: { usageId: USAGE_ID },
        expects: 'not-found',
        verify: ({ spies, actor }) => {
            expect(spies.undoRejection).toHaveBeenCalledTimes(1);
            expect(spies.undoRejection.mock.calls[0]?.[1]).toMatchObject({ id: actor.id });
        }
    },
    {
        tool: 'list_inquiries',
        variant: 'listingId filter',
        args: { listingId: FOREIGN_ACCOMMODATION },
        expects: 'empty-page',
        verify: ({ spies, actor }) => {
            // Scoped to the caller: their own accommodations, never the foreign one.
            expect(mocks.readOwnerIds).toHaveBeenCalledWith({ ownerId: actor.id });
            for (const call of spies.listForOwner.mock.calls) {
                const query = call[1] as { userId: string; accommodationIds: string[] };
                expect(query.userId).toBe(actor.id);
                expect(query.accommodationIds).toEqual([CALLERS_ACCOMMODATION]);
            }
        }
    }
];

/**
 * Registry tools that take no listing or inquiry id, with the reason. A tool
 * listed here must not have an id-like input.
 */
const NO_RESOURCE_INPUT_TOOLS: Readonly<Record<string, string>> = {
    list_my_listings: 'lists what the token subject owns; takes no input',
    get_owner_summary:
        'summarizes what the token subject owns; its only input is the period, and every read is scoped to the caller (HOS-2331)',
    list_amenities_and_features: 'reads the public catalog; the vertical is its only input',
    get_help:
        "answers from the static help catalog; its topicId names a catalog entry, and the editor links it builds come only from the caller's own listings",
    get_listing_creation_guide:
        "reads the public catalog and the caller's own drafts; the vertical is its only input",
    create_listing:
        'creates a new listing owned by the caller; its only id is destinationId, a public catalog entry (HOS-2329)',
    search_providers:
        "reads the directory scoped by the service to the caller's own destinations; destinationId only narrows that list (HOS-2332)",
    list_benefit_usages:
        'lists the usages the service scopes to the caller (host side by hostUserId, provider side by the caller-owned listing); takes no id (HOS-2332)'
};

/**
 * Write tools that take no resource id, so there is nothing to sweep across
 * users: each one must also be in {@link NO_RESOURCE_INPUT_TOOLS}. The audit row
 * of `create_listing` is covered by its own tests (`create-listing.audit.test.ts`).
 */
const ID_FREE_WRITE_TOOLS: ReadonlySet<string> = new Set(['create_listing']);

const ID_LIKE_KEY = /^(id|.*Id|.*Ids)$/;
// `topicId` is an entry of the static help catalog (`get_help`), not a resource anyone owns;
// `destinationId` is a public destination a new listing belongs to (`create_listing`).
const CATALOG_ID_KEYS: ReadonlySet<string> = new Set([
    'amenityIds',
    'featureIds',
    'topicId',
    'destinationId'
]);

/** Input keys of a tool that look like a reference to a resource. */
function idLikeKeys(tool: (typeof MCP_TOOL_DEFINITIONS)[number]): string[] {
    return Object.keys(tool.inputSchema.shape).filter(
        (key) => ID_LIKE_KEY.test(key) && !CATALOG_ID_KEYS.has(key)
    );
}

const WRITE_SPY_KEYS = [
    'confirmUsage',
    'rejectUsage',
    'accommodationUpdate',
    'venueUpdateOwn',
    'experienceUpdateOwn',
    'publish',
    'unpublish',
    'reactivate',
    'createMessage'
] as const;

const DATA_READ_SPIES = ['getThread', 'markRead'] as const;

describe('the registry is swept', () => {
    it('classifies every registered tool as id-taking (swept) or id-free (listed with a reason)', () => {
        // Arrange
        const swept = new Set(ID_TOOL_CASES.map((c) => c.tool));
        const idFree = new Set(Object.keys(NO_RESOURCE_INPUT_TOOLS));

        // Act
        const unclassified = MCP_TOOL_DEFINITIONS.filter(
            (tool) => !swept.has(tool.name) && !idFree.has(tool.name)
        ).map((tool) => tool.name);

        // Assert
        expect(
            unclassified,
            'register the tool in ID_TOOL_CASES (takes a listing or inquiry id) or NO_RESOURCE_INPUT_TOOLS'
        ).toEqual([]);
    });

    it('has no swept or id-free entry for a tool that is not registered', () => {
        // Arrange
        const registered = new Set(MCP_TOOL_DEFINITIONS.map((tool) => tool.name));

        // Act
        const stale = [
            ...new Set(ID_TOOL_CASES.map((c) => c.tool)),
            ...Object.keys(NO_RESOURCE_INPUT_TOOLS)
        ].filter((name) => !registered.has(name));

        // Assert
        expect(stale).toEqual([]);
    });

    it('does not list as id-free a tool that has an id-like input', () => {
        // Arrange / Act
        const mislabelled = MCP_TOOL_DEFINITIONS.filter(
            (tool) => tool.name in NO_RESOURCE_INPUT_TOOLS && idLikeKeys(tool).length > 0
        ).map((tool) => tool.name);

        // Assert
        expect(mislabelled).toEqual([]);
    });

    it('sweeps every id-like input key of the id-taking tools', () => {
        // Arrange: the argument keys each tool's cases name.
        const namedKeys = (name: string): Set<string> =>
            new Set(
                ID_TOOL_CASES.filter((c) => c.tool === name).flatMap((c) => Object.keys(c.args))
            );

        // Act
        const missed = MCP_TOOL_DEFINITIONS.filter(
            (tool) => !(tool.name in NO_RESOURCE_INPUT_TOOLS)
        ).flatMap((tool) =>
            idLikeKeys(tool)
                .filter((key) => !namedKeys(tool.name).has(key))
                .map((key) => `${tool.name}.${key}`)
        );

        // Assert
        expect(missed).toEqual([]);
    });

    it('sweeps the write tools and checks them in the audit record', () => {
        // Arrange
        const writeTools = MCP_TOOL_DEFINITIONS.filter((tool) => tool.isWrite).map(
            (tool) => tool.name
        );

        // Act / Assert
        expect(writeTools.length).toBeGreaterThan(0);
        for (const name of writeTools) {
            if (ID_FREE_WRITE_TOOLS.has(name)) {
                expect(name in NO_RESOURCE_INPUT_TOOLS).toBe(true);
                continue;
            }
            expect(ID_TOOL_CASES.some((c) => c.tool === name)).toBe(true);
        }
    });
});

describe('cross-user not found, tool by tool', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        clearSlidingWindowStore();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const callTool = async (input: {
        readonly caller: Caller;
        readonly tool: string;
        readonly args: Readonly<Record<string, unknown>>;
    }) => {
        const definition = MCP_TOOL_DEFINITIONS.find((tool) => tool.name === input.tool);
        if (!definition) {
            throw new Error(`tool ${input.tool} is not registered`);
        }
        const mcpAuth = {
            userId: input.caller.actor.id,
            clientId: CLIENT_ID,
            clientName: 'Claude',
            scopes: ['openid']
        } as const;
        const ctx = {
            http: {
                authInfo: buildMcpAuthInfo({
                    token: 'tok',
                    actor: input.caller.actor,
                    mcpAuth,
                    resourceUrl: 'https://api.test/mcp'
                })
            }
        };
        return handleMcpToolCall({ definition, input: { ...input.args }, ctx });
    };

    for (const toolCase of ID_TOOL_CASES) {
        const definition = MCP_TOOL_DEFINITIONS.find((tool) => tool.name === toolCase.tool);

        describe(`${toolCase.tool} (${toolCase.variant})`, () => {
            for (const caller of CALLERS) {
                for (const mode of SERVICE_MODES) {
                    for (const plan of PLANS) {
                        it(`answers ${caller.label} on a foreign resource like on a missing one [${mode} service, ${plan} plan]`, async () => {
                            // Arrange: the baseline, a resource that does not exist.
                            arrange({ resource: 'missing', mode, plan });
                            const baseline = await callTool({ caller, ...toolCase });
                            vi.restoreAllMocks();
                            vi.clearAllMocks();
                            clearSlidingWindowStore();
                            const spies = arrange({ resource: 'foreign', mode, plan });

                            // Act
                            const result = await callTool({ caller, ...toolCase });

                            // Assert: indistinguishable from "does not exist"
                            expect(result).toEqual(baseline);
                            if (toolCase.expects === 'empty-page') {
                                expect(result.isError).not.toBe(true);
                                const [block] = result.content as { text: string }[];
                                expect(JSON.parse(block?.text ?? 'null').inquiries).toEqual([]);
                            } else if (plan === 'full') {
                                expect(result.isError).toBe(true);
                                expect(JSON.stringify(result.content)).toContain(
                                    TOOL_NOT_FOUND_MESSAGE
                                );
                            }
                            toolCase.verify?.({ spies, actor: caller.actor });

                            // Assert: nothing changed and no data of the resource was read
                            for (const key of WRITE_SPY_KEYS) {
                                expect(spies[key], key).not.toHaveBeenCalled();
                            }
                            for (const key of DATA_READ_SPIES) {
                                expect(spies[key], key).not.toHaveBeenCalled();
                            }
                            expect(mocks.issueToken).not.toHaveBeenCalled();
                            expect(mocks.consumeToken).not.toHaveBeenCalled();
                            expect(mocks.catalog).not.toHaveBeenCalled();
                            expect(mocks.latestReviews).not.toHaveBeenCalled();
                            expect(mocks.ownerReviews).not.toHaveBeenCalled();
                            expect(mocks.reviewerNames).not.toHaveBeenCalled();
                            expect(mocks.statsExtras).not.toHaveBeenCalled();
                            expect(mocks.readThreadContext).not.toHaveBeenCalled();
                            expect(mocks.notifyUsageConfirmed).not.toHaveBeenCalled();
                            expect(mocks.notifyUsageRejected).not.toHaveBeenCalled();
                            expect(mocks.notifyUsageDeclared).not.toHaveBeenCalled();

                            // Assert (AC-12): a write tool leaves a `denied` audit record
                            if (definition?.isWrite && plan === 'full') {
                                expect(mocks.record).toHaveBeenCalledTimes(1);
                                expect(mocks.record).toHaveBeenCalledWith(
                                    expect.objectContaining({
                                        tool: toolCase.tool,
                                        outcome: 'denied',
                                        errorCode: ServiceErrorCode.NOT_FOUND,
                                        actor: expect.objectContaining({ id: caller.actor.id }),
                                        mcpAuth: expect.objectContaining({ clientId: CLIENT_ID })
                                    })
                                );
                            }
                        });
                    }
                }
            }
        });
    }
});
