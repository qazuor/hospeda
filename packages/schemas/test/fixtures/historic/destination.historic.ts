/**
 * Historic destination shape fixtures for the additive-only schema
 * compatibility policy. See `packages/schemas/docs/guides/schema-compat-policy.md`.
 *
 * These fixtures MUST continue to parse against the current `DestinationSchema`.
 * If a change breaks one of them, the change is breaking and must follow the
 * three-phase migration path before landing.
 *
 * Deterministic and static on purpose: no faker, no randomness. The `Date`
 * instances are fixed timestamps so diffs in this file are intentional history.
 *
 * NOTE: unlike the media fixtures this is not declared `as const` because the
 * audit fields are real `Date` objects (the schema uses `z.date()`), which a
 * `const` assertion cannot express as literals.
 */

/**
 * Pre-SPEC-158 destination. Captured from the destination detail shape that
 * existed before SPEC-158 added the optional `faqs` array and raised the
 * `description` maximum from 2000 to 8000. Key properties under test:
 *
 * - NO `faqs` key (the field did not exist) -> must still parse (faqs optional).
 * - `description` near the OLD 2000-char ceiling -> must still parse after the
 *   max was relaxed to 8000.
 */
export const destinationPreSpec158 = {
    id: '11111111-1111-4111-8111-111111111111',
    // Hierarchy
    parentDestinationId: null,
    destinationType: 'CITY',
    level: 4,
    path: '/argentina/litoral/entre-rios/historic-city',
    pathIds: '',
    // Entity
    slug: 'historic-city',
    name: 'Historic City',
    summary: 'A pre-SPEC-158 destination summary kept for schema compatibility testing.',
    description: 'Pre-SPEC-158 destination description. '.repeat(50).slice(0, 1950),
    isFeatured: false,
    // Lifecycle / moderation / visibility
    lifecycleState: 'ACTIVE',
    moderationState: 'APPROVED',
    visibility: 'PUBLIC',
    // Review aggregation
    reviewsCount: 0,
    averageRating: 0,
    // Audit
    createdAt: new Date('2025-06-01T12:00:00.000Z'),
    updatedAt: new Date('2025-06-02T12:00:00.000Z'),
    createdById: '22222222-2222-4222-8222-222222222222',
    updatedById: '22222222-2222-4222-8222-222222222222',
    // Location (required for destinations)
    location: {
        state: 'Entre Ríos',
        zipCode: 'E3260',
        country: 'Argentina',
        coordinates: {
            lat: '-32.4846',
            long: '-58.2306'
        }
    },
    // Media (required featuredImage container)
    media: {
        featuredImage: {
            url: 'https://res.cloudinary.com/hospeda/image/upload/v1/legacy/destination.webp',
            moderationState: 'APPROVED'
        }
    },
    accommodationsCount: 0
};
