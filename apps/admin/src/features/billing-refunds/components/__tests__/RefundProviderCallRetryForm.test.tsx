// @vitest-environment jsdom
/** Tests for «Retry with MP» over a confirmed refund stuck on an unanswered provider call (HOS-2516). */

import en from '@repo/i18n/locales/en/admin-billing.json';
import es from '@repo/i18n/locales/es/admin-billing.json';
import pt from '@repo/i18n/locales/pt/admin-billing.json';
import type { RefundProviderCallRetryResponse } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { buildRefundProviderCallRetryPath } from '../../hooks/useRetryRefundProviderCalls';
import {
    RefundProviderCallRetryForm,
    readRetryRejection,
    retrySummaryKey
} from '../RefundProviderCallRetryForm';

const state = vi.hoisted(() => ({ retry: vi.fn(), pending: false }));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es',
        t: (key: string, params?: Record<string, string>) => {
            const text = key
                .split('.')
                .slice(1)
                .reduce((obj: any, part) => obj?.[part], es) as string | undefined;
            return Object.entries(params ?? {}).reduce(
                (out, [name, value]) => out.replace(`{{${name}}}`, value),
                text ?? key
            );
        }
    })
}));
vi.mock('../../hooks/useRetryRefundProviderCalls', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useRetryRefundProviderCalls: () => ({ mutateAsync: state.retry, isPending: state.pending })
}));

const REFUND_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const KEY = `refund:${REFUND_ID}:1`;
const copy = es.proposedRefunds.providerRetry;

function response(
    overrides: Partial<RefundProviderCallRetryResponse> = {}
): RefundProviderCallRetryResponse {
    return {
        refundId: REFUND_ID,
        status: 'EXECUTED',
        calls: [{ idempotencyKey: KEY, outcome: 'SENT' }],
        execution: 'EXECUTED',
        ...overrides
    };
}

function rejection(reason: string, status = 409): ApiError {
    return new ApiError('Rejected', { status, body: { error: { reason } } });
}

async function submit(refundId = REFUND_ID) {
    render(<RefundProviderCallRetryForm />);
    fireEvent.change(screen.getByLabelText(copy.refundId), { target: { value: refundId } });
    fireEvent.click(screen.getByRole('button', { name: copy.review }));
    fireEvent.click(screen.getByRole('button', { name: copy.confirm }));
}

beforeEach(() => {
    state.retry.mockReset();
    state.pending = false;
});

describe('RefundProviderCallRetryForm', () => {
    it('keeps review disabled until the refund id is a UUID', () => {
        render(<RefundProviderCallRetryForm />);
        const review = screen.getByRole('button', { name: copy.review });
        expect(review).toBeDisabled();
        fireEvent.change(screen.getByLabelText(copy.refundId), { target: { value: 'nope' } });
        expect(review).toBeDisabled();
        fireEvent.change(screen.getByLabelText(copy.refundId), {
            target: { value: ` ${REFUND_ID} ` }
        });
        expect(review).toBeEnabled();
    });

    it('asks for confirmation before sending, then sends the trimmed refund id', async () => {
        // Arrange
        state.retry.mockResolvedValue(response());
        render(<RefundProviderCallRetryForm />);
        fireEvent.change(screen.getByLabelText(copy.refundId), {
            target: { value: ` ${REFUND_ID} ` }
        });

        // Act
        fireEvent.click(screen.getByRole('button', { name: copy.review }));

        // Assert: nothing was sent yet, the confirmation names the refund.
        expect(state.retry).not.toHaveBeenCalled();
        expect(screen.getByTestId('refund-provider-call-retry-confirmation')).toHaveTextContent(
            REFUND_ID
        );
        fireEvent.click(screen.getByRole('button', { name: copy.confirm }));
        await waitFor(() => expect(state.retry).toHaveBeenCalledWith({ refundId: REFUND_ID }));
        expect(await screen.findByRole('status')).toHaveTextContent(copy.summary.EXECUTED);
        expect(screen.getByRole('status')).toHaveTextContent(KEY);
        expect(screen.getByRole('status')).toHaveTextContent(copy.calls.SENT);
    });

    it('goes back without sending', () => {
        render(<RefundProviderCallRetryForm />);
        fireEvent.change(screen.getByLabelText(copy.refundId), { target: { value: REFUND_ID } });
        fireEvent.click(screen.getByRole('button', { name: copy.review }));
        fireEvent.click(screen.getByRole('button', { name: copy.back }));
        expect(state.retry).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: copy.review })).toBeEnabled();
    });

    it('shows each call outcome when a call is still unanswered', async () => {
        state.retry.mockResolvedValue(
            response({
                status: 'CONFIRMED',
                execution: null,
                calls: [{ idempotencyKey: KEY, outcome: 'AWAITING_PROVIDER_ANSWER' }]
            })
        );
        await submit();
        const status = await screen.findByRole('status');
        expect(status).toHaveTextContent(copy.summary.STILL_UNANSWERED);
        expect(status).toHaveTextContent(copy.calls.AWAITING_PROVIDER_ANSWER);
    });

    it('names the retry-specific rejections', async () => {
        state.retry.mockRejectedValue(rejection('REFUND_HAS_NO_UNANSWERED_CALL'));
        await submit();
        expect(await screen.findByRole('alert')).toHaveTextContent(
            copy.rejections.REFUND_HAS_NO_UNANSWERED_CALL
        );
    });

    it('reuses action 13 copy for the shared rejections', async () => {
        state.retry.mockRejectedValue(rejection('ADMINISTRATIVE_ACTION_FORBIDDEN', 403));
        await submit();
        expect(await screen.findByRole('alert')).toHaveTextContent(
            es.proposedRefunds.rejections.ADMINISTRATIVE_ACTION_FORBIDDEN
        );
    });
});

