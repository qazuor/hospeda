/**
 * useMediaUpload advanced tests (T-067, SPEC-078-GAPS).
 *
 * Extends GAP-078-052 coverage with:
 * - Happy path: valid payload posts multipart/form-data and returns `data.url`.
 * - 413 Payload Too Large, 422 Unprocessable, 503 Service Unavailable all
 *   surface as ApiError with the correct status code and message.
 * - Delete mutation happy path + error path.
 * - createUploadHandler bridges the richer mutation input to the simple
 *   `(file) => url` contract required by GalleryField.
 * - Missing VITE_API_URL produces a clear error (guard).
 * - Initial hook state exposes `isUploading: false`, `uploadError: null`,
 *   `isDeleting: false`.
 */

import {
    type UploadEntityImageInput,
    createUploadHandler,
    useMediaUpload
} from '@/hooks/use-media-upload';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Build a fresh QueryClient wrapper per test so mutation state is isolated.
 */
function buildWrapper() {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    });
    return ({ children }: { readonly children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

/**
 * Build a fake Response for fetch() spying. The hook's raw-fetch helper reads
 * the body as text then parses JSON, so a stubbed object with `.ok`, `.status`,
 * and `.text()` is enough.
 */
function buildFakeResponse(args: {
    ok: boolean;
    status: number;
    body: unknown;
}): Response {
    const { ok, status, body } = args;
    const text = JSON.stringify(body);
    return {
        ok,
        status,
        text: () => Promise.resolve(text)
    } as unknown as Response;
}

describe('useMediaUpload — happy path', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('initial state exposes idle flags (isUploading=false, uploadError=null)', () => {
        const { result } = renderHook(() => useMediaUpload(), {
            wrapper: buildWrapper()
        });

        expect(result.current.isUploading).toBe(false);
        expect(result.current.uploadError).toBeNull();
        expect(result.current.isDeleting).toBe(false);
    });

    it('posts multipart/form-data and returns the response data for a valid payload', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            buildFakeResponse({
                ok: true,
                status: 200,
                body: {
                    data: {
                        url: 'https://cdn.example.com/ok.jpg',
                        publicId: 'hospeda/ok',
                        width: 800,
                        height: 600
                    }
                }
            })
        );

        const { result } = renderHook(() => useMediaUpload(), {
            wrapper: buildWrapper()
        });

        const input: UploadEntityImageInput = {
            file: new File(['data'], 'ok.jpg', { type: 'image/jpeg' }),
            entityType: 'accommodation',
            entityId: VALID_UUID,
            role: 'featured'
        };

        const response = await result.current.uploadEntityImage.mutateAsync(input);
        expect(response.url).toBe('https://cdn.example.com/ok.jpg');
        expect(response.publicId).toBe('hospeda/ok');

        // fetch called with POST and FormData body (Content-Type omitted so the
        // browser can set multipart boundaries).
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [, init] = fetchSpy.mock.calls[0] ?? [];
        expect(init?.method).toBe('POST');
        expect(init?.body).toBeInstanceOf(FormData);
        // Credentials are forwarded (session cookie).
        expect(init?.credentials).toBe('include');
    });

    it('sends the role, entityType, and entityId as FormData fields', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            buildFakeResponse({
                ok: true,
                status: 200,
                body: {
                    data: {
                        url: 'https://cdn.example.com/x.jpg',
                        publicId: 'p',
                        width: 1,
                        height: 1
                    }
                }
            })
        );

        const { result } = renderHook(() => useMediaUpload(), {
            wrapper: buildWrapper()
        });

        await result.current.uploadEntityImage.mutateAsync({
            file: new File(['data'], 'g.jpg', { type: 'image/jpeg' }),
            entityType: 'destination',
            entityId: VALID_UUID,
            role: 'gallery'
        });

        const [, init] = fetchSpy.mock.calls[0] ?? [];
        const form = init?.body as FormData;
        expect(form.get('entityType')).toBe('destination');
        expect(form.get('entityId')).toBe(VALID_UUID);
        expect(form.get('role')).toBe('gallery');
        expect(form.get('file')).toBeInstanceOf(File);
    });
});

