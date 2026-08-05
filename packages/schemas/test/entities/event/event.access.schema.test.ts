import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
    EventAdminSchema,
    EventAuthorPublicSchema,
    EventProtectedSchema,
    EventPublicSchema
} from '../../../src/entities/event/event.access.schema.js';
import { EventLocationAddressSchema } from '../../../src/entities/eventLocation/eventLocation.address.schema.js';
import { createValidEvent } from '../../fixtures/event.fixtures.js';

/**
 * HOS-300 — end-to-end repro of the `/api/v1/admin/events` 500.
 *
 * `createPaginatedResponse` runs `stripWithSchema(item, EventAdminSchema)` per
 * item and is fail-closed: a single item that does not parse turns the WHOLE
 * paginated response into a 500. A production `event_locations` row carries a
 * 65-char street while the write max was 50, so both events pointing at that
 * venue poisoned every page of the admin list — down to `pageSize=1`, since the
 * default sort is `createdAt:desc`.
 *
 * The same issue ALSO raised the write bound to 150, which makes that 65-char
 * value legal on the write schema now. So the guard below is expressed against
 * the CURRENT bound ({@link OVER_MAX_STREET}, derived from the schema) rather
 * than the incident payload — otherwise it would pass identically against a
 * strict-derived read schema and prove nothing. The production value is still
 * pinned separately, since it is the literal symptom of the issue.
 *
 * The eagerly-loaded `location` relation is the payload that must not throw.
 */

/** Verbatim production value of `event_locations.street` for "Palacio San José". */
const PROD_LONG_STREET = 'Ruta Provincial N.º 39, km 128 (zona rural, Departamento Uruguay)';

/**
 * Write-side maximum for `street`, read off the schema rather than hardcoded.
 * Throws when the bound disappears: `maxLength` would be `null` and the derived
 * over-max value would degenerate into a 1-char string, silently gutting the
 * guard. See the same derivation in `eventLocation.access.schema.test.ts`.
 */
const streetWriteMaxOrNull = EventLocationAddressSchema.shape.street.unwrap().unwrap().maxLength;
if (typeof streetWriteMaxOrNull !== 'number') {
    throw new Error(
        'HOS-300 test guard: `EventLocationAddressSchema.shape.street` no longer declares a `.max()` bound. This repro derives its over-max value from it and cannot express read⊇write without it.'
    );
}
const STREET_WRITE_MAX = streetWriteMaxOrNull;

/** A street longer than whatever the current write bound is. */
const OVER_MAX_STREET = 'A'.repeat(STREET_WRITE_MAX + 1);

const eventWithLocationStreet = (street: string) => ({
    ...createValidEvent(),
    location: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        slug: 'palacio-san-jose',
        destinationId: '550e8400-e29b-41d4-a716-446655440001',
        placeName: 'Palacio San José',
        coordinates: { lat: '-32.1833', long: '-58.6667' },
        street,
        number: '128',
        lifecycleState: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: null,
        updatedById: null
    }
});

describe('Event read schemas — HOS-300 admin list 500', () => {
    it('EventAdminSchema parses an event whose location street exceeds the current write max', () => {
        const result = EventAdminSchema.safeParse(eventWithLocationStreet(OVER_MAX_STREET));

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.location?.street).toBe(OVER_MAX_STREET);
        }
    });

    it('EventProtectedSchema parses the same event', () => {
        const result = EventProtectedSchema.safeParse(eventWithLocationStreet(OVER_MAX_STREET));

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.location?.street).toBe(OVER_MAX_STREET);
        }
    });

    it('EventAdminSchema parses the real production row that caused the 500', () => {
        // Incident fact, not a read⊇write proof: the 65-char street fits the
        // raised 150 bound, so this passes on strict schemas too.
        expect(PROD_LONG_STREET.length).toBeLessThanOrEqual(STREET_WRITE_MAX);

        const result = EventAdminSchema.safeParse(eventWithLocationStreet(PROD_LONG_STREET));

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.location?.street).toBe(PROD_LONG_STREET);
        }
    });
});

/**
 * HOS-375 §6.9 (G-7) — the public event payload gained an `author` relation so
 * the event detail page can render a byline linking to `/autores/<slug>/`.
 *
 * `EventService` was already eager-loading the relation; the schema was what
 * discarded it, because `stripWithSchema` drops every key the response schema
 * does not declare. These tests pin the two properties that make the addition
 * safe: it is ADDITIVE (a payload without the key still parses, per the
 * package's additive-only compat policy) and it is PUBLIC-TIER ONLY (the raw
 * `users` row the JOIN returns is projected down, never forwarded whole).
 */
