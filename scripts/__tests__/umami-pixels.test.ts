/**
 * `umami:setup` email template pixels (HOS-2359 §6.E): one pixel per catalog
 * template from the generated manifest, idempotent, never touching newsletter pixels.
 */
import { describe, expect, it } from 'vitest';
import { loadEmailPixelDefinitions } from '../umami/pixels-client.js';
import { runSetup } from '../umami/setup.js';
import { baseInput, fakeUmami, TEST_PIXELS, writes } from './umami-fake.js';

const pixelWrites = (calls: Parameters<typeof writes>[0]) =>
    writes(calls).filter((c) => c.path.startsWith('/api/pixels'));

describe('umami:setup email pixels', () => {
    it('creates one pixel per manifest entry on the first run', async () => {
        // Arrange
        const fake = fakeUmami();

        // Act
        const result = await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.pixels).toEqual({ created: TEST_PIXELS.length, updated: 0, unchanged: 0 });
        expect(fake.pixels.map((p) => [p.name, p['slug']])).toEqual(
            TEST_PIXELS.map((p) => [p.name, p.slug])
        );
    });

    it('writes nothing on the second run (idempotent)', async () => {
        const fake = fakeUmami();
        await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);
        fake.calls.length = 0;

        const result = await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);

        expect(result.pixels).toEqual({ created: 0, updated: 0, unchanged: TEST_PIXELS.length });
        expect(pixelWrites(fake.calls)).toEqual([]);
    });

    it('renames a pixel whose name drifted, keeping its slug and id', async () => {
        const fake = fakeUmami();
        await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);
        const target = fake.pixels[0];
        if (!target) throw new Error('expected a pixel');
        target.name = 'Nombre viejo';
        fake.calls.length = 0;

        const result = await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);

        expect(result.pixels.updated).toBe(1);
        expect(pixelWrites(fake.calls)).toEqual([
            { method: 'POST', path: `/api/pixels/${target.id}` }
        ]);
        expect(target.name).toBe(TEST_PIXELS[0]?.name);
        expect(fake.pixels).toHaveLength(TEST_PIXELS.length);
    });

    it('only reads in dry-run', async () => {
        const fake = fakeUmami();

        const result = await runSetup(baseInput({ fetchImpl: fake.fetchImpl, dryRun: true }).input);

        expect(result.pixels.created).toBe(TEST_PIXELS.length);
        expect(pixelWrites(fake.calls)).toEqual([]);
        expect(fake.pixels).toEqual([]);
    });

    it('lists stale email-* pixels as unmanaged, ignores newsletter-* and never deletes', async () => {
        // Arrange
        const fake = fakeUmami();
        fake.pixels.push(
            { id: 'old', name: 'Email · Retirado', slug: 'email-retired-template' },
            { id: 'nl', name: 'Newsletter · Otoño', slug: 'newsletter-otono-aaaaaaaa' }
        );

        // Act
        const result = await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);

        // Assert
        expect(result.unmanaged).toContainEqual({ kind: 'pixel', name: 'email-retired-template' });
        expect(result.unmanaged.some((i) => i.name.startsWith('newsletter-'))).toBe(false);
        expect(fake.pixels.map((p) => p.id)).toEqual(expect.arrayContaining(['old', 'nl']));
        expect(
            writes(fake.calls).some((c) => c.path.includes('/old') || c.path.includes('/nl'))
        ).toBe(false);
    });

    it('upserts the committed manifest when no definitions are passed', async () => {
        const fake = fakeUmami();
        const { input, err } = baseInput({ fetchImpl: fake.fetchImpl });

        const result = await runSetup({ ...input, pixelDefinitions: undefined });

        expect(result.exitCode).toBe(0);
        expect(err).toEqual([]);
        expect(result.pixels.created).toBeGreaterThanOrEqual(125);
        expect(fake.pixels.every((p) => String(p['slug']).startsWith('email-'))).toBe(true);
    });

    it('loads the committed manifest: 125+ email-* pixels with names', () => {
        const definitions = loadEmailPixelDefinitions();

        expect(definitions.length).toBeGreaterThanOrEqual(125);
        for (const definition of definitions) {
            expect(definition.slug.startsWith('email-')).toBe(true);
            expect(definition.name.startsWith('Email · ')).toBe(true);
        }
    });

    it('rejects a missing manifest', () => {
        expect(() => loadEmailPixelDefinitions({ path: '/nonexistent/manifest.json' })).toThrow();
    });
});
