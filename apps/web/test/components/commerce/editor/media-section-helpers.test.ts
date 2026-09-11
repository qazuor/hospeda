/**
 * @file media-section-helpers.test.ts
 * @description Unit tests for the pure validation helpers behind
 * `MediaSection.client.tsx` (HOS-332).
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { describe, expect, it, vi } from 'vitest';
import {
    buildMediaCompressionUnsupportedTooLargeMessage,
    validateMediaFileSize,
    validateMediaFileType
} from '@/components/commerce/editor/media-section-helpers';

const t = vi.fn((_key: string, fallback?: string, params?: Record<string, unknown>) => {
    const raw = fallback ?? _key;
    if (!params) return raw;
    return Object.keys(params).reduce(
        (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
        raw
    );
});

describe('validateMediaFileType', () => {
    it('accepts JPEG, PNG, WebP, and HEIC', () => {
        for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/heic']) {
            const file = new File(['x'], 'photo', { type });
            expect(validateMediaFileType(file, t)).toBeNull();
        }
    });

    it('rejects an unsupported type', () => {
        const file = new File(['x'], 'photo.gif', { type: 'image/gif' });
        expect(validateMediaFileType(file, t)).toContain('JPG, PNG, WebP o HEIC');
    });

    it('never checks size', () => {
        const bytes = mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB) + 1;
        const file = new File([new Uint8Array(new ArrayBuffer(bytes))], 'big.jpg', {
            type: 'image/jpeg'
        });
        expect(validateMediaFileType(file, t)).toBeNull();
    });
});

describe('validateMediaFileSize', () => {
    it('accepts a file at or under the cap', () => {
        const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
        expect(validateMediaFileSize(file, t)).toBeNull();
    });

    it('rejects a file over the cap, naming the cap in force', () => {
        const bytes = mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB) + 1;
        const file = new File([new Uint8Array(new ArrayBuffer(bytes))], 'big.heic', {
            type: 'image/heic'
        });
        const result = validateMediaFileSize(file, t);
        expect(result).toContain(String(DEFAULT_ENTITY_MAX_FILE_SIZE_MB));
    });
});

describe('buildMediaCompressionUnsupportedTooLargeMessage', () => {
    it('names the size cap and is distinct from the generic too-large message', () => {
        const message = buildMediaCompressionUnsupportedTooLargeMessage(t);
        const genericTooLarge = validateMediaFileSize(
            new File(
                [new Uint8Array(new ArrayBuffer(mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB) + 1))],
                'big.jpg',
                { type: 'image/jpeg' }
            ),
            t
        );
        expect(message).toContain(String(DEFAULT_ENTITY_MAX_FILE_SIZE_MB));
        expect(message).not.toBe(genericTooLarge);
    });
});
