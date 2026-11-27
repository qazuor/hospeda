/**
 * @file ReceiptViewer.test.tsx
 * @description RTL tests for the receipt page island (HOS-2566).
 *
 * What is worth asserting: the read carries the session (a cross-origin anchor
 * would drop the cookie), a 404 renders «not found» and NO open/download action,
 * and a failure other than 404 is an error with a retry, never «not found».
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceiptViewer } from '../../../src/components/account/receipts/ReceiptViewer.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({ t: (key: string) => key })
}));
vi.mock('../../../src/components/account/receipts/ReceiptViewer.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));
vi.mock('../../../src/lib/env', () => ({ getApiUrl: () => 'https://api.test' }));

const RECEIPT_ID = '33333333-3333-4333-8333-333333333333';
const URL_UNDER_TEST = `https://api.test/api/v1/protected/billing-subscription/receipts/${RECEIPT_ID}/pdf`;

function response(input: { status: number }): Response {
    return {
        ok: input.status >= 200 && input.status < 300,
        status: input.status,
        blob: async () => new Blob(['%PDF-'], { type: 'application/pdf' })
    } as unknown as Response;
}

function renderViewer() {
    return render(
        <ReceiptViewer
            receiptId={RECEIPT_ID}
            locale="es"
            backHref="/es/mi-cuenta/suscripcion/"
        />
    );
}

describe('ReceiptViewer', () => {
    const fetchMock = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', fetchMock);
        URL.createObjectURL = vi.fn(() => 'blob:receipt');
        URL.revokeObjectURL = vi.fn();
    });

    it('reads the PDF with the session and offers to open and download it', async () => {
        fetchMock.mockResolvedValue(response({ status: 200 }));

        renderViewer();

        await waitFor(() =>
            expect(screen.getByText('account.subscription.receipts.page.open')).toBeTruthy()
        );
        expect(fetchMock).toHaveBeenCalledWith(
            URL_UNDER_TEST,
            expect.objectContaining({ credentials: 'include' })
        );
        expect(screen.getByText('account.subscription.receipts.page.download')).toBeTruthy();
    });

    it('shows not-found on a 404 and offers neither action', async () => {
        fetchMock.mockResolvedValue(response({ status: 404 }));

        renderViewer();

        await waitFor(() =>
            expect(screen.getByText('account.subscription.receipts.page.notFound')).toBeTruthy()
        );
        expect(screen.queryByText('account.subscription.receipts.page.open')).toBeNull();
        expect(screen.queryByText('account.subscription.receipts.page.download')).toBeNull();
    });

    it('treats a 500 as a retryable error, not as not-found', async () => {
        fetchMock.mockResolvedValueOnce(response({ status: 500 }));
        fetchMock.mockResolvedValueOnce(response({ status: 200 }));

        renderViewer();

        await waitFor(() =>
            expect(screen.getByText('account.subscription.receipts.page.error')).toBeTruthy()
        );
        expect(screen.queryByText('account.subscription.receipts.page.notFound')).toBeNull();
        fireEvent.click(screen.getByText('account.subscription.receipts.page.retry'));
        await waitFor(() =>
            expect(screen.getByText('account.subscription.receipts.page.open')).toBeTruthy()
        );
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