describe('retry helpers', () => {
    it('builds the encoded administrative path', () => {
        expect(buildRefundProviderCallRetryPath({ refundId: REFUND_ID })).toBe(
            `/api/v1/admin/billing-refunds/${REFUND_ID}/retry-provider-calls`
        );
    });

    it('summarizes every status of the response', () => {
        const base = 'admin-billing.proposedRefunds.providerRetry.summary';
        expect(retrySummaryKey({ response: response() })).toBe(`${base}.EXECUTED`);
        expect(
            retrySummaryKey({
                response: response({
                    status: 'FAILED',
                    execution: null,
                    calls: [{ idempotencyKey: KEY, outcome: 'PROVIDER_REJECTED_FAILED' }]
                })
            })
        ).toBe(`${base}.FAILED`);
        expect(
            retrySummaryKey({
                response: response({
                    status: 'CONFIRMED',
                    execution: 'NOT_ACCREDITED_KEPT_CONFIRMED'
                })
            })
        ).toBe(`${base}.WAITING_ACCREDITATION`);
        expect(
            retrySummaryKey({
                response: response({
                    status: 'CONFIRMED',
                    execution: null,
                    calls: [{ idempotencyKey: KEY, outcome: 'PROVIDER_KEY_CONFLICT' }]
                })
            })
        ).toBe(`${base}.STILL_UNANSWERED`);
    });

    it('maps the past-window refusal to its own advice and a 500 to the server error', () => {
        expect(readRetryRejection({ error: rejection('REFUND_PAST_PROVIDER_WINDOW', 422) })).toBe(
            'admin-billing.proposedRefunds.providerRetry.rejections.REFUND_PAST_PROVIDER_WINDOW'
        );
        expect(readRetryRejection({ error: new ApiError('Boom', { status: 500, body: {} }) })).toBe(
            'admin-billing.proposedRefunds.serverError'
        );
    });

    it('has the same retry copy keys in es, en and pt', () => {
        const keysOf = (node: unknown, prefix = ''): string[] =>
            typeof node === 'object' && node !== null
                ? Object.entries(node).flatMap(([key, value]) => keysOf(value, `${prefix}${key}.`))
                : [prefix];
        const esKeys = keysOf(es.proposedRefunds.providerRetry).sort();
        expect(keysOf(en.proposedRefunds.providerRetry).sort()).toEqual(esKeys);
        expect(keysOf(pt.proposedRefunds.providerRetry).sort()).toEqual(esKeys);
    });
});
