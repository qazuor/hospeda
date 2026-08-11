import type { User } from '@repo/schemas';
import { RoleEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeUserInput,
    normalizeViewInput
} from '../../../src/services/user/user.normalizers';

const baseUser = {
    displayName: ' John Doe ',
    firstName: ' John ',
    lastName: ' Doe ',
    contactInfo: { personalEmail: ' JOHN@EXAMPLE.COM ', mobilePhone: '+123456789' },
    slug: undefined
} as unknown as User;

const actor = { id: 'actor-id', roles: [RoleEnum.ADMIN], permissions: [] };

describe('user normalizers', () => {
    it('normalizeCreateInput trims displayName', () => {
        const input = { ...baseUser, displayName: ' John Doe ' };
        const result = normalizeCreateInput(input, actor);
        expect(result.displayName).toBe('John Doe');
    });

    it('normalizeUpdateInput trims displayName', () => {
        const input = { ...baseUser, displayName: ' Jane Smith ' };
        const result = normalizeUpdateInput(input, actor);
        expect(result.displayName).toBe('Jane Smith');
    });

    it('normalizeListInput returns the same object', () => {
        const params = { page: 1, pageSize: 10 };
        const result = normalizeListInput(params, actor);
        expect(result).toBe(params);
    });

    it('normalizeViewInput returns the same field and value', () => {
        const result = normalizeViewInput('slug', 'test-slug', actor);
        expect(result).toEqual({ field: 'slug', value: 'test-slug' });
    });

    it('normalizeUserInput trims all string fields and lowercases email', async () => {
        const input = {
            displayName: ' John Doe ',
            firstName: ' John ',
            lastName: ' Doe ',
            contactInfo: { personalEmail: ' JOHN@EXAMPLE.COM ', mobilePhone: '+123456789' }
        };
        vi.mock('../../../src/services/user/user.helpers', () => ({
            generateUserSlug: vi.fn().mockResolvedValue('john-doe')
        }));
        const result = await normalizeUserInput({ input, mode: 'create' });
        expect(result.displayName).toBe('John Doe');
        expect(result.firstName).toBe('John');
        expect(result.lastName).toBe('Doe');
        expect(result.contactInfo?.personalEmail).toBe('john@example.com');
        expect(result.slug).toBe('john-doe');
    });

    it('normalizeUserInput does not overwrite existing slug', async () => {
        const input = {
            displayName: 'Jane',
            slug: 'custom-slug'
        };
        const result = await normalizeUserInput({ input, mode: 'create' });
        expect(result.slug).toBe('custom-slug');
    });
});

/**
 * HOS-375 — `users.slug` is the public author URL (`/autores/<slug>/`), which is
 * now indexed and listed in the sitemap, and nothing issues a redirect from an
 * old one.
 *
 * Two rules follow, and both live here rather than on the write schemas: those
 * are published, so a `regex` on `slug` would be a forbidden narrowing, and the
 * slug is DERIVED — repairing a malformed one beats rejecting a value the
 * caller never typed.
 */
describe('normalizeUserInput — slug (HOS-375)', () => {
    it('does NOT regenerate the slug when an update changes displayName', async () => {
        // The regression. A user renaming themselves sends `{ displayName }`
        // and no slug; the old code read that as "derive a new slug" and
        // silently moved an indexed URL.
        const result = await normalizeUserInput({
            input: { displayName: 'Nombre Nuevo' },
            mode: 'update'
        });

        expect(result.slug).toBeUndefined();
    });

    it('does NOT regenerate the slug when an update changes firstName/lastName', async () => {
        const result = await normalizeUserInput({
            input: { firstName: 'Ana', lastName: 'Pérez' },
            mode: 'update'
        });

        expect(result.slug).toBeUndefined();
    });

    it('DOES derive a slug on create — non-vacuity for the two above', async () => {
        // Without this, "slug is undefined" would pass even if derivation had
        // been deleted outright instead of scoped to create.
        const result = await normalizeUserInput({
            input: { displayName: 'John Doe' },
            mode: 'create'
        });

        expect(result.slug).toBe('john-doe');
    });

    it('repairs a non-conforming slug rather than rejecting it', async () => {
        // The public route's `:slug` param regex is
        // `^[a-z0-9]+(?:[_-][a-z0-9]+)*$`. A value the caller supplies that
        // cannot address that route is coerced, not refused.
        const result = await normalizeUserInput({
            input: { slug: '  Equipo Hospeda!  ' },
            mode: 'update'
        });

        expect(result.slug).toBe('equipo-hospeda');
    });

    it('leaves an already-conforming slug byte-identical', async () => {
        // Repair must be a no-op on good input, or every save would churn the
        // URL it is meant to protect.
        for (const slug of ['equipo-hospeda', 'ana_perez', 'a1', 'x-1_y2']) {
            const result = await normalizeUserInput({ input: { slug }, mode: 'update' });
            expect(result.slug).toBe(slug);
        }
    });

    it('drops an unrepairable slug instead of persisting an empty one', async () => {
        // `users.slug` is NOT NULL and every author URL is built from it, so
        // "no change" beats "".
        const result = await normalizeUserInput({ input: { slug: '!!!' }, mode: 'update' });

        expect(result.slug).toBeUndefined();
        expect(Object.hasOwn(result, 'slug')).toBe(false);
    });
});
