/**
 * MSW Admin Endpoint Handlers
 *
 * Provides mock handlers for ALL admin API endpoints used by the admin panel.
 * Uses fixture data from ../fixtures/ and response factories from ./handlers.ts.
 *
 * Exports `getAdminHandlers()` which returns the full handler array for use
 * in MSW server setup.
 */

import { http, HttpResponse } from 'msw';

import {
    mockAccommodation,
    mockAccommodationList,
    mockBillingAddon,
    mockBillingAddonList,
    mockBillingInvoice,
    mockBillingInvoiceList,
    mockBillingPlanList,
    mockBillingSubscription,
    mockBillingSubscriptionList,
    mockDestination,
    mockDestinationList,
    mockEvent,
    mockEventList,
    mockNotificationLog,
    mockNotificationLogList,
    mockOwnerPromotion,
    mockOwnerPromotionList,
    mockPost,
    mockPostList,
    mockPromoCode,
    mockPromoCodeList,
    mockRoleList,
    mockSponsor,
    mockSponsorList,
    mockSponsorship,
    mockSponsorshipList,
    mockTag,
    mockTagList,
    mockUser,
    mockUserList,
    mockWebhookEvent,
    mockWebhookEventList
} from '../fixtures';
import { API_BASE, mockPaginatedResponse, mockSuccessResponse } from './handlers';

// ---------------------------------------------------------------------------
// Inline mocks for entities without dedicated fixture files
// ---------------------------------------------------------------------------

/** Mock event location (no dedicated fixture file) */
const mockEventLocation = {
    id: 'loc-test-001',
    placeName: 'Centro Cultural',
    street: 'San Martin 123',
    city: 'Concepcion del Uruguay',
    state: 'Entre Rios',
    country: 'Argentina',
    latitude: -32.4833,
    longitude: -58.2333,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdById: 'user-test-001',
    updatedById: 'user-test-001',
    deletedAt: null,
    deletedById: null
} as const;

const mockEventLocationList = [
    mockEventLocation,
    {
        ...mockEventLocation,
        id: 'loc-test-002',
        placeName: 'Parque Rivadavia',
        street: 'Av. Rivadavia 500'
    },
    {
        ...mockEventLocation,
        id: 'loc-test-003',
        placeName: 'Club Nautico',
        street: 'Costanera Sur s/n'
    }
];

/** Mock event organizer (no dedicated fixture file) */
const mockEventOrganizer = {
    id: 'org-test-001',
    name: 'Municipalidad de CdU',
    description: 'Gobierno municipal de Concepcion del Uruguay',
    lifecycleState: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdById: 'user-test-001',
    updatedById: 'user-test-001',
    deletedAt: null,
    deletedById: null
} as const;

const mockEventOrganizerList = [
    mockEventOrganizer,
    {
        ...mockEventOrganizer,
        id: 'org-test-002',
        name: 'Club Atletico',
        description: 'Club deportivo y social'
    }
];

/** Mock accommodation amenity (no dedicated fixture file) */
const mockAmenity = {
    id: 'amenity-test-001',
    name: 'WiFi',
    slug: 'wifi',
    description: 'High-speed internet access',
    icon: 'wifi',
    isBuiltin: true,
    isFeatured: true,
    lifecycleState: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
} as const;

const mockAmenityList = [
    mockAmenity,
    {
        ...mockAmenity,
        id: 'amenity-test-002',
        name: 'Parking',
        slug: 'parking',
        description: 'Free on-site parking',
        icon: 'car'
    }
];

/** Mock accommodation feature (no dedicated fixture file) */
const mockFeature = {
    id: 'feature-test-001',
    name: 'Pool',
    slug: 'pool',
    description: 'Outdoor swimming pool',
    icon: 'pool',
    isBuiltin: true,
    isFeatured: true,
    lifecycleState: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
} as const;

const mockFeatureList = [
    mockFeature,
    {
        ...mockFeature,
        id: 'feature-test-002',
        name: 'Garden',
        slug: 'garden',
        description: 'Private garden area',
        icon: 'tree'
    }
];

/** Mock destination attraction (no dedicated fixture file) */
const mockAttraction = {
    id: 'attr-test-001',
    name: 'Playa Banco Pelay',
    slug: 'playa-banco-pelay',
    description: 'Popular river beach with white sand',
    icon: 'beach',
    isBuiltin: true,
    isFeatured: true,
    destinationId: 'dest-test-001',
    lifecycleState: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
} as const;

const mockAttractionList = [
    mockAttraction,
    {
        ...mockAttraction,
        id: 'attr-test-002',
        name: 'Termas de Villa Elisa',
        slug: 'termas-villa-elisa',
        description: 'Hot springs resort',
        icon: 'thermometer'
    }
];

