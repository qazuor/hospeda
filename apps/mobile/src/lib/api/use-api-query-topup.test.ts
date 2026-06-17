/**
 * @file use-api-query-topup.test.ts
 * @description Unit tests for `useApiQuery` and `useApiMutation` wrappers.
 *
 * ## Strategy
 *
 * `useApiQuery` and `useApiMutation` are thin wrappers around `useQuery` /
 * `useMutation` from `@tanstack/react-query`. Because the Vitest environment
 * is `node` (no DOM, no React Native runtime), we cannot call hooks directly.
 *
 * Instead we:
 * 1. Mock `@tanstack/react-query` to capture the options object passed to
 *    `useQuery` / `useMutation`.
 * 2. Mock `./client` so `apiFetch` is controllable.
 * 3. Call the hook factories in regular function context (no React renderer)
 *    and assert on the captured options.
 * 4. Invoke the `queryFn` / `mutationFn` extracted from those options directly
 *    to test the actual logic inside.
 *
 * This covers lines 164-263 of use-api-query.ts without needing
 * `@testing-library/react-native`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockUseQuery, mockUseMutation, mockApiFetch } = vi.hoisted(() => ({
    mockUseQuery: vi.fn(),
    mockUseMutation: vi.fn(),
    mockApiFetch: vi.fn()
}));

vi.mock('@tanstack/react-query', () => ({
    useQuery: mockUseQuery,
    useMutation: mockUseMutation
}));

vi.mock('./client', () => ({
    apiFetch: mockApiFetch
}));

// ---------------------------------------------------------------------------
// Module under test (imported AFTER mocks)
// ---------------------------------------------------------------------------

// eslint-disable-next-line import/order
import { useApiMutation, useApiQuery } from './use-api-query';

// ---------------------------------------------------------------------------
// Shared schema
// ---------------------------------------------------------------------------

const ItemSchema = z.object({ id: z.string(), name: z.string() });
type Item = z.infer<typeof ItemSchema>;
const validItem: Item = { id: '1', name: 'Test' };

// ---------------------------------------------------------------------------
// useApiQuery
// ---------------------------------------------------------------------------

describe('useApiQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
        mockApiFetch.mockResolvedValue({ data: validItem });
    });

    it('calls useQuery with the provided queryKey', () => {
        // Arrange
        const queryKey = ['items', 'list'] as const;

        // Act
        useApiQuery({ queryKey, path: '/api/v1/public/items', schema: ItemSchema });

        // Assert
        expect(mockUseQuery).toHaveBeenCalledOnce();
        const [options] = mockUseQuery.mock.calls[0] as [{ queryKey: unknown }];
        expect(options.queryKey).toBe(queryKey);
    });

    it('passes enabled: true by default', () => {
        // Act
        useApiQuery({ queryKey: ['items'], path: '/api/v1/public/items', schema: ItemSchema });

        // Assert
        const [options] = mockUseQuery.mock.calls[0] as [{ enabled: boolean }];
        expect(options.enabled).toBe(true);
    });

    it('forwards enabled: false when provided', () => {
        // Act
        useApiQuery({
            queryKey: ['items'],
            path: '/api/v1/public/items',
            schema: ItemSchema,
            enabled: false
        });

        // Assert
        const [options] = mockUseQuery.mock.calls[0] as [{ enabled: boolean }];
        expect(options.enabled).toBe(false);
    });

    it('does NOT include staleTime in options when not provided', () => {
        // Act
        useApiQuery({ queryKey: ['items'], path: '/api/v1/public/items', schema: ItemSchema });

        // Assert — staleTime should NOT be set (undefined spread is excluded)
        const [options] = mockUseQuery.mock.calls[0] as [Record<string, unknown>];
        expect(options.staleTime).toBeUndefined();
    });

    it('includes staleTime in options when provided', () => {
        // Act
        useApiQuery({
            queryKey: ['items'],
            path: '/api/v1/public/items',
            schema: ItemSchema,
            staleTime: 30_000
        });

        // Assert
        const [options] = mockUseQuery.mock.calls[0] as [{ staleTime: number }];
        expect(options.staleTime).toBe(30_000);
    });

    it('returns the result of useQuery', () => {
        // Arrange
        const mockResult = { data: validItem, isLoading: false, error: null };
        mockUseQuery.mockReturnValue(mockResult);

        // Act
        const result = useApiQuery({
            queryKey: ['items'],
            path: '/api/v1/public/items',
            schema: ItemSchema
        });

        // Assert
        expect(result).toBe(mockResult);
    });

    describe('queryFn', () => {
        it('calls apiFetch with path, query, schema, and signal from context', async () => {
            // Arrange
            const controller = new AbortController();
            useApiQuery({
                queryKey: ['items'],
                path: '/api/v1/public/items',
                query: { page: 1 },
                schema: ItemSchema
            });
            const [options] = mockUseQuery.mock.calls[0] as [
                { queryFn: (ctx: { signal: AbortSignal }) => Promise<Item> }
            ];

            // Act — call queryFn directly with a mock context
            await options.queryFn({ signal: controller.signal });

            // Assert
            expect(mockApiFetch).toHaveBeenCalledOnce();
            expect(mockApiFetch).toHaveBeenCalledWith({
                path: '/api/v1/public/items',
                query: { page: 1 },
                schema: ItemSchema,
                signal: controller.signal
            });
        });

        it('returns the data field from apiFetch result', async () => {
            // Arrange
            mockApiFetch.mockResolvedValue({ data: validItem });
            useApiQuery({ queryKey: ['items'], path: '/api/v1/public/items', schema: ItemSchema });
            const [options] = mockUseQuery.mock.calls[0] as [
                { queryFn: (ctx: { signal: AbortSignal }) => Promise<Item> }
            ];

            // Act
            const result = await options.queryFn({ signal: new AbortController().signal });

            // Assert
            expect(result).toEqual(validItem);
        });

        it('propagates apiFetch errors (queryFn does not catch)', async () => {
            // Arrange
            const fetchError = new Error('Network failure');
            mockApiFetch.mockRejectedValue(fetchError);
            useApiQuery({ queryKey: ['items'], path: '/api/v1/public/items', schema: ItemSchema });
            const [options] = mockUseQuery.mock.calls[0] as [
                { queryFn: (ctx: { signal: AbortSignal }) => Promise<Item> }
            ];

            // Act + Assert
            await expect(options.queryFn({ signal: new AbortController().signal })).rejects.toThrow(
                'Network failure'
            );
        });
    });
});

// ---------------------------------------------------------------------------
// useApiMutation
// ---------------------------------------------------------------------------

describe('useApiMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseMutation.mockReturnValue({ mutate: vi.fn(), isLoading: false });
        mockApiFetch.mockResolvedValue({ data: validItem });
    });

    it('calls useMutation once', () => {
        // Act
        useApiMutation({ path: '/api/v1/protected/items', schema: ItemSchema });

        // Assert
        expect(mockUseMutation).toHaveBeenCalledOnce();
    });

    it('returns the result of useMutation', () => {
        // Arrange
        const mockResult = { mutate: vi.fn(), data: undefined };
        mockUseMutation.mockReturnValue(mockResult);

        // Act
        const result = useApiMutation({ path: '/api/v1/protected/items', schema: ItemSchema });

        // Assert
        expect(result).toBe(mockResult);
    });

    describe('mutationFn', () => {
        it('calls apiFetch with path, default POST method, and variables as body', async () => {
            // Arrange
            const variables = { name: 'New Item' };
            useApiMutation({ path: '/api/v1/protected/items', schema: ItemSchema });
            const [options] = mockUseMutation.mock.calls[0] as [
                { mutationFn: (variables: unknown) => Promise<Item> }
            ];

            // Act
            await options.mutationFn(variables);

            // Assert
            expect(mockApiFetch).toHaveBeenCalledOnce();
            expect(mockApiFetch).toHaveBeenCalledWith({
                path: '/api/v1/protected/items',
                method: 'POST',
                body: variables,
                schema: ItemSchema
            });
        });

        it('uses custom method when specified', async () => {
            // Arrange
            useApiMutation({
                path: '/api/v1/protected/items/1',
                method: 'PATCH',
                schema: ItemSchema
            });
            const [options] = mockUseMutation.mock.calls[0] as [
                { mutationFn: (variables: unknown) => Promise<Item> }
            ];

            // Act
            await options.mutationFn({ name: 'Updated' });

            // Assert
            expect(mockApiFetch).toHaveBeenCalledWith(expect.objectContaining({ method: 'PATCH' }));
        });

        it('applies transformBody when provided', async () => {
            // Arrange
            const transformBody = vi.fn((vars: { name: string }) => ({
                displayName: vars.name.toUpperCase()
            }));
            useApiMutation({
                path: '/api/v1/protected/items',
                schema: ItemSchema,
                transformBody
            });
            const [options] = mockUseMutation.mock.calls[0] as [
                { mutationFn: (variables: { name: string }) => Promise<Item> }
            ];

            // Act
            await options.mutationFn({ name: 'hello' });

            // Assert — transformBody was called and its result used as body
            expect(transformBody).toHaveBeenCalledWith({ name: 'hello' });
            expect(mockApiFetch).toHaveBeenCalledWith(
                expect.objectContaining({ body: { displayName: 'HELLO' } })
            );
        });

        it('uses raw variables as body when transformBody is not provided', async () => {
            // Arrange
            const variables = { id: '42', name: 'Item' };
            useApiMutation({ path: '/api/v1/protected/items', schema: ItemSchema });
            const [options] = mockUseMutation.mock.calls[0] as [
                { mutationFn: (variables: unknown) => Promise<Item> }
            ];

            // Act
            await options.mutationFn(variables);

            // Assert
            expect(mockApiFetch).toHaveBeenCalledWith(expect.objectContaining({ body: variables }));
        });

        it('returns the data field from apiFetch result', async () => {
            // Arrange
            mockApiFetch.mockResolvedValue({ data: validItem });
            useApiMutation({ path: '/api/v1/protected/items', schema: ItemSchema });
            const [options] = mockUseMutation.mock.calls[0] as [
                { mutationFn: (variables: unknown) => Promise<Item> }
            ];

            // Act
            const result = await options.mutationFn({});

            // Assert
            expect(result).toEqual(validItem);
        });

        it('propagates apiFetch errors (mutationFn does not catch)', async () => {
            // Arrange
            const fetchError = new Error('API error');
            mockApiFetch.mockRejectedValue(fetchError);
            useApiMutation({ path: '/api/v1/protected/items', schema: ItemSchema });
            const [options] = mockUseMutation.mock.calls[0] as [
                { mutationFn: (variables: unknown) => Promise<Item> }
            ];

            // Act + Assert
            await expect(options.mutationFn({})).rejects.toThrow('API error');
        });
    });
});
