import { addonProducts, eq, getDb, users } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import { AuditEventType } from '../../../src/utils/audit-logger.js';
import { validateApiEnv } from '../../../src/utils/env.js';
import { testDb } from '../../e2e/setup/test-database.js';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

const catalogPath = '/api/v1/admin/addon-catalog';
const productPath = '/api/v1/admin/billing-addon-products';
const addonId = crypto.randomUUID();
const paths = [
    ['read', 'GET', catalogPath],
    ['create addon', 'POST', `${catalogPath}/addons`],
    ['create version', 'POST', `${catalogPath}/addons/${addonId}/versions`],
    ['create product', 'POST', productPath]
] as const;
const actorIds: string[] = [];
const productIds: string[] = [];
let app: ReturnType<typeof initApp>;

async function actorId() {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `addon-editor-${crypto.randomUUID()}@example.test`,
            displayName: 'Addon editor',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('Expected admin user');
    actorIds.push(user.id);
    return user.id;
}

function headers(input: { readonly id: string; readonly allowed: boolean }) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': input.id,
        'x-mock-actor-role': input.allowed ? 'SUPER_ADMIN' : 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(
            input.allowed
                ? [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_PUBLISH_ADDON_VERSION]
                : [PermissionEnum.ACCESS_PANEL_ADMIN]
        )
    };
}

const firstVersion = {
    validity: 'FIXED_DAYS',
    validityDays: 30,
    scopeType: 'USER',
    entitlements: [],
    limits: []
};

async function post(path: string, id: string, body: unknown) {
    return app.request(path, {
        method: 'POST',
        headers: headers({ id, allowed: true }),
        body: JSON.stringify(body)
    });
}

async function data(response: Response) {
    return (await response.json()) as {
        data: Record<string, unknown>;
        error?: { code: string; reason?: string };
    };
}

