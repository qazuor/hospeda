// @vitest-environment jsdom
/**
 * HOS-2679 PR 2 — the QR campaigns panel: Umami links, status badges, the
 * create flow and why «Crear en Umami» is disabled.
 */

import type { QrCampaignsUmamiResponse, QrCampaignUmamiItem } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchApiMock = vi.hoisted(() => vi.fn());
const addToastMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/client', () => ({ fetchApi: fetchApiMock }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ addToast: addToastMock }) }));

import { ApiError } from '@/lib/errors';
import { readQrCampaignSegmentErrorReason } from '../../hooks/useQrCampaignsUmami';
import {
    QrCampaignUmamiFilterLink,
    QrCodeCampaignsDialog,
    qrCampaignCreateBlocker
} from '../QrCodeCampaignsDialog';

const VIEW = 'https://umami.test/websites/w?utmCampaign=eq.verano';
const SEGMENT = 'https://umami.test/websites/w?segment=s1';

const withSegment: QrCampaignUmamiItem = {
    campaign: 'verano',
    qrCount: 3,
    umami: { status: 'segment', segmentId: 's1', viewUrl: VIEW, segmentUrl: SEGMENT }
};
const missing: QrCampaignUmamiItem = {
    campaign: 'invierno',
    qrCount: 1,
    umami: { status: 'missing', viewUrl: 'https://umami.test/websites/w?utmCampaign=eq.invierno' }
};

function listResponse(body: QrCampaignsUmamiResponse) {
    return { data: { data: body }, status: 200 };
}

function renderWithClient(ui: React.ReactElement) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

async function openDialog(canCreate = true) {
    renderWithClient(<QrCodeCampaignsDialog canCreate={canCreate} />);
    fireEvent.click(screen.getByRole('button', { name: /admin-qr-codes\.campaigns\.open/ }));
}

beforeEach(() => {
    fetchApiMock.mockReset();
    addToastMock.mockReset();
});

describe('QrCodeCampaignsDialog', () => {
    it('does not read Umami until opened', () => {
        renderWithClient(<QrCodeCampaignsDialog canCreate />);

        expect(fetchApiMock).not.toHaveBeenCalled();
    });

    it('lists campaigns with counts, badges and links that open in a new tab', async () => {
        // Arrange
        fetchApiMock.mockResolvedValue(
            listResponse({ items: [withSegment, missing], canCreateSegments: true })
        );

        // Act
        await openDialog();

        // Assert
        expect(await screen.findByText('verano')).toBeInTheDocument();
        expect(fetchApiMock).toHaveBeenCalledWith({
            path: '/api/v1/admin/qr-codes/campaigns/umami'
        });
        expect(screen.getByText('admin-qr-codes.campaigns.status.segment')).toBeInTheDocument();
        expect(screen.getByText('admin-qr-codes.campaigns.status.missing')).toBeInTheDocument();
        const views = screen.getAllByRole('link', {
            name: /admin-qr-codes\.campaigns\.viewInUmami/
        });
        expect(views[0]).toHaveAttribute('href', VIEW);
        expect(views[0]).toHaveAttribute('target', '_blank');
        expect(views[0]).toHaveAttribute('rel', 'noopener noreferrer');
        expect(
            screen.getByRole('link', { name: /admin-qr-codes\.campaigns\.openSegment/ })
        ).toHaveAttribute('href', SEGMENT);
        // Only the missing campaign offers «Crear en Umami».
        expect(
            screen.getAllByRole('button', { name: /admin-qr-codes\.campaigns\.createSegment/ })
        ).toHaveLength(1);
    });

    it('creates a missing segment, toasts and refetches the list', async () => {
        // Arrange
        fetchApiMock
            .mockResolvedValueOnce(listResponse({ items: [missing], canCreateSegments: true }))
            .mockResolvedValueOnce({
                data: { data: { item: { ...missing }, created: true } },
                status: 201
            })
            .mockResolvedValueOnce(listResponse({ items: [missing], canCreateSegments: true }));
        await openDialog();
        const button = await screen.findByRole('button', {
            name: /admin-qr-codes\.campaigns\.createSegment/
        });

        // Act
        fireEvent.click(button);

        // Assert
        await waitFor(() =>
            expect(addToastMock).toHaveBeenCalledWith({
                variant: 'success',
                message: 'admin-qr-codes.campaigns.created'
            })
        );
        expect(fetchApiMock).toHaveBeenCalledWith({
            path: '/api/v1/admin/qr-codes/campaigns/umami-segment',
            method: 'POST',
            body: { campaign: 'invierno' }
        });
        await waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(3));
    });

    it('says so when the segment already existed', async () => {
        fetchApiMock
            .mockResolvedValueOnce(listResponse({ items: [missing], canCreateSegments: true }))
            .mockResolvedValueOnce({
                data: { data: { item: missing, created: false } },
                status: 200
            })
            .mockResolvedValue(listResponse({ items: [missing], canCreateSegments: true }));
        await openDialog();

        fireEvent.click(
            await screen.findByRole('button', { name: /admin-qr-codes\.campaigns\.createSegment/ })
        );

        await waitFor(() =>
            expect(addToastMock).toHaveBeenCalledWith({
                variant: 'success',
                message: 'admin-qr-codes.campaigns.alreadyExisted'
            })
        );
    });

    it('maps a rejected key to its own error copy', async () => {
        fetchApiMock
            .mockResolvedValueOnce(listResponse({ items: [missing], canCreateSegments: true }))
            .mockRejectedValueOnce(
                new ApiError('x', {
                    status: 503,
                    body: { error: { code: 'SERVICE_UNAVAILABLE', reason: 'UMAMI_KEY_REJECTED' } }
                })
            );
        await openDialog();

        fireEvent.click(
            await screen.findByRole('button', { name: /admin-qr-codes\.campaigns\.createSegment/ })
        );

        await waitFor(() =>
            expect(addToastMock).toHaveBeenCalledWith({
                variant: 'error',
                message: 'admin-qr-codes.campaigns.createErrors.UMAMI_KEY_REJECTED'
            })
        );
    });

    it('disables create with a reason when Umami is unavailable', async () => {
        fetchApiMock.mockResolvedValue(
            listResponse({
                items: [{ ...missing, umami: { status: 'unavailable', viewUrl: null } }],
                canCreateSegments: true
            })
        );
        await openDialog();

        const button = await screen.findByRole('button', {
            name: /admin-qr-codes\.campaigns\.createSegment/
        });

        expect(button).toBeDisabled();
        expect(button.parentElement).toHaveAttribute(
            'title',
            'admin-qr-codes.campaigns.createDisabledUnavailable'
        );
        expect(screen.getByRole('status')).toHaveTextContent(
            'admin-qr-codes.campaigns.unavailableNotice'
        );
        expect(screen.queryByRole('link', { name: /viewInUmami/ })).not.toBeInTheDocument();
    });

    it('shows the empty state', async () => {
        fetchApiMock.mockResolvedValue(listResponse({ items: [], canCreateSegments: false }));

        await openDialog();

        expect(await screen.findByText('admin-qr-codes.campaigns.empty')).toBeInTheDocument();
    });
});

