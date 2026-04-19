/**
 * Tests for useMediaUpload hook
 *
 * GAP-078-052 — verifies that the admin media-upload hook:
 * 1. Type-checks `entityType` against the shared `MediaEntityType` enum
 *    (compile-time guarantee, asserted via `// @ts-expect-error`).
 * 2. Validates the form-field payload with `AdminUploadRequestSchema` BEFORE
 *    constructing FormData and BEFORE issuing the network request, so
 *    invalid payloads (e.g. non-UUID `entityId`) never hit the wire.
 *
 * @module use-media-upload.test
 */

import { type UploadEntityImageInput, useMediaUpload } from '@/hooks/use-media-upload';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Builds a minimal QueryClient wrapper for hook tests. Disables retries so
 * mutation errors surface synchronously on first failure.
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

describe('useMediaUpload hook', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('TypeScript type safety (GAP-078-052)', () => {
        it('rejects an unknown entityType at compile time', () => {
            // The hook's input type narrows `entityType` to the supported
            // subset of `MediaEntityType` (accommodation/destination/event/post).
            // Passing an unsupported literal MUST be a type error — without
            // this guard the runtime Zod parse would still catch it, but
            // late, at the cost of an extra round-trip through React Query.
            const validInput: UploadEntityImageInput = {
                file: new File([''], 'a.jpg', { type: 'image/jpeg' }),
                entityType: 'accommodation',
                entityId: '550e8400-e29b-41d4-a716-446655440000',
                role: 'featured'
            };

            const invalidEntityType: UploadEntityImageInput = {
                file: new File([''], 'a.jpg', { type: 'image/jpeg' }),
                // @ts-expect-error - 'unknown' is not a valid MediaEntityType variant
                entityType: 'unknown',
                entityId: '550e8400-e29b-41d4-a716-446655440000',
                role: 'featured'
            };

            const invalidRole: UploadEntityImageInput = {
                file: new File([''], 'a.jpg', { type: 'image/jpeg' }),
                entityType: 'accommodation',
                entityId: '550e8400-e29b-41d4-a716-446655440000',
                // @ts-expect-error - 'avatar' is not exposed by this hook variant
                role: 'avatar'
            };

            // The assignments above are the real test — they compile only
            // because the `@ts-expect-error` directives are honored. The
            // runtime assertions below keep vitest happy and ensure the
            // unused-variable lint rule never silently disables this test.
            expect(validInput.entityType).toBe('accommodation');
            expect(invalidEntityType.role).toBe('featured');
            expect(invalidRole.entityType).toBe('accommodation');
        });
    });

    describe('Runtime payload validation (GAP-078-052)', () => {
        it('throws and skips fetch when entityId is not a UUID', async () => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch');

            const { result } = renderHook(() => useMediaUpload(), {
                wrapper: buildWrapper()
            });

            const file = new File(['data'], 'x.jpg', { type: 'image/jpeg' });

            await expect(
                result.current.uploadEntityImage.mutateAsync({
                    file,
                    entityType: 'accommodation',
                    entityId: 'not-a-uuid',
                    role: 'featured'
                })
            ).rejects.toThrow(/Invalid media upload payload/);

            // Critical assertion: the network must NEVER be touched when the
            // payload fails validation.
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('throws and skips fetch when entityId is an empty string', async () => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch');

            const { result } = renderHook(() => useMediaUpload(), {
                wrapper: buildWrapper()
            });

            const file = new File(['data'], 'x.jpg', { type: 'image/jpeg' });

            await expect(
                result.current.uploadEntityImage.mutateAsync({
                    file,
                    entityType: 'accommodation',
                    entityId: '',
                    role: 'gallery'
                })
            ).rejects.toThrow(/Invalid media upload payload/);

            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('exposes the validation error on the mutation error surface', async () => {
            const { result } = renderHook(() => useMediaUpload(), {
                wrapper: buildWrapper()
            });

            const file = new File(['data'], 'x.jpg', { type: 'image/jpeg' });

            // Fire-and-ignore the mutation; we want to assert the React Query
            // state (`uploadError`) reflects the validation failure rather
            // than asserting on the thrown promise directly.
            result.current.uploadEntityImage
                .mutateAsync({
                    file,
                    entityType: 'accommodation',
                    entityId: 'invalid',
                    role: 'featured'
                })
                .catch(() => {
                    // Swallow — the assertion is on the hook state below.
                });

            await waitFor(() => {
                expect(result.current.uploadError).toBeInstanceOf(Error);
            });

            expect(result.current.uploadError?.message).toMatch(/Invalid media upload payload/);
        });
    });
});
