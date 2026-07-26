/**
 * @file MediaField.test.tsx
 * @description Size-limit coverage for the commerce media editor (HOS-322).
 *
 * The commerce editor posts to the same `/media/upload-entity` endpoint as the
 * accommodation photo editor but keeps its own upload code, so it drifted: it
 * carried its own 5 MB literal and its own hint string. Both now derive from
 * the canonical cap in `@repo/media`, and these tests are what keep them there
 * — the review that caught the drift found the hint had no test at all.
 *
 * @module test/components/commerce/MediaField
 */
import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaField } from '../../../src/components/commerce/MediaField';

vi.mock('../../../src/lib/env', () => ({
    getApiUrl: () => 'http://api.test'
}));

vi.mock('../../../src/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    protectedMediaApi: { deleteMedia: vi.fn().mockResolvedValue({ ok: true }) }
}));

/** Interpolating translator, matching the real `createTranslations().t`. */
const t = (key: string, fallback?: string, params?: Record<string, string | number>): string => {
    const raw = fallback ?? key;
    return params
        ? Object.entries(params).reduce(
              (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)),
              raw
          )
        : raw;
};

const classes = new Proxy({} as Record<string, string>, {
    get: (_target, prop) => String(prop)
});

const defaultProps = {
    vertical: 'gastronomy' as const,
    listingId: '00000000-0000-4000-8000-0000000000aa',
    featuredImage: null,
    gallery: [],
    onChange: vi.fn(),
    t,
    classes
};

/** A file of an exact byte length. */
const fileOfBytes = (bytes: number): File =>
    new File([new Uint8Array(new ArrayBuffer(bytes))], 'listing.jpg', { type: 'image/jpeg' });

const selectFeaturedFile = (file: File): void => {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
};

describe('MediaField — size limit (HOS-322)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    it('states the real cap in the upload hint', () => {
        render(<MediaField {...defaultProps} />);

        const hint = screen.getByText((content) => content.includes('máx.'));
        expect(hint.textContent).toContain(String(DEFAULT_ENTITY_MAX_FILE_SIZE_MB));
        expect(hint.textContent).not.toContain('{{');
    });

    it('accepts a photo above the old 5 MB ceiling', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                data: { url: 'https://cdn.test/a.jpg', publicId: 'a', width: 800, height: 600 }
            })
        } as Response);

        render(<MediaField {...defaultProps} />);
        selectFeaturedFile(fileOfBytes(mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB) - mbToBytes(1)));

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    });

    it('refuses a photo over the cap without calling the API, naming the cap', async () => {
        render(<MediaField {...defaultProps} />);
        selectFeaturedFile(fileOfBytes(mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB) + 1));

        await waitFor(() => {
            const alert = screen.getByText((content) => content.includes('no puede superar'));
            expect(alert.textContent).toContain(String(DEFAULT_ENTITY_MAX_FILE_SIZE_MB));
            expect(alert.textContent).not.toContain('{{');
        });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('bounds the upload request so a stalled connection cannot hang forever', async () => {
        // The commerce editor keeps its own `fetch`-based upload. When the cap
        // was raised it inherited the bigger payload but not the accommodation
        // editor's timeout, so a stalled upload left the owner on a permanent
        // spinner (BETA-134's symptom, on a path that had no bound).
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                data: { url: 'https://cdn.test/a.jpg', publicId: 'a', width: 800, height: 600 }
            })
        } as Response);

        render(<MediaField {...defaultProps} />);
        selectFeaturedFile(fileOfBytes(1024));

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        const init = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
            | RequestInit
            | undefined;
        expect(init?.signal).toBeInstanceOf(AbortSignal);
    });
});
