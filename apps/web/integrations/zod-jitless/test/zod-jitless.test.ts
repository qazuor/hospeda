/**
 * @file zod-jitless.test.ts
 * @description HOS-2558: the client-only Vite plugin that turns Zod's `jitless` on
 * inside Zod's core module, so no browser bundle reaches `new Function` under the CSP,
 * whatever imports `zod` first. The production-output proof is
 * `scripts/verify-zod-jitless-build.mjs`; these tests pin the plugin and its wiring.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { runInThisContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as core from 'zod/v4/core';
import { ZOD_GLOBAL_CONFIG_KEY, ZOD_JITLESS_STATEMENT, zodJitlessClientPlugin } from '../index';

const require = createRequire(import.meta.url);
const zodCorePath = join(dirname(require.resolve('zod/v4/core')), 'core.js');
const zodCoreSource = readFileSync(zodCorePath, 'utf8');

const plugin = zodJitlessClientPlugin();
const clientContext = { environment: { config: { consumer: 'client' } } };
const serverContext = { environment: { config: { consumer: 'server' } } };

describe('zodJitlessClientPlugin (HOS-2558)', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        core.config({ jitless: false });
    });

    it('appends the jitless statement to Zod core in a client bundle, moving no code', () => {
        const result = plugin.transform.call(clientContext, zodCoreSource, zodCorePath);

        expect(result?.code.startsWith(zodCoreSource)).toBe(true);
        expect(result?.code.endsWith(ZOD_JITLESS_STATEMENT)).toBe(true);
        expect(result?.map).toBeNull();
    });

    it('matches the core module with a query suffix and from the dev pre-bundler (no environment)', () => {
        expect(
            plugin.transform.call(undefined, zodCoreSource, `${zodCorePath}?v=1`)
        ).not.toBeNull();
    });

    it('leaves server bundles on the compiled fast path', () => {
        expect(plugin.transform.call(serverContext, zodCoreSource, zodCorePath)).toBeNull();
        expect(
            plugin.transform.call(undefined, zodCoreSource, zodCorePath, { ssr: true })
        ).toBeNull();
    });

    it('ignores every module other than Zod core', () => {
        const other = join(dirname(zodCorePath), 'schemas.js');
        expect(plugin.transform.call(clientContext, 'export {}', other)).toBeNull();
        expect(
            plugin.transform.call(clientContext, 'export {}', '/app/src/lib/core.js')
        ).toBeNull();
    });

    it('fails the build when a Zod upgrade stops reading the global config', () => {
        expect(() =>
            plugin.transform.call(clientContext, 'export const globalConfig = {};', zodCorePath)
        ).toThrow(/no longer reads globalThis\.__zod_globalConfig/);
    });

    it('the installed Zod still keeps its config on the global the plugin writes', () => {
        expect(zodCoreSource).toContain(ZOD_GLOBAL_CONFIG_KEY);
        expect((globalThis as Record<string, unknown>)[ZOD_GLOBAL_CONFIG_KEY]).toBe(
            core.globalConfig
        );
    });

    it('the appended statement makes an object schema skip the `new Function` probe', async () => {
        // Arrange: a browser-like realm where nothing called z.config()
        core.config({ jitless: false });
        const probe = vi.fn();
        const original = globalThis.Function;
        vi.stubGlobal(
            'Function',
            new Proxy(original, {
                construct(target, args) {
                    probe(args);
                    return Reflect.construct(target, args);
                }
            })
        );

        // Act: run exactly what the plugin appends, then build a schema in a fresh module graph
        runInThisContext(ZOD_JITLESS_STATEMENT);
        vi.resetModules();
        const { z } = await import('zod');
        z.object({ a: z.string() }).parse({ a: 'x' });

        // Assert
        expect(core.globalConfig.jitless).toBe(true);
        expect(probe).not.toHaveBeenCalled();
    });

    it('is registered for the production build and for the dev pre-bundle', () => {
        const config = readFileSync(resolve(__dirname, '../../../astro.config.mjs'), 'utf8');
        const calls = config.match(/zodJitlessClientPlugin\(\)/g) ?? [];

        expect(calls).toHaveLength(2);
        expect(config).toMatch(/rolldownOptions:\s*{\s*plugins:\s*\[zodJitlessClientPlugin\(\)\]/);
    });
});