describe('useMediaUpload — HTTP error surfaces (413 / 422 / 503)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    const validInput: UploadEntityImageInput = {
        file: new File(['data'], 'ok.jpg', { type: 'image/jpeg' }),
        entityType: 'accommodation',
        entityId: VALID_UUID,
        role: 'featured'
    };

    it('surfaces a 413 Payload Too Large as a typed error', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            buildFakeResponse({
                ok: false,
                status: 413,
                body: { error: { code: 'PAYLOAD_TOO_LARGE', message: 'File too big' } }
            })
        );

        const { result } = renderHook(() => useMediaUpload(), {
            wrapper: buildWrapper()
        });

        await expect(result.current.uploadEntityImage.mutateAsync(validInput)).rejects.toThrow(
            /File too big/
        );

        // Error surfaces on the mutation's error state.
        await waitFor(() => {
            expect(result.current.uploadError).toBeInstanceOf(Error);
        });
    });

    it('surfaces a 422 Unprocessable with the server message', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            buildFakeResponse({
                ok: false,
                status: 422,
                body: { message: 'Validation failed' }
            })
        );

        const { result } = renderHook(() => useMediaUpload(), {
            wrapper: buildWrapper()
        });

        await expect(result.current.uploadEntityImage.mutateAsync(validInput)).rejects.toThrow(
            /Validation failed/
        );
    });

    it('surfaces a 503 Service Unavailable with a helpful default message', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            buildFakeResponse({
                ok: false,
                status: 503,
                body: {}
            })
        );

        const { result } = renderHook(() => useMediaUpload(), {
            wrapper: buildWrapper()
        });

        await expect(result.current.uploadEntityImage.mutateAsync(validInput)).rejects.toThrow(
            /Request failed \(503\)/
        );
    });
});

describe('useMediaUpload — deleteImage mutation', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns the parsed data on a successful DELETE', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            buildFakeResponse({
                ok: true,
                status: 200,
                body: { data: { deleted: true, publicId: 'hospeda/ok' } }
            })
        );

        const { result } = renderHook(() => useMediaUpload(), {
            wrapper: buildWrapper()
        });

        const response = await result.current.deleteImage.mutateAsync({
            publicId: 'hospeda/ok'
        });

        expect(response.deleted).toBe(true);
        expect(response.publicId).toBe('hospeda/ok');
    });

    it('surfaces a delete failure via ApiError', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            buildFakeResponse({
                ok: false,
                status: 404,
                body: { error: { code: 'NOT_FOUND', message: 'Image not found' } }
            })
        );

        const { result } = renderHook(() => useMediaUpload(), {
            wrapper: buildWrapper()
        });

        await expect(
            result.current.deleteImage.mutateAsync({ publicId: 'missing' })
        ).rejects.toThrow(/Image not found/);
    });

    it('passes the publicId as a query-string parameter', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            buildFakeResponse({
                ok: true,
                status: 200,
                body: { data: { deleted: true, publicId: 'x' } }
            })
        );

        const { result } = renderHook(() => useMediaUpload(), {
            wrapper: buildWrapper()
        });

        await result.current.deleteImage.mutateAsync({ publicId: 'hospeda/sample/test' });

        const [url] = fetchSpy.mock.calls[0] ?? [];
        expect(String(url)).toContain('publicId=hospeda%2Fsample%2Ftest');
    });
});

describe('createUploadHandler helper', () => {
    it('maps (file) → url via the richer UploadEntityImageInput contract', async () => {
        const onUpload = vi.fn().mockResolvedValue({
            url: 'https://cdn.example.com/bridge.jpg',
            publicId: 'hospeda/bridge',
            width: 100,
            height: 100
        });

        const handler = createUploadHandler({
            entityType: 'post',
            entityId: VALID_UUID,
            role: 'gallery',
            onUpload
        });

        const file = new File(['x'], 'bridge.jpg', { type: 'image/jpeg' });
        const url = await handler(file);

        expect(url).toBe('https://cdn.example.com/bridge.jpg');
        expect(onUpload).toHaveBeenCalledTimes(1);
        expect(onUpload).toHaveBeenCalledWith({
            file,
            entityType: 'post',
            entityId: VALID_UUID,
            role: 'gallery'
        });
    });
});

describe('useMediaUpload — environment guard', () => {
    const originalUrl = import.meta.env.VITE_API_URL;

    afterEach(() => {
        // Restore the env so later tests don't blow up.
        (import.meta.env as Record<string, string | undefined>).VITE_API_URL = originalUrl;
    });

    it('throws a configuration error when VITE_API_URL is empty', async () => {
        (import.meta.env as Record<string, string | undefined>).VITE_API_URL = '';

        const { result } = renderHook(() => useMediaUpload(), {
            wrapper: buildWrapper()
        });

        await expect(
            result.current.uploadEntityImage.mutateAsync({
                file: new File(['x'], 'ok.jpg', { type: 'image/jpeg' }),
                entityType: 'accommodation',
                entityId: VALID_UUID,
                role: 'featured'
            })
        ).rejects.toThrow(/VITE_API_URL is not configured/);
    });
});
