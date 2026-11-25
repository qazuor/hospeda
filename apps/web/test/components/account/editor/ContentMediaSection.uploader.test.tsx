/** Cover upload integration: kit validation, persistence ordering and recovery. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentMediaSection } from '@/components/account/editor/ContentMediaSection.client';

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    add: vi.fn(),
    feature: vi.fn(),
    compress: vi.fn(),
    fetch: vi.fn(),
    toast: vi.fn()
}));
vi.mock('@/lib/env', () => ({ getApiUrl: () => 'http://api.test' }));
vi.mock('@/lib/logger', () => ({ webLogger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/store/toast-store', () => ({ addToast: mocks.toast }));
vi.mock('@/lib/media/compress-image', () => ({
    compressImageForUpload: mocks.compress,
    isCompressionUnavailable: () => false
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    contentMediaApi: {
        listMedia: mocks.list,
        addMedia: mocks.add,
        setFeaturedMedia: mocks.feature,
        removeMedia: vi.fn(),
        updateMedia: vi.fn()
    }
}));
const old = {
    id: 'old',
    url: '/old.jpg',
    isFeatured: true,
    state: 'visible',
    moderationState: 'APPROVED'
};
const next = { ...old, id: 'new', url: '/new.jpg', isFeatured: false };

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocks.fetch);
    vi.stubGlobal(
        'URL',
        Object.assign(URL, {
            createObjectURL: vi.fn(() => 'blob:preview'),
            revokeObjectURL: vi.fn()
        })
    );
    mocks.list.mockResolvedValue({ ok: true, data: { media: [old] } });
    mocks.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { url: next.url, publicId: 'asset' } })
    });
    mocks.add.mockResolvedValue({ ok: true, data: { media: next } });
    mocks.feature.mockResolvedValue({ ok: true, data: { media: { ...next, isFeatured: true } } });
    mocks.compress.mockImplementation(async ({ file }: { file: File }) => ({
        file,
        wasCompressed: false
    }));
});

async function pick(file: File) {
    render(
        <ContentMediaSection
            locale="en"
            entity="post"
            entityId="post-1"
        />
    );
    await waitFor(() => expect(screen.getByRole('button', { name: /Cover image:/ })).toBeEnabled());
    await act(async () => {
        fireEvent.change(screen.getByTestId('image-uploader-input'), { target: { files: [file] } });
    });
}

describe('content cover uploader', () => {
    it('uses kit preview/button, persists once in order and demotes the prior cover', async () => {
        await pick(new File(['small'], 'cover.jpg', { type: 'image/jpeg' }));
        await waitFor(() => expect(mocks.feature).toHaveBeenCalledOnce());
        expect(mocks.fetch).toHaveBeenCalledOnce();
        expect(mocks.add).toHaveBeenCalledOnce();
        expect(mocks.fetch.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.add.mock.invocationCallOrder[0]
        );
        expect(mocks.add.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.feature.mock.invocationCallOrder[0]
        );
        expect(screen.getByTestId('image-uploader-preview')).toHaveAttribute('src', 'blob:preview');
        await waitFor(() =>
            expect(
                screen.getAllByRole('img').some((img) => img.getAttribute('src') === old.url)
            ).toBe(true)
        );
        expect(document.querySelector('[data-kit-section]')).toBeNull();
    });

    it('accepts a large original that compresses below the upload cap', async () => {
        const compressed = new File(['compressed'], 'cover.webp', { type: 'image/webp' });
        mocks.compress.mockResolvedValue({ file: compressed, wasCompressed: true });
        await pick(
            new File([new Uint8Array(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
        );
        await waitFor(() => expect(mocks.feature).toHaveBeenCalledOnce());
        const form = mocks.fetch.mock.calls[0]?.[1].body as FormData;
        expect((form.get('file') as File).size).toBe(compressed.size);
    });

    it('rejects a file still above the cap before any upload', async () => {
        await pick(
            new File([new Uint8Array(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
        );
        await screen.findByText(
            'The image is larger than 10 MB even after optimizing it. Choose a lighter one.'
        );
        expect(mocks.fetch).not.toHaveBeenCalled();
        expect(mocks.add).not.toHaveBeenCalled();
    });

    it('keeps the prior cover and surfaces a failed featured write', async () => {
        mocks.feature.mockResolvedValue({
            ok: false,
            error: { message: 'Cover refused', status: 500 }
        });
        await pick(new File(['small'], 'cover.jpg', { type: 'image/jpeg' }));
        await screen.findByRole('alert');
        expect(screen.getByTestId('image-uploader-preview')).toHaveAttribute('src', old.url);
        expect(mocks.toast).toHaveBeenCalledWith({
            type: 'error',
            message: 'Could not set the image as the cover'
        });
        expect(mocks.add).toHaveBeenCalledOnce();
    });

    it('blocks the kit picker before hydration and under moderation lock', async () => {
        mocks.list.mockReturnValue(new Promise(() => {}));
        const { rerender } = render(
            <ContentMediaSection
                locale="en"
                entity="event"
                entityId="event-1"
            />
        );
        expect(screen.getByTestId('image-uploader-input')).toBeDisabled();
        rerender(
            <ContentMediaSection
                locale="en"
                entity="event"
                entityId="event-1"
                disabled
            />
        );
        expect(screen.getByTestId('image-uploader-input')).toBeDisabled();
        expect(mocks.fetch).not.toHaveBeenCalled();
    });
});
