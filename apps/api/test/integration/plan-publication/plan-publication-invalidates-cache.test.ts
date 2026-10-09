import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { getRedisClient } from '../../../src/utils/redis';
import { testDb } from '../../e2e/setup/test-database';
import {
    insertPlan,
    publishBody,
    publishUrl,
    superAdmin,
    truncatePlanCatalog
} from './plan-publication.helpers.js';

vi.mock('../../../src/utils/redis', () => ({ getRedisClient: vi.fn() }));

class FakeRedis {
    readonly values = new Map<string, string>();
    incr = vi.fn(async (key: string) => {
        const next = Number(this.values.get(key) ?? '0') + 1;
        this.values.set(key, String(next));
        return next;
    });
    get = vi.fn(async (key: string) => this.values.get(key) ?? null);
    pexpire = vi.fn(async () => 1);
    hget = vi.fn(async () => null);
    hset = vi.fn(async () => 1);
}

const redis = new FakeRedis();

describe('TEST:V3:8 plan publication invalidates the effective-set cache', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });
    beforeEach(async () => {
        await truncatePlanCatalog();
        redis.values.clear();
        redis.incr.mockClear();
        vi.mocked(getRedisClient).mockResolvedValue(redis as never);
    });
    afterAll(async () => testDb.teardown());

    it('TEST:V3:8 publishing any plan version increments the global generation after commit', async () => {
        const app = initApp();
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'basic' });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ overrides: {} })
        });
        expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
        expect(redis.values.get('vset:v1:gen:all')).toBe('1');
        expect(redis.incr).toHaveBeenCalledWith('vset:v1:gen:all');
    });

    it('TEST:V3:8 a failed invalidation does not fail publication', async () => {
        const app = initApp();
        redis.incr.mockRejectedValueOnce(new Error('Redis unavailable'));
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'basic' });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ overrides: {} })
        });
        expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
        expect(redis.incr).toHaveBeenCalledWith('vset:v1:gen:all');
    });
});

describe('TEST:V3:8 plan publication has one API caller', () => {
    it('fails when another apps source imports publishPlanVersion', () => {
        const appsRoot = resolve(import.meta.dirname, '../../../../');
        const files: string[] = [];
        function visit(directory: string): void {
            for (const entry of readdirSync(directory, { withFileTypes: true })) {
                if (entry.name === 'node_modules' || entry.name === 'dist') continue;
                const path = join(directory, entry.name);
                if (entry.isDirectory()) visit(path);
                else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
                    files.push(path);
            }
        }
        visit(appsRoot);
        const callers = files
            .filter((file) =>
                /import\s*\{[^}]*\bpublishPlanVersion\b[^}]*\}\s*from\s*['"]@repo\/service-core['"]/.test(
                    readFileSync(file, 'utf8')
                )
            )
            .map((file) => relative(appsRoot, file));
        expect(callers).toEqual(['api/src/routes/plan-catalog/admin/index.ts']);
    });
});
