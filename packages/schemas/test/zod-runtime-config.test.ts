import { afterEach, describe, expect, it, vi } from 'vitest';
import * as core from 'zod/v4/core';

/**
 * HOS-2558: in a browser under a CSP without `unsafe-eval`, Zod's `new Function`
 * probe is reported as a violation. The package entry turns on `jitless` there.
 */
describe('zod-runtime-config', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
        core.config({ jitless: false });
    });

    it('enables jitless when running in a browser', async () => {
        // Arrange
        core.config({ jitless: false });
        vi.stubGlobal('window', {});
        vi.stubGlobal('document', {});

        // Act
        await import('../src/zod-runtime-config.js');

        // Assert
        expect(core.globalConfig.jitless).toBe(true);
    });

    it('leaves the compiled fast path on in a server runtime', async () => {
        // Arrange
        core.config({ jitless: false });

        // Act
        await import('../src/zod-runtime-config.js');

        // Assert
        expect(core.globalConfig.jitless).toBeFalsy();
    });

    it('does not probe `new Function` when building an object schema in a browser', async () => {
        // Arrange
        vi.stubGlobal('window', {});
        vi.stubGlobal('document', {});
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
        await import('../src/zod-runtime-config.js');
        const { z } = await import('zod');

        // Act
        z.object({ a: z.string() }).parse({ a: 'x' });

        // Assert
        expect(probe).not.toHaveBeenCalled();
    });
});
