// @vitest-environment jsdom
/**
 * Regression tests for useFaqs response-envelope parsing.
 *
 * Guards against the SPEC-177 bug where the admin FAQ page crashed with
 * `TypeError: faqs is not iterable`: the API returns nested envelopes
 * (`{ success, data: { faqs: [...] } }` for the list and
 * `{ success, data: { faq: {...} } }` for create/update), but the hooks
 * previously read `body.data` directly — yielding an object instead of an
 * array/item. These tests exercise the REAL envelope shape (the prior unit
 * tests mocked the hook output and never hit this parse), so the crash can
 * never silently come back.
 */

import { fetchApi } from '@/lib/api/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFaqCreate, useFaqList, useFaqUpdate } from '../useFaqs';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

/** QueryClientProvider wrapper with retries disabled for deterministic tests. */
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('useFaqList — response envelope parsing (regression: faqs-not-iterable)', () => {
    it('unwraps the nested { data: { faqs: [...] } } envelope into an array', async () => {
        mockedFetchApi.mockResolvedValue({
            data: {
                success: true,
                data: { faqs: [{ id: '1', question: 'q1', answer: 'a1', displayOrder: 0 }] }
            },
            status: 200
        });

        const { result } = renderHook(() => useFaqList('destinations', 'parent-1'), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(Array.isArray(result.current.data)).toBe(true);
        expect(result.current.data).toHaveLength(1);
        expect(result.current.data?.[0]?.question).toBe('q1');
    });

    it('returns an empty array (not an object) when data.faqs is absent', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: {} },
            status: 200
        });

        const { result } = renderHook(() => useFaqList('accommodations', 'parent-2'), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(Array.isArray(result.current.data)).toBe(true);
        expect(result.current.data).toEqual([]);
    });
});

describe('useFaqCreate / useFaqUpdate — unwraps { data: { faq: {...} } }', () => {
    it('useFaqCreate returns the created FaqItem, not the wrapper object', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { faq: { id: '9', question: 'nq', answer: 'na' } } },
            status: 201
        });

        const { result } = renderHook(() => useFaqCreate('destinations', 'parent-1'), {
            wrapper: createWrapper()
        });

        const created = await result.current.mutateAsync({ question: 'nq', answer: 'na' });
        expect(created?.id).toBe('9');
        expect(created?.question).toBe('nq');
    });

    it('useFaqUpdate returns the updated FaqItem, not the wrapper object', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { faq: { id: '9', question: 'uq', answer: 'ua' } } },
            status: 200
        });

        const { result } = renderHook(() => useFaqUpdate('accommodations', 'parent-2'), {
            wrapper: createWrapper()
        });

        const updated = await result.current.mutateAsync({
            faqId: '9',
            payload: { question: 'uq', answer: 'ua' }
        });
        expect(updated?.id).toBe('9');
        expect(updated?.question).toBe('uq');
    });
});