/** Mock billing payment (no dedicated fixture file) */
const mockBillingPayment = {
    id: 'payment-test-001',
    subscriptionId: 'sub-test-001',
    customerId: 'customer-uuid-001',
    customerEmail: 'owner@example.com',
    amount: 500000,
    currency: 'ARS',
    status: 'approved',
    paymentMethod: 'credit_card',
    externalId: 'mp-payment-001',
    paidAt: '2026-02-01T10:00:00.000Z',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z'
} as const;

const mockBillingPaymentList = [
    mockBillingPayment,
    {
        ...mockBillingPayment,
        id: 'payment-test-002',
        amount: 1500000,
        status: 'pending',
        externalId: 'mp-payment-002',
        paidAt: null
    },
    {
        ...mockBillingPayment,
        id: 'payment-test-003',
        amount: 350000,
        status: 'rejected',
        externalId: 'mp-payment-003',
        paidAt: null
    }
];

// ---------------------------------------------------------------------------
// Handler factory
// ---------------------------------------------------------------------------

/**
 * Creates a standard set of CRUD handlers for a paginated admin entity.
 *
 * Generates handlers for:
 * - GET  /admin/{entityPath}      -> paginated list
 * - GET  /admin/{entityPath}/:id  -> single item
 * - POST /admin/{entityPath}      -> create (201)
 * - PATCH /admin/{entityPath}/:id -> update
 * - DELETE /admin/{entityPath}/:id -> soft delete
 */
