// @vitest-environment jsdom
/**
 * HOS-2679 — the QR campaigns panel: counts, «Ver en Umami» links and the
 * comma explanation. The panel only links; it never writes to Umami.
 */

import type { QrCampaignsUmamiResponse, QrCampaignUmamiItem } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchApiMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/client', () => ({ fetchApi: fetchApiMock }));

import { QR_CAMPAIGNS_UMAMI_STALE_TIME_MS } from '../../hooks/useQrCampaignsUmami';
import { QrCampaignUmamiFilterLink, QrCodeCampaignsDialog } from '../QrCodeCampaignsDialog';

const VIEW = 'https://umami.test/websites/w?utmCampaign=eq.verano';

const linked: QrCampaignUmamiItem = { campaign: 'verano', qrCount: 3, viewUrl: VIEW };
const other: QrCampaignUmamiItem = {
    campaign: 'invierno',
    qrCount: 1,
    viewUrl: 'https://umami.test/websites/w?utmCampaign=eq.invierno'
};

function listResponse(body: QrCampaignsUmamiResponse) {
    return { data: { data: body }, status: 200 };
}

function renderWithClient(ui: React.ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function openDialog() {
    renderWithClient(<QrCodeCampaignsDialog />);
    fireEvent.click(screen.getByRole('button', { name: /admin-qr-codes\.campaigns\.open/ }));
}

beforeEach(() => {
    fetchApiMock.mockReset();
});

describe('QrCodeCampaignsDialog', () => {
    it('does not read the campaigns until opened', () => {
        renderWithClient(<QrCodeCampaignsDialog />);

        expect(fetchApiMock).not.toHaveBeenCalled();
    });

    it('lists campaigns with counts and links that open in a new tab', async () => {
        // Arrange
        fetchApiMock.mockResolvedValue(listResponse({ items: [linked, other] }));

        // Act
        openDialog();

        // Assert
        expect(await screen.findByText('verano')).toBeInTheDocument();
        expect(fetchApiMock).toHaveBeenCalledWith({
            path: '/api/v1/admin/qr-codes/campaigns/umami'
        });
        expect(screen.getByText('3')).toBeInTheDocument();
        const views = screen.getAllByRole('link', {
            name: /admin-qr-codes\.campaigns\.viewInUmami/
        });
        expect(views).toHaveLength(2);
        expect(views[0]).toHaveAttribute('href', VIEW);
        expect(views[0]).toHaveAttribute('target', '_blank');
        expect(views[0]).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('offers no create button: the panel only links to Umami', async () => {
        fetchApiMock.mockResolvedValue(listResponse({ items: [linked] }));

        openDialog();

        await screen.findByText('verano');
        expect(screen.queryByRole('button', { name: /createSegment/ })).not.toBeInTheDocument();
        expect(fetchApiMock).toHaveBeenCalledTimes(1);
    });

    it('explains why a campaign with a comma has no link', async () => {
        // Arrange
        const comma: QrCampaignUmamiItem = {
            campaign: 'a,b',
            qrCount: 2,
            unsupportedReason: 'COMMA_IN_CAMPAIGN',
            viewUrl: null
        };
        fetchApiMock.mockResolvedValue(listResponse({ items: [comma, linked] }));

        // Act
        openDialog();

        // Assert
        expect(await screen.findByText('a,b')).toBeInTheDocument();
        expect(screen.getByText('admin-qr-codes.campaigns.commaNotice')).toBeInTheDocument();
        expect(screen.getByText('admin-qr-codes.campaigns.noLinkComma')).toBeInTheDocument();
        expect(
            screen.getAllByRole('link', { name: /admin-qr-codes\.campaigns\.viewInUmami/ })
        ).toHaveLength(1);
    });

    it('says the link is missing when Umami is not configured on the API', async () => {
        fetchApiMock.mockResolvedValue(
            listResponse({ items: [{ campaign: 'verano', qrCount: 3, viewUrl: null }] })
        );

        openDialog();

        expect(
            await screen.findByText('admin-qr-codes.campaigns.noLinkNotConfigured')
        ).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('shows the empty state', async () => {
        fetchApiMock.mockResolvedValue(listResponse({ items: [] }));

        openDialog();

        expect(await screen.findByText('admin-qr-codes.campaigns.empty')).toBeInTheDocument();
    });

    it('shows the load error when the API fails', async () => {
        fetchApiMock.mockRejectedValue(new Error('boom'));

        openDialog();

        expect(await screen.findByText('admin-qr-codes.campaigns.loadError')).toBeInTheDocument();
    });
});

describe('useQrCampaignsUmami staleTime', () => {
    it('serves a second mount within a minute from cache, without a second read', async () => {
        // Arrange: one client shared by two consumers mounted one after the other.
        fetchApiMock.mockResolvedValue(listResponse({ items: [linked] }));
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const first = render(
            <QueryClientProvider client={client}>
                <QrCampaignUmamiFilterLink campaign="verano" />
            </QueryClientProvider>
        );
        await screen.findByRole('link');
        first.unmount();

        // Act
        render(
            <QueryClientProvider client={client}>
                <QrCampaignUmamiFilterLink campaign="verano" />
            </QueryClientProvider>
        );

        // Assert
        expect(await screen.findByRole('link')).toBeInTheDocument();
        expect(fetchApiMock).toHaveBeenCalledTimes(1);
        expect(QR_CAMPAIGNS_UMAMI_STALE_TIME_MS).toBe(60_000);
    });
});

describe('QrCampaignUmamiFilterLink', () => {
    it('links the picked campaign to its Umami view', async () => {
        fetchApiMock.mockResolvedValue(listResponse({ items: [linked, other] }));

        renderWithClient(<QrCampaignUmamiFilterLink campaign="verano" />);

        const link = await screen.findByRole('link', {
            name: /admin-qr-codes\.campaigns\.filterLink/
        });
        expect(link).toHaveAttribute('href', VIEW);
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders nothing for a campaign Umami has no link for', async () => {
        fetchApiMock.mockResolvedValue(listResponse({ items: [other] }));

        const { container } = renderWithClient(<QrCampaignUmamiFilterLink campaign="otra" />);

        await waitFor(() => expect(fetchApiMock).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });
});
