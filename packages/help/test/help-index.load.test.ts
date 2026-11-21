/**
 * HOS-2410 AC-14 — the wiring, not the schema: loading `src/help-index.ts`
 * over a malformed JSON must throw. `schema.test.ts` proves the schema rejects
 * a bad index; this proves the module actually runs it at import, so a
 * refactor to `raw as HelpIndex` turns red.
 *
 * @module test/help-index.load
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const INDEX_JSON = '../generated/help-index.json';

afterEach(() => {
    vi.doUnmock(INDEX_JSON);
    vi.resetModules();
});

describe('loading src/help-index.ts (AC-14)', () => {
    it.each([
        ['a wrong version', { version: 2, contentHash: 'x'.repeat(64), locales: { es: [] } }],
        ['no locales', { version: 1, contentHash: 'a'.repeat(64) }],
        [
            'an article missing its sections',
            { version: 1, contentHash: 'a'.repeat(64), locales: { es: [{ id: 'photos' }] } }
        ]
    ])('throws at import with %s', async (_label, malformed) => {
        // Arrange
        vi.resetModules();
        vi.doMock(INDEX_JSON, () => ({ default: malformed }));

        // Act / Assert
        await expect(import('../src/help-index')).rejects.toThrow();
    });

    it('loads when the JSON is well formed (the mock path is the one the module imports)', async () => {
        // Arrange
        vi.resetModules();
        vi.doMock(INDEX_JSON, () => ({
            default: { version: 1, contentHash: 'a'.repeat(64), locales: { es: [] } }
        }));

        // Act
        const loaded = await import('../src/help-index');

        // Assert: the mocked, empty index is what the module exposes.
        expect(loaded.HELP_ARTICLES).toEqual([]);
    });
});
