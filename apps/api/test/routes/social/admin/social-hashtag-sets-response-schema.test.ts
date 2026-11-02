/**
 * Route-level regression test for HOS-1986: the admin hashtag-sets list route's
 * declared `responseSchema` must accept rows whose nullable columns
 * (`notes`, `platform`) are NULL, otherwise one such row turns the whole
 * listing into a 500 "Response payload does not match declared schema".
 */
import { describe, expect, it, vi } from 'vitest';

type Parseable = { safeParse: (value: unknown) => { success: boolean } };

const { captured } = vi.hoisted(() => ({
    captured: { responseSchema: undefined as unknown }
}));

vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminListRoute: vi.fn((config: { responseSchema: unknown }) => {
        captured.responseSchema = config.responseSchema;
        return config;
    })
}));
vi.mock('../../../../src/utils/actor', () => ({ getActorFromContext: vi.fn() }));
vi.mock('@repo/service-core', () => ({
    SocialHashtagSetService: vi.fn(function () {
        return {};
    }),
    ServiceError: class ServiceError extends Error {}
}));

const row = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Brand',
    slug: 'brand',
    hashtagsText: '#Hospeda',
    priority: 0,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdById: null,
    updatedById: null
};

describe('admin hashtag-sets list responseSchema', () => {
    it('accepts a row with notes = NULL and platform = NULL', async () => {
        await import('../../../../src/routes/social/admin/hashtag-sets/list');
        const schema = captured.responseSchema as Parseable;
        expect(schema.safeParse({ ...row, notes: null, platform: null }).success).toBe(true);
    });

    it('accepts a row with a concrete platform and notes', async () => {
        await import('../../../../src/routes/social/admin/hashtag-sets/list');
        const schema = captured.responseSchema as Parseable;
        expect(schema.safeParse({ ...row, notes: 'x', platform: 'X' }).success).toBe(true);
    });
});
