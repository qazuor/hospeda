/**
 * Tests for {@link InMemoryImageProvider}.
 *
 * Covers SPEC-078-GAPS GAP-078-102:
 *   - Upload round-trip stores buffer and returns a parseable Cloudinary URL.
 *   - Delete by publicId is idempotent.
 *   - Delete by prefix removes every match and leaves siblings alone.
 */
import { describe, expect, it } from 'vitest';
import { extractPublicId } from '../../extract-public-id.js';
import { InMemoryImageProvider } from '../mock-provider.js';

describe('InMemoryImageProvider', () => {
    it('stores uploaded buffers and returns a Cloudinary-style URL', async () => {
        // Arrange
        const provider = new InMemoryImageProvider();
        const buffer = Buffer.from('hello');

        // Act
        const result = await provider.upload({
            file: buffer,
            folder: 'hospeda/prod/accommodations/abc',
            publicId: 'featured'
        });

        // Assert
        expect(result.publicId).toBe('hospeda/prod/accommodations/abc/featured');
        expect(result.url.startsWith('https://res.cloudinary.com/')).toBe(true);
        expect(new URL(result.url).hostname).toBe('res.cloudinary.com');
        expect(extractPublicId(result.url)).toBe('hospeda/prod/accommodations/abc/featured');

        const record = provider.get(result.publicId);
        expect(record).toBeDefined();
        expect(record?.buffer.equals(buffer)).toBe(true);
    });

    it('generates a unique publicId when none is supplied', async () => {
        const provider = new InMemoryImageProvider();

        const first = await provider.upload({
            file: Buffer.from('a'),
            folder: 'hospeda/test'
        });
        const second = await provider.upload({
            file: Buffer.from('b'),
            folder: 'hospeda/test'
        });

        expect(first.publicId).not.toBe(second.publicId);
        expect(provider.size).toBe(2);
    });

    it('delete() is idempotent for missing publicIds', async () => {
        const provider = new InMemoryImageProvider();

        // SPEC-078-GAPS GAP-078-154: idempotent delete on absent asset
        // resolves with `wasPresent: false` rather than throwing.
        await expect(provider.delete({ publicId: 'does-not-exist' })).resolves.toEqual({
            wasPresent: false
        });
    });

    // SPEC-078-GAPS GAP-078-154: delete on a present asset reports wasPresent: true
    it('delete() returns wasPresent: true when removing an existing asset', async () => {
        const provider = new InMemoryImageProvider();
        const uploaded = await provider.upload({
            file: Buffer.from('a'),
            folder: 'hospeda/test',
            publicId: 'present'
        });

        const result = await provider.delete({ publicId: uploaded.publicId });

        expect(result).toEqual({ wasPresent: true });
        expect(provider.has(uploaded.publicId)).toBe(false);
    });

    it('deleteByPrefix() removes matching entries only', async () => {
        const provider = new InMemoryImageProvider();

        await provider.upload({
            file: Buffer.from('a'),
            folder: 'hospeda/prod/a',
            publicId: 'x'
        });
        await provider.upload({
            file: Buffer.from('b'),
            folder: 'hospeda/prod/a',
            publicId: 'y'
        });
        await provider.upload({
            file: Buffer.from('c'),
            folder: 'hospeda/prod/b',
            publicId: 'z'
        });

        await provider.deleteByPrefix({ prefix: 'hospeda/prod/a/' });

        expect(provider.has('hospeda/prod/a/x')).toBe(false);
        expect(provider.has('hospeda/prod/a/y')).toBe(false);
        expect(provider.has('hospeda/prod/b/z')).toBe(true);
    });

    // SPEC-078-GAPS GAP-078-232: healthCheck always succeeds for the in-memory
    // provider since there is no upstream backend to authenticate against.
    it('healthCheck() always returns {ok: true}', async () => {
        const provider = new InMemoryImageProvider();

        await expect(provider.healthCheck()).resolves.toEqual({ ok: true });
    });

    it('clear() empties the store', async () => {
        const provider = new InMemoryImageProvider();
        await provider.upload({
            file: Buffer.from('a'),
            folder: 'hospeda/test',
            publicId: 'x'
        });

        provider.clear();

        expect(provider.size).toBe(0);
    });
});