describe('EventPublicSchema — author relation (HOS-375 G-7)', () => {
    /**
     * `createValidEvent()` ships a plain coordinates blob under `location`,
     * which is NOT the `EventLocation` relation `EventPublicSchema` declares —
     * the admin/protected tests above only pass because they overwrite that key
     * with a real venue row. These tests exercise the `author` relation and
     * nothing else, so the mismatched key is dropped rather than filled in.
     */
    const publicEventBase = () => {
        const { location: _location, ...event } = createValidEvent();
        return event;
    };

    /**
     * A verbatim `users` row as the Drizzle `author` relation returns it: the
     * whole record, private columns included. The public payload must expose
     * only the public-tier subset of this.
     */
    const rawAuthorRow = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        displayName: 'Laura Vega',
        firstName: 'Laura',
        lastName: 'Vega',
        slug: 'laura-vega',
        image: 'https://cdn.hospeda.test/avatars/laura-vega.jpg',
        // Private columns that must NOT survive the projection.
        email: 'laura.vega@hospeda.test',
        password: 'hashed-secret',
        phone: '+5493442123456',
        settings: { publicProfileShowSocialNetworks: false },
        contactInfo: { personalEmail: 'laura@personal.test' },
        isSystemAccount: false,
        deletedAt: null
    };

    it('parses a historic payload that carries no author key at all', () => {
        const historic = publicEventBase();
        expect(historic).not.toHaveProperty('author');

        const result = EventPublicSchema.safeParse(historic);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.author).toBeUndefined();
        }
    });

    it('parses an author of null — the FK is nullable on the row', () => {
        const result = EventPublicSchema.safeParse({ ...publicEventBase(), author: null });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.author).toBeNull();
        }
    });

    it('carries the author fields the byline needs when the relation is loaded', () => {
        const result = EventPublicSchema.safeParse({
            ...publicEventBase(),
            author: rawAuthorRow
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.author).toBeDefined();
            expect(result.data.author?.id).toBe(rawAuthorRow.id);
            expect(result.data.author?.displayName).toBe('Laura Vega');
            // The byline's link target — without it there is no author page to
            // point at, which is the entire purpose of the relation.
            expect(result.data.author?.slug).toBe('laura-vega');
            expect(result.data.author?.image).toBe(rawAuthorRow.image);
        }
    });

    it('strips every private user column out of the loaded author', () => {
        const result = EventPublicSchema.safeParse({
            ...publicEventBase(),
            author: rawAuthorRow
        });

        expect(result.success).toBe(true);
        if (result.success) {
            const author = result.data.author as Record<string, unknown>;
            for (const leaked of [
                'email',
                'password',
                'phone',
                'settings',
                'contactInfo',
                'deletedAt'
            ]) {
                expect(author).not.toHaveProperty(leaked);
            }
        }
    });

    /**
     * The author relation was first declared as `UserPublicSchema`, which is a
     * wider projection than a byline needs and is fail-CLOSED on its avatar.
     * These two cases pin the narrowing.
     */
    describe('EventAuthorPublicSchema — the narrowed projection', () => {
        it('drops the real name and the account roles', () => {
            // `firstName`/`lastName` are the person's real name, a different
            // class of data from the display name they chose to publish;
            // `roles` describes account privileges and has no business in an
            // events payload. All three shipped on every event of every LIST
            // page under `UserPublicSchema`.
            const result = EventPublicSchema.safeParse({
                ...publicEventBase(),
                author: { ...rawAuthorRow, roles: ['ADMIN'], avatarUrl: 'https://x.test/a.jpg' }
            });

            expect(result.success).toBe(true);
            if (!result.success) return;

            const author = result.data.author as Record<string, unknown>;
            for (const dropped of ['firstName', 'lastName', 'roles', 'avatarUrl']) {
                expect(author).not.toHaveProperty(dropped);
            }
            // Non-vacuity: the fields the byline DOES need survived.
            expect(author.displayName).toBe('Laura Vega');
            expect(author.slug).toBe('laura-vega');
            expect(author.image).toBe(rawAuthorRow.image);
        });

        it('accepts a malformed avatar instead of failing the response closed', () => {
            // `users.image` is an unbounded nullable `text` column Better Auth
            // writes directly, bypassing the write schemas. `stripWithSchema`
            // is fail-closed and `createPaginatedResponse` runs it per item, so
            // under a strict `.url()` this one row would 500 EVERY page of
            // `/api/v1/public/events` for every visitor.
            //
            // The property under test is 500-PREVENTION, and nothing more: the
            // schema must not reject. It deliberately does NOT erase the value
            // (that used to be `.catch(undefined)`, which `@hono/zod-openapi`
            // cannot render — it broke the whole global OpenAPI document).
            // Keeping the junk out of an `<img>` is the CONSUMER's job now; see
            // `apps/web/test/lib/media.renderable-image-url.test.ts` and
            // `apps/web/test/lib/api/transforms.author-avatar.test.ts`.
            const result = EventPublicSchema.safeParse({
                ...publicEventBase(),
                author: { ...rawAuthorRow, image: 'not-a-url' }
            });

            expect(result.success).toBe(true);
            if (!result.success) return;

            const author = result.data.author as Record<string, unknown>;
            expect(author.image).toBe('not-a-url');
            // The byline still renders.
            expect(author.displayName).toBe('Laura Vega');
            expect(author.slug).toBe('laura-vega');
        });

        it('does not render `image` through a ZodCatch (global OpenAPI doc guard)', () => {
            // Regression pin: `.catch()` here made `getOpenAPIDocument()` throw
            // ("Unknown zod object type"), which 500s `/docs/openapi.json` and
            // breaks `/docs`, `/reference` and `/ui` in EVERY environment —
            // because the OpenAPI document is global, not per-route.
            //
            // This pins the outermost wrapper only — a `.catch()` buried deeper
            // would slip past. The authoritative, nesting-proof guard is
            // `apps/api`'s `test/routes/openapi-doc-generation.test.ts`, which
            // builds the real document; this assertion just fails FASTER and
            // names the culprit field.
            expect(EventAuthorPublicSchema.shape.image instanceof z.ZodCatch).toBe(false);
        });

        it('does not 500 on an empty displayName either', () => {
            // Production really holds `display_name = ''` rows (HOS-302).
            const result = EventPublicSchema.safeParse({
                ...publicEventBase(),
                author: { ...rawAuthorRow, displayName: '' }
            });

            expect(result.success).toBe(true);
        });
    });
});
