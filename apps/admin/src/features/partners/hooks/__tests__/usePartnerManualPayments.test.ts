import { ManualPaymentRegistrationBodySchema } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePartnerManualPayments } from '../usePartnerManualPayments';

type FetchOptions = { path: string; method?: string; body?: Record<string, unknown> };

const { fetchApi } = vi.hoisted(() => ({
    fetchApi: vi.fn<(options: FetchOptions) => Promise<unknown>>()
}));
vi.mock('@/lib/api/client', () => ({ fetchApi }));

const partnerId = '41000000-0000-4000-8000-000000000001';
const ownerUserId = '20b9b37c-8d07-4f93-8340-6819e8740517';
const subscriptionId = '52b9b37c-8d07-4f93-8340-6819e8740517';
const manualPaymentId = '63b9b37c-8d07-4f93-8340-6819e8740517';

function respond(options: FetchOptions) {
    if (options.method === 'POST') {
        return { data: { success: true, data: { outcome: 'REGISTERED' } } };
    }
    if (options.path.endsWith('/overview')) {
        return {
            data: {
                success: true,
                data: { id: subscriptionId, status: 'ACTIVE', plan: { planName: 'Silver' } }
            }
        };
    }
    if (options.path.endsWith('/manual-payments')) {
        return {
            data: {
                success: true,
                data: [
                    {
                        id: manualPaymentId,
                        periodStart: '2026-11-01T00:00:00.000Z',
                        status: 'AWAITING'
                    }
                ]
            }
        };
    }
    return {
        data: {
            success: true,
            data: {
                items: [
                    {
                        id: subscriptionId,
                        status: 'ACTIVE',
                        vertical: 'partner',
                        paymentMethod: 'MANUAL'
                    }
                ]
            }
        }
    };
}

function setup() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const wrapper = ({ children }: { readonly children: ReactNode }) =>
        createElement(QueryClientProvider, { client, children });
    return { client, wrapper };
}

async function renderReadyHook() {
    const { wrapper } = setup();
    const { result } = renderHook(() => usePartnerManualPayments(partnerId, ownerUserId), {
        wrapper
    });
    await waitFor(() => expect(result.current.installments).toHaveLength(1));
    return result;
}

function lastPostBody(): Record<string, unknown> {
    const call = fetchApi.mock.calls.find(([options]) => options.method === 'POST');
    if (!call) throw new Error('No POST request was captured.');
    return call[0].body as Record<string, unknown>;
}

describe('usePartnerManualPayments register', () => {
    beforeEach(() => {
        fetchApi.mockReset();
        fetchApi.mockImplementation(async (options) => respond(options));
    });
    afterEach(() => vi.clearAllMocks());

    it('sends the note as proofRef and produces a body the real strict schema accepts', async () => {
        const result = await renderReadyHook();

        await result.current.register.mutateAsync({
            manualPaymentId,
            note: 'transferencia 1542'
        });

        const body = lastPostBody();
        const parsed = ManualPaymentRegistrationBodySchema.parse(body);
        expect(parsed.proofRef).toBe('transferencia 1542');
        expect(body).not.toHaveProperty('note');
    });

    it('sends no note key and a body the real strict schema accepts', async () => {
        const result = await renderReadyHook();

        await result.current.register.mutateAsync({ manualPaymentId });

        const body = lastPostBody();
        const parsed = ManualPaymentRegistrationBodySchema.parse(body);
        expect(parsed.proofRef).toBeUndefined();
        expect(body).not.toHaveProperty('note');
    });
});