function createEntityHandlers({
    entityPath,
    mockItem,
    mockList
}: {
    readonly entityPath: string;
    readonly mockItem: unknown;
    readonly mockList: readonly unknown[];
}) {
    return [
        http.get(`${API_BASE}/admin/${entityPath}`, () =>
            HttpResponse.json(mockPaginatedResponse([...mockList]))
        ),
        http.get(`${API_BASE}/admin/${entityPath}/:id`, () =>
            HttpResponse.json(mockSuccessResponse(mockItem))
        ),
        http.post(`${API_BASE}/admin/${entityPath}`, () =>
            HttpResponse.json(mockSuccessResponse(mockItem), { status: 201 })
        ),
        http.patch(`${API_BASE}/admin/${entityPath}/:id`, () =>
            HttpResponse.json(mockSuccessResponse(mockItem))
        ),
        http.delete(`${API_BASE}/admin/${entityPath}/:id`, () =>
            HttpResponse.json(mockSuccessResponse({ deleted: true }))
        )
    ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all admin MSW handlers for the admin panel.
 *
 * Includes CRUD handlers for paginated entities and custom handlers for
 * non-paginated endpoints (billing plans, add-ons, cron, metrics, roles, etc.).
 */
export function getAdminHandlers() {
    return [
        // ---------------------------------------------------------------
        // Paginated entities (standard CRUD via factory)
        // ---------------------------------------------------------------

        // Core entities
        ...createEntityHandlers({
            entityPath: 'accommodations',
            mockItem: mockAccommodation,
            mockList: mockAccommodationList
        }),
        ...createEntityHandlers({
            entityPath: 'destinations',
            mockItem: mockDestination,
            mockList: mockDestinationList
        }),
        ...createEntityHandlers({
            entityPath: 'events',
            mockItem: mockEvent,
            mockList: mockEventList
        }),
        ...createEntityHandlers({
            entityPath: 'event-locations',
            mockItem: mockEventLocation,
            mockList: mockEventLocationList
        }),
        ...createEntityHandlers({
            entityPath: 'event-organizers',
            mockItem: mockEventOrganizer,
            mockList: mockEventOrganizerList
        }),

        // Content sub-entities
        ...createEntityHandlers({
            entityPath: 'amenities',
            mockItem: mockAmenity,
            mockList: mockAmenityList
        }),
        ...createEntityHandlers({
            entityPath: 'features',
            mockItem: mockFeature,
            mockList: mockFeatureList
        }),
        ...createEntityHandlers({
            entityPath: 'attractions',
            mockItem: mockAttraction,
            mockList: mockAttractionList
        }),

        // Other paginated entities
        ...createEntityHandlers({
            entityPath: 'sponsors',
            mockItem: mockSponsor,
            mockList: mockSponsorList
        }),
        ...createEntityHandlers({
            entityPath: 'posts',
            mockItem: mockPost,
            mockList: mockPostList
        }),
        ...createEntityHandlers({
            entityPath: 'tags',
            mockItem: mockTag,
            mockList: mockTagList
        }),
        ...createEntityHandlers({
            entityPath: 'users',
            mockItem: mockUser,
            mockList: mockUserList
        }),

        // Billing paginated entities
        ...createEntityHandlers({
            entityPath: 'billing/subscriptions',
            mockItem: mockBillingSubscription,
            mockList: mockBillingSubscriptionList
        }),
        ...createEntityHandlers({
            entityPath: 'billing/invoices',
            mockItem: mockBillingInvoice,
            mockList: mockBillingInvoiceList
        }),
        ...createEntityHandlers({
            entityPath: 'billing/payments',
            mockItem: mockBillingPayment,
            mockList: mockBillingPaymentList
        }),
        ...createEntityHandlers({
            entityPath: 'billing/promo-codes',
            mockItem: mockPromoCode,
            mockList: mockPromoCodeList
        }),
        ...createEntityHandlers({
            entityPath: 'billing/owner-promotions',
            mockItem: mockOwnerPromotion,
            mockList: mockOwnerPromotionList
        }),
        ...createEntityHandlers({
            entityPath: 'billing/sponsorships',
            mockItem: mockSponsorship,
            mockList: mockSponsorshipList
        }),
        ...createEntityHandlers({
            entityPath: 'billing/webhook-events',
            mockItem: mockWebhookEvent,
            mockList: mockWebhookEventList
        }),
        ...createEntityHandlers({
            entityPath: 'billing/notification-logs',
            mockItem: mockNotificationLog,
            mockList: mockNotificationLogList
        }),

        // ---------------------------------------------------------------
        // Non-paginated entities (custom handlers)
        // ---------------------------------------------------------------

        // Billing plans (returns array directly, not paginated)
        http.get(`${API_BASE}/admin/billing/plans`, () =>
            HttpResponse.json(mockSuccessResponse([...mockBillingPlanList]))
        ),
        http.get(`${API_BASE}/admin/billing/plans/:id`, () =>
            HttpResponse.json(mockSuccessResponse(mockBillingPlanList[0]))
        ),
        http.post(`${API_BASE}/admin/billing/plans`, () =>
            HttpResponse.json(mockSuccessResponse(mockBillingPlanList[0]), { status: 201 })
        ),
        http.patch(`${API_BASE}/admin/billing/plans/:id`, () =>
            HttpResponse.json(mockSuccessResponse(mockBillingPlanList[0]))
        ),

        // Billing add-ons (returns array directly, not paginated)
        http.get(`${API_BASE}/admin/billing/addons`, () =>
            HttpResponse.json(mockSuccessResponse([...mockBillingAddonList]))
        ),
        http.get(`${API_BASE}/admin/billing/addons/:id`, () =>
            HttpResponse.json(mockSuccessResponse(mockBillingAddon))
        ),
        http.post(`${API_BASE}/admin/billing/addons`, () =>
            HttpResponse.json(mockSuccessResponse(mockBillingAddon), { status: 201 })
        ),
        http.patch(`${API_BASE}/admin/billing/addons/:id`, () =>
            HttpResponse.json(mockSuccessResponse(mockBillingAddon))
        ),

        // Billing cron jobs
        http.get(`${API_BASE}/admin/billing/cron`, () =>
            HttpResponse.json(
                mockSuccessResponse({
                    jobs: [],
                    totalJobs: 0,
                    enabledJobs: 0
                })
            )
        ),
        http.post(`${API_BASE}/admin/billing/cron/:jobId/trigger`, () =>
            HttpResponse.json(
                mockSuccessResponse({
                    triggered: true,
                    jobId: 'test-job'
                })
            )
        ),

        // Billing metrics
        http.get(`${API_BASE}/admin/billing/metrics`, () =>
            HttpResponse.json(mockSuccessResponse({}))
        ),
        http.get(`${API_BASE}/admin/billing/metrics/system-usage`, () =>
            HttpResponse.json(mockSuccessResponse({}))
        ),
        http.get(`${API_BASE}/admin/billing/metrics/approaching-limits`, () =>
            HttpResponse.json(mockSuccessResponse([]))
        ),

        // Billing exchange rates
        http.get(`${API_BASE}/admin/exchange-rates/config`, () =>
            HttpResponse.json(mockSuccessResponse({}))
        ),
        http.patch(`${API_BASE}/admin/exchange-rates/config`, () =>
            HttpResponse.json(mockSuccessResponse({}))
        ),

        // Roles (read-only, non-paginated)
        http.get(`${API_BASE}/admin/roles`, () =>
            HttpResponse.json(mockSuccessResponse([...mockRoleList]))
        ),

        // Permissions (read-only, non-paginated)
        http.get(`${API_BASE}/admin/permissions`, () => HttpResponse.json(mockSuccessResponse([])))
    ];
}
