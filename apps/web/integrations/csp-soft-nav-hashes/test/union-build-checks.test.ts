/**
 * @file union-build-checks.test.ts
 * @description Unit tests for the checks that make `astro build` fail when the
 * CSP soft-nav union cannot be trusted (HOS-807).
 *
 * AAA pattern.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOFT_NAV_SCRIPT_HASHES_PLACEHOLDER } from '../../../src/lib/csp-soft-nav-placeholder';
import { DEPLOYMENT_CONSTANT_INLINE_SCRIPTS } from '../../../src/lib/csp-soft-nav-script-hashes';
import {
    checkRenderTimeScripts,
    RENDER_TIME_INLINE_SCRIPT_ALLOWLIST,
    replacePlaceholderOnce
} from '../union-build-checks';

const DYNAMIC = [{ openingTagAttributes: '', bodyPreview: '«expr»' }] as const;

describe('checkRenderTimeScripts', () => {
    it('fails a component with a render-time script that is not allowlisted, naming it', () => {
        // Act
        const result = checkRenderTimeScripts({
            dynamicByComponent: new Map([['src/components/New.astro', DYNAMIC]]),
            allowlist: []
        });

        // Assert
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('src/components/New.astro');
        expect(result.errors[0]).toContain('BLOCKED');
    });

    it('fails a stale allowlist entry whose component no longer emits a render-time script', () => {
        // Act
        const result = checkRenderTimeScripts({
            dynamicByComponent: new Map(),
            allowlist: [{ component: 'src/Old.astro', coverage: 'hashed-at-boot', reason: 'r' }]
        });

        // Assert
        expect(result.errors).toEqual([expect.stringContaining('src/Old.astro')]);
    });

    it('passes an allowlisted component and reports it', () => {
        // Arrange
        const entry = {
            component: 'src/A.astro',
            coverage: 'hashed-at-boot',
            reason: 'r'
        } as const;

        // Act
        const result = checkRenderTimeScripts({
            dynamicByComponent: new Map([['src/A.astro', DYNAMIC]]),
            allowlist: [entry]
        });

        // Assert
        expect(result.errors).toEqual([]);
        expect(result.allowed).toEqual([entry]);
    });
});

describe('RENDER_TIME_INLINE_SCRIPT_ALLOWLIST', () => {
    it('lists exactly the components whose constants are hashed at boot, and vice versa', () => {
        // Arrange
        const allowlistedAtBoot = RENDER_TIME_INLINE_SCRIPT_ALLOWLIST.filter(
            (entry) => entry.coverage === 'hashed-at-boot'
        ).map((entry) => entry.component);
        const hashedAtBoot = DEPLOYMENT_CONSTANT_INLINE_SCRIPTS.map((entry) => entry.component);

        // Assert
        expect([...allowlistedAtBoot].sort()).toEqual([...hashedAtBoot].sort());
    });
});

describe('replacePlaceholderOnce', () => {
    const placeholder = '__TEST_PLACEHOLDER__';
    const serialized = JSON.stringify(['sha256-a', "sha256-'b"]);

    it('replaces a double-quoted placeholder with a string literal holding the list', () => {
        // Arrange
        const files = [
            { file: 'a.mjs', text: 'const x = 1;' },
            { file: 'b.mjs', text: `const v = "${placeholder}";` }
        ];

        // Act
        const result = replacePlaceholderOnce({ files, placeholder, serialized });

        // Assert
        expect(result.file).toBe('b.mjs');
        const literal = result.text.slice('const v = '.length, -1);
        expect(JSON.parse(JSON.parse(literal))).toEqual(['sha256-a', "sha256-'b"]);
    });

    it('also accepts a single-quoted placeholder', () => {
        // Act
        const result = replacePlaceholderOnce({
            files: [{ file: 'a.mjs', text: `v='${placeholder}'` }],
            placeholder,
            serialized
        });

        // Assert
        expect(result.text).not.toContain(placeholder);
    });

    it('throws when the placeholder is missing from the bundle', () => {
        expect(() =>
            replacePlaceholderOnce({
                files: [{ file: 'a.mjs', text: '' }],
                placeholder,
                serialized
            })
        ).toThrow(/found it 0 time/);
    });

    it('throws when the placeholder appears more than once', () => {
        expect(() =>
            replacePlaceholderOnce({
                files: [
                    { file: 'a.mjs', text: `"${placeholder}"` },
                    { file: 'b.mjs', text: `'${placeholder}'` }
                ],
                placeholder,
                serialized
            })
        ).toThrow(/found it 2 time/);
    });
});

describe('placeholder source contract', () => {
    it('spells the full placeholder literal exactly once, in the runtime module', () => {
        // Arrange
        const runtime = readFileSync(
            resolve(__dirname, '../../../src/lib/csp-soft-nav-script-hashes.ts'),
            'utf8'
        );
        const shared = readFileSync(
            resolve(__dirname, '../../../src/lib/csp-soft-nav-placeholder.ts'),
            'utf8'
        );

        // Assert
        expect(runtime.split(`'${SOFT_NAV_SCRIPT_HASHES_PLACEHOLDER}'`)).toHaveLength(2);
        expect(shared).not.toContain(SOFT_NAV_SCRIPT_HASHES_PLACEHOLDER);
    });
});
