import { addonProducts, addons, addonVersions, eq, getDb } from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import { validateApiEnv } from '../../../src/utils/env.js';
import { testDb } from '../../e2e/setup/test-database.js';
import {
    cleanPublicationRouteFixture,
    publicationActorHeaders,
    seedPublicationRouteFixture
} from './support/addon-version-publication-route-fixtures.js';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

type Fixture = Awaited<ReturnType<typeof seedPublicationRouteFixture>>;
const fixtures: Fixture[] = [];
let app: ReturnType<typeof initApp>;

function path(productId: string, preview = false) {
    return `/api/v1/admin/billing-addon-products/${productId}/version-publication${preview ? '/preview' : ''}`;
}

function body(f: Fixture) {
    return {
        addonVersionId: f.nextVersionId,
        price: f.price,
        expectedCurrentVersionId: f.currentVersionId,
        expectedCurrentPrice: f.price
    };
}

async function post(f: Fixture, input: Record<string, unknown>, preview = false, allowed = true) {
    return app.request(path(f.productId, preview), {
        method: 'POST',
        headers: publicationActorHeaders(f.actorId, allowed),
        body: JSON.stringify(input)
    });
}

async function fixture() {
    const value = await seedPublicationRouteFixture();
    fixtures.push(value);
    return value;
}

describe('TEST:B10:9 AC:B10:8 action 20 admin API', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp();
    });
    afterEach(async () => {
        audit.mockClear();
        for (const f of fixtures.splice(0)) await cleanPublicationRouteFixture(f);
    });
    afterAll(async () => testDb.teardown());

    it('previews changes and publishes a new version with audit and persisted product', async () => {
        const f = await fixture();
        const preview = await post(f, { addonVersionId: f.nextVersionId, price: f.price }, true);
        expect(preview.status).toBe(200);
        expect((await preview.json()).data).toMatchObject({
            changes: ['VERSION'],
            liveInstancesOnCurrentVersion: 0,
            current: { versionId: f.currentVersionId, price: f.price },
            proposed: { versionId: f.nextVersionId, price: f.price }
        });
        const published = await post(f, body(f));
        expect(published.status, JSON.stringify(await published.clone().json())).toBe(200);
        const [product] = await getDb()
            .select()
            .from(addonProducts)
            .where(eq(addonProducts.id, f.productId));
        expect(product?.versionId).toBe(f.nextVersionId);
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                resourceType: 'addon-product',
                resourceId: f.productId,
                metadata: expect.objectContaining({
                    administrativeAction: 'ACC_20',
                    previousVersionId: f.currentVersionId,
                    newVersionId: f.nextVersionId,
                    previousPrice: f.price,
                    newPrice: f.price,
                    currency: 'ARS'
                })
            })
        );
    });

    it('answers 403 before 400 without the action permission', async () => {
        const f = await fixture();
        for (const preview of [true, false]) {
            const response = await post(
                f,
                { addonVersionId: 'bad', validityDays: 42 },
                preview,
                false
            );
            expect(response.status).toBe(403);
            expect((await response.json()).error.code).toBe('FORBIDDEN');
        }
    });

    it('answers 401 without a session', async () => {
        const f = await fixture();
        const response = await app.request(path(f.productId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'vitest' },
            body: JSON.stringify(body(f))
        });
        expect(response.status).toBe(401);
    });

    it('answers 400 for a version edit in the strict body', async () => {
        const f = await fixture();
        const response = await post(f, { ...body(f), validityDays: 40 });
        expect(response.status).toBe(400);
    });

    it('answers 404 for a missing product', async () => {
        const f = await fixture();
        const response = await app.request(path(crypto.randomUUID()), {
            method: 'POST',
            headers: publicationActorHeaders(f.actorId),
            body: JSON.stringify(body(f))
        });
        expect(response.status).toBe(404);
        expect((await response.json()).error.reason).toBe('ADDON_PRODUCT_NOT_FOUND');
    });

    it('answers 409 for a version of another addon', async () => {
        const f = await fixture();
        const [other] = await getDb()
            .insert(addons)
            .values({
                slug: `other-publication-${crypto.randomUUID()}`,
                name: 'Other addon'
            })
            .returning({ id: addons.id });
        if (!other) throw new Error('Other addon missing');
        // A new vertical-owned addon version is seeded by INSERT (D-3).
        const [version] = await getDb()
            .insert(addonVersions)
            .values({
                addonId: other.id,
                validity: 'FIXED_DAYS',
                validityDays: 30,
                scopeType: 'USER'
            })
            .returning({ id: addonVersions.id });
        if (!version) throw new Error('Other version missing');
        const response = await post(f, { ...body(f), addonVersionId: version.id });
        expect(response.status).toBe(409);
        expect((await response.json()).error.reason).toBe('ADDON_VERSION_OF_ANOTHER_ADDON');
    });

    it('answers 409 when expected current state is stale', async () => {
        const f = await fixture();
        const response = await post(f, { ...body(f), expectedCurrentPrice: f.price + 1 });
        expect(response.status).toBe(409);
        expect((await response.json()).error.reason).toBe('ADDON_PRODUCT_CHANGED_SINCE_PREVIEW');
    });
});