describe('qrCampaignCreateBlocker', () => {
    it.each([
        [false, true, missing, 'admin-qr-codes.campaigns.createDisabledPermission'],
        [true, false, missing, 'admin-qr-codes.campaigns.createDisabledNotConfigured'],
        [
            true,
            true,
            { ...missing, umami: { status: 'unavailable' as const, viewUrl: null } },
            'admin-qr-codes.campaigns.createDisabledUnavailable'
        ],
        [true, true, missing, null]
    ])('canCreate=%s canCreateSegments=%s → %s', (canCreate, canCreateSegments, item, expected) => {
        expect(qrCampaignCreateBlocker({ item, canCreate, canCreateSegments })).toBe(expected);
    });
});

describe('readQrCampaignSegmentErrorReason', () => {
    it('reads error.reason from an ApiError body', () => {
        const error = new ApiError('x', { status: 503, body: { error: { reason: 'R' } } });

        expect(readQrCampaignSegmentErrorReason({ error })).toBe('R');
    });

    it('answers undefined for anything else', () => {
        expect(readQrCampaignSegmentErrorReason({ error: new Error('x') })).toBeUndefined();
    });
});

describe('QrCampaignUmamiFilterLink', () => {
    it('links the picked campaign to its Umami view', async () => {
        fetchApiMock.mockResolvedValue(
            listResponse({ items: [withSegment, missing], canCreateSegments: true })
        );

        renderWithClient(<QrCampaignUmamiFilterLink campaign="verano" />);

        const link = await screen.findByRole('link', {
            name: /admin-qr-codes\.campaigns\.filterLink/
        });
        expect(link).toHaveAttribute('href', VIEW);
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders nothing for a campaign Umami has no link for', async () => {
        fetchApiMock.mockResolvedValue(listResponse({ items: [missing], canCreateSegments: true }));

        const { container } = renderWithClient(<QrCampaignUmamiFilterLink campaign="otra" />);

        await waitFor(() => expect(fetchApiMock).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });
});
