/**
 * @file photo-cap-view.test.ts
 * @description The pure cap rules of the shared photo editor (HOS-2495):
 * the five cap states, which ones open uploads, and which gallery tiles the
 * public does not show.
 */

import { describe, expect, it } from 'vitest';
import {
    GALLERY_CAP_PENDING_PLACEHOLDER,
    galleryCapOf,
    isGalleryUploadOpen,
    resolveGalleryCapView,
    resolveOverCapIds
} from '@/components/host/editor/photo-cap-view';
import type { AccommodationMediaItem } from '@/lib/api/types';
import { buildPhotoAllowance } from './photo-allowance-fixture';

function item(id: string, moderationState?: string): AccommodationMediaItem {
    return {
        id,
        url: `https://cdn.example.com/${id}.jpg`,
        publicId: id,
        isFeatured: false,
        ...(moderationState === undefined ? {} : { moderationState })
    };
}

describe('resolveGalleryCapView', () => {
    it('is loading before the first answer', () => {
        expect(resolveGalleryCapView({ allowance: null, isLoading: true, failed: false })).toEqual({
            kind: 'loading',
            cap: null
        });
        expect(resolveGalleryCapView({ allowance: null, isLoading: false, failed: false })).toEqual(
            { kind: 'loading', cap: null }
        );
    });

    it('is failed on a failed read, even with an earlier answer (AC-7)', () => {
        expect(
            resolveGalleryCapView({
                allowance: buildPhotoAllowance({ cap: 15 }),
                isLoading: false,
                failed: true
            })
        ).toEqual({ kind: 'failed', cap: null });
    });

    it('maps LIMITED to its finite cap (AC-1)', () => {
        expect(
            resolveGalleryCapView({
                allowance: buildPhotoAllowance({ cap: 15 }),
                isLoading: false,
                failed: false
            })
        ).toEqual({ kind: 'limited', cap: 15 });
    });

    it('maps UNLIMITED to its own state, never a number (AC-16)', () => {
        expect(
            resolveGalleryCapView({
                allowance: buildPhotoAllowance({ cap: 'unlimited' }),
                isLoading: false,
                failed: false
            })
        ).toEqual({ kind: 'unlimited', cap: null });
    });

    it('maps NONE to a real cap of 0, not to loading (AC-6)', () => {
        expect(
            resolveGalleryCapView({
                allowance: buildPhotoAllowance({ cap: 'none' }),
                isLoading: false,
                failed: false
            })
        ).toEqual({ kind: 'none', cap: 0 });
    });
});

describe('galleryCapOf / isGalleryUploadOpen', () => {
    it('counts against the finite cap only when limited', () => {
        expect(galleryCapOf({ kind: 'limited', cap: 7 })).toBe(7);
        for (const view of [
            { kind: 'loading', cap: null },
            { kind: 'failed', cap: null },
            { kind: 'unlimited', cap: null }
        ] as const) {
            expect(galleryCapOf(view)).toBe(GALLERY_CAP_PENDING_PLACEHOLDER);
        }
        expect(GALLERY_CAP_PENDING_PLACEHOLDER).toBeGreaterThan(10_000);
    });

    it('opens uploads only for limited and unlimited', () => {
        expect(isGalleryUploadOpen({ kind: 'limited', cap: 1 })).toBe(true);
        expect(isGalleryUploadOpen({ kind: 'unlimited', cap: null })).toBe(true);
        expect(isGalleryUploadOpen({ kind: 'none', cap: 0 })).toBe(false);
        expect(isGalleryUploadOpen({ kind: 'loading', cap: null })).toBe(false);
        expect(isGalleryUploadOpen({ kind: 'failed', cap: null })).toBe(false);
    });
});

describe('resolveOverCapIds (AC-14)', () => {
    const gallery = [
        item('a', 'APPROVED'),
        item('b', 'APPROVED'),
        item('c'),
        item('d', 'APPROVED')
    ];

    it('marks the approved photos beyond the cap, in display order', () => {
        expect([
            ...resolveOverCapIds({ items: gallery, view: { kind: 'limited', cap: 2 } })
        ]).toEqual(['c', 'd']);
    });

    it('marks exactly one photo when the gallery is one over the cap', () => {
        expect([
            ...resolveOverCapIds({ items: gallery, view: { kind: 'limited', cap: 3 } })
        ]).toEqual(['d']);
    });

    it('never marks a photo that is still in moderation, nor lets it take a slot', () => {
        const withPending = [item('a', 'APPROVED'), item('p', 'PENDING'), item('b', 'APPROVED')];
        expect([
            ...resolveOverCapIds({ items: withPending, view: { kind: 'limited', cap: 1 } })
        ]).toEqual(['b']);
        expect([
            ...resolveOverCapIds({
                items: [item('r', 'REJECTED')],
                view: { kind: 'limited', cap: 0 }
            })
        ]).toEqual([]);
    });

    it('marks every approved photo at NONE (cap 0)', () => {
        expect([...resolveOverCapIds({ items: gallery, view: { kind: 'none', cap: 0 } })]).toEqual([
            'a',
            'b',
            'c',
            'd'
        ]);
    });

    it('marks nothing when the cap is unlimited, unknown or failed', () => {
        for (const view of [
            { kind: 'unlimited', cap: null },
            { kind: 'loading', cap: null },
            { kind: 'failed', cap: null }
        ] as const) {
            expect(resolveOverCapIds({ items: gallery, view }).size).toBe(0);
        }
    });

    it('marks nothing at or under the cap', () => {
        expect(resolveOverCapIds({ items: gallery, view: { kind: 'limited', cap: 4 } }).size).toBe(
            0
        );
    });

    it('keys an SSR placeholder (no id yet) by its url', () => {
        const placeholder = { ...item('', undefined), url: 'https://cdn.example.com/ssr.jpg' };
        expect([
            ...resolveOverCapIds({ items: [placeholder], view: { kind: 'limited', cap: 0 } })
        ]).toEqual(['https://cdn.example.com/ssr.jpg']);
    });
});