describe('TEST:B13b:3 AC:B13b:3 the action 20 editor routes', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp();
    });
    afterEach(async () => {
        audit.mockClear();
        for (const id of productIds.splice(0)) {
            await getDb().delete(addonProducts).where(eq(addonProducts.id, id));
        }
        for (const id of actorIds.splice(0)) {
            await getDb().delete(users).where(eq(users.id, id));
        }
    });
    afterAll(async () => testDb.teardown());

    it('SUPER_ADMIN creates an addon, a version and a product, then reads the composed catalog', async () => {
        const id = await actorId();
        const slug = `editor-${crypto.randomUUID()}`;
        const created = await post(`${catalogPath}/addons`, id, {
            slug,
            name: 'Editor addon',
            description: null,
            firstVersion
        });
        expect(created.status, JSON.stringify(await created.clone().json())).toBe(201);
        const first = (await data(created)).data as {
            addon: { id: string };
            version: { id: string };
        };
        const second = await post(`${catalogPath}/addons/${first.addon.id}/versions`, id, {
            ...firstVersion,
            validityDays: 60
        });
        expect(second.status, JSON.stringify(await second.clone().json())).toBe(201);
        const secondId = ((await data(second)).data as { id: string }).id;
        const product = await post(productPath, id, {
            addonId: first.addon.id,
            versionId: secondId,
            price: 5000,
            chargeKind: 'UNA_VEZ',
            cycle: null,
            compatibleVerticals: ['accommodation']
        });
        expect(product.status, JSON.stringify(await product.clone().json())).toBe(201);
        const productId = ((await data(product)).data as { id: string }).id;
        productIds.push(productId);

        const read = await app.request(catalogPath, { headers: headers({ id, allowed: true }) });
        expect(read.status).toBe(200);
        const catalog = (await data(read)).data as { items: Array<Record<string, unknown>> };
        const item = catalog.items.find((entry) => entry.id === first.addon.id);
        expect(item).toEqual({
            id: first.addon.id,
            slug,
            name: 'Editor addon',
            description: null,
            versions: [
                {
                    id: first.version.id,
                    addonId: first.addon.id,
                    validity: 'FIXED_DAYS',
                    validityDays: 30,
                    scopeType: 'USER',
                    entitlements: [],
                    limits: [],
                    liveInstances: 0
                },
                {
                    id: secondId,
                    addonId: first.addon.id,
                    validity: 'FIXED_DAYS',
                    validityDays: 60,
                    scopeType: 'USER',
                    entitlements: [],
                    limits: [],
                    liveInstances: 0
                }
            ],
            product: {
                id: productId,
                versionId: secondId,
                price: 5000,
                currency: 'ARS',
                chargeKind: 'UNA_VEZ',
                cycle: null,
                compatibleVerticals: ['accommodation']
            }
        });
        expect(audit).toHaveBeenCalledTimes(3);
        expect(
            audit.mock.calls.map(([entry]) => ({
                auditEvent: entry.auditEvent,
                action: entry.action,
                resourceId: entry.resourceId,
                administrativeAction: entry.metadata.administrativeAction
            }))
        ).toEqual([
            {
                auditEvent: AuditEventType.BILLING_MUTATION,
                action: 'create',
                resourceId: first.addon.id,
                administrativeAction: 'ACC_20'
            },
            {
                auditEvent: AuditEventType.BILLING_MUTATION,
                action: 'create',
                resourceId: secondId,
                administrativeAction: 'ACC_20'
            },
            {
                auditEvent: AuditEventType.BILLING_MUTATION,
                action: 'create',
                resourceId: productId,
                administrativeAction: 'ACC_20'
            }
        ]);
    });

    it.each(
        paths
    )('a real ADMIN without action permission gets 403 on %s', async (_label, method, path) => {
        const id = await actorId();
        const response = await app.request(path, {
            method,
            headers: headers({ id, allowed: false }),
            body: method === 'POST' ? '{}' : undefined
        });
        expect(response.status).toBe(403);
        expect((await data(response)).error?.code).toBe('FORBIDDEN');
    });

    it.each(paths)('no session gets 401 on %s', async (_label, method, path) => {
        const response = await app.request(path, {
            method,
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: method === 'POST' ? '{}' : undefined
        });
        expect(response.status).toBe(401);
        expect((await data(response)).error?.code).toBe('UNAUTHORIZED');
    });

    it('maps malformed input, missing addon and duplicate addon to 400, 404 and 409 codes', async () => {
        const id = await actorId();
        const malformed = await post(`${catalogPath}/addons`, id, {});
        expect([malformed.status, (await data(malformed)).error?.code]).toEqual([
            400,
            'VALIDATION_ERROR'
        ]);
        const missing = await post(
            `${catalogPath}/addons/${crypto.randomUUID()}/versions`,
            id,
            firstVersion
        );
        expect([missing.status, (await data(missing)).error?.code]).toEqual([404, 'NOT_FOUND']);
        const slug = `duplicate-${crypto.randomUUID()}`;
        const body = { slug, name: 'Duplicate', description: null, firstVersion };
        const first = await post(`${catalogPath}/addons`, id, body);
        expect(first.status).toBe(201);
        const duplicate = await post(`${catalogPath}/addons`, id, body);
        expect([duplicate.status, (await data(duplicate)).error?.code]).toEqual([
            409,
            'ALREADY_EXISTS'
        ]);
    });

    it('maps a missing product version and duplicate product to 404 and 409 codes', async () => {
        const id = await actorId();
        const created = await post(`${catalogPath}/addons`, id, {
            slug: `product-${crypto.randomUUID()}`,
            name: 'Product contract',
            description: null,
            firstVersion
        });
        expect(created.status).toBe(201);
        const { addon, version } = (await data(created)).data as {
            addon: { id: string };
            version: { id: string };
        };
        const input = {
            addonId: addon.id,
            versionId: crypto.randomUUID(),
            price: 5000,
            chargeKind: 'UNA_VEZ',
            cycle: null,
            compatibleVerticals: ['accommodation']
        };
        const missing = await post(productPath, id, input);
        expect([missing.status, (await data(missing)).error?.code]).toEqual([404, 'NOT_FOUND']);
        const product = await post(productPath, id, { ...input, versionId: version.id });
        expect(product.status).toBe(201);
        productIds.push(((await data(product)).data as { id: string }).id);
        const duplicate = await post(productPath, id, { ...input, versionId: version.id });
        expect([duplicate.status, (await data(duplicate)).error?.code]).toEqual([
            409,
            'ALREADY_EXISTS'
        ]);
    });
});
