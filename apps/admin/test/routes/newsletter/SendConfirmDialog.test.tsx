/**
 * @file SendConfirmDialog.test.tsx
 * Tests the audience count shown in the send confirmation (HOS-2586).
 */
import type { NewsletterCampaign } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { SendConfirmDialog } from '@/routes/_authed/newsletter/campaigns/-components/SendConfirmDialog';

const mockUseAudience = vi.fn();
const mockSend = vi.fn();
const mockResolution = vi.fn();
const mockNavigate = vi.fn();
const mockToast = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mockNavigate }));
vi.mock('@/hooks/newsletter/use-campaign-resolution', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/hooks/newsletter/use-campaign-resolution')>()),
    useCampaignResolution: (input: unknown) => mockResolution(input)
}));

vi.mock('@/hooks/newsletter', () => ({
    useCampaignAudienceCount: (args: unknown) => mockUseAudience(args),
    useSendCampaign: () => ({ mutateAsync: mockSend, isPending: false })
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ addToast: mockToast }) }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key}:${JSON.stringify(params)}` : key,
        tPlural: (key: string, count: number) => `${key}#${count}`,
        locale: 'es'
    })
}));

const campaign = {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    subject: 'Hola',
    status: 'draft',
    localeFilter: 'all',
    totalRecipients: null,
    totalSoftcapped: 0
} as unknown as NewsletterCampaign;

function renderDialog() {
    render(
        <SendConfirmDialog
            open
            onOpenChange={vi.fn()}
            campaign={campaign}
        />
    );
}

describe('SendConfirmDialog audience', () => {
    beforeEach(() => {
        mockUseAudience.mockReset();
        mockSend.mockReset();
        mockResolution.mockReturnValue({ data: undefined });
    });

    it('shows an ellipsis (never 0) while the estimate loads', () => {
        mockUseAudience.mockReturnValue({ data: undefined });
        renderDialog();
        expect(screen.getByText(/confirmSendAudience_other.*…/)).toBeInTheDocument();
        expect(screen.queryByText(/#0/)).not.toBeInTheDocument();
    });

    it('shows the real eligible count for a draft', () => {
        mockUseAudience.mockReturnValue({
            data: { eligible: 7, softCapped: 0, totalCandidates: 7 }
        });
        renderDialog();
        expect(
            screen.getByText('admin-newsletter.campaigns.confirmSendAudience#7')
        ).toBeInTheDocument();
    });

    it('requests the estimate for the campaign while the dialog is open', () => {
        mockUseAudience.mockReturnValue({ data: undefined });
        renderDialog();
        expect(mockUseAudience).toHaveBeenCalledWith({
            id: campaign.id,
            ignoreSoftCap: false,
            enabled: true
        });
    });

    it('shows the frequency-limit note when some matches are soft-capped', () => {
        mockUseAudience.mockReturnValue({
            data: { eligible: 5, softCapped: 2, totalCandidates: 7 }
        });
        renderDialog();
        expect(
            screen.getByText('admin-newsletter.campaigns.confirmSendSoftcapNote')
        ).toBeInTheDocument();
    });

    it('shows an error message (not a perpetual ellipsis) when the estimate fails', () => {
        mockUseAudience.mockReturnValue({ data: undefined, isError: true });
        renderDialog();
        expect(
            screen.getByText('admin-newsletter.campaigns.confirmSendAudienceError')
        ).toBeInTheDocument();
        expect(screen.queryByText(/confirmSendAudience_other/)).not.toBeInTheDocument();
    });

    it('renders labels through i18n keys instead of hardcoded Spanish', () => {
        mockUseAudience.mockReturnValue({
            data: { eligible: 1, softCapped: 0, totalCandidates: 1 }
        });
        renderDialog();
        expect(
            screen.getByText('admin-newsletter.campaigns.confirmSendSubjectLabel')
        ).toBeInTheDocument();
        expect(
            screen.getByText('admin-newsletter.campaigns.ignoreSoftCapHint')
        ).toBeInTheDocument();
        expect(
            screen.getByText('admin-newsletter.campaigns.confirmSendCancel')
        ).toBeInTheDocument();
    });
});

describe('SendConfirmDialog dynamic resolution', () => {
    const report = {
        blocks: [
            {
                blockKey: 'block-one',
                candidates: ['a'],
                dropped: [],
                repeatsUsed: 0,
                belowMin: true,
                action: 'skip_run'
            }
        ]
    };
    const dynamicCampaign: NewsletterCampaign = {
        ...campaign,
        bodyJson: { type: 'doc', content: [{ type: 'dynamicBlock' }] }
    };
    beforeEach(() => {
        mockUseAudience.mockReturnValue({ data: { eligible: 7 } });
        mockSend.mockReset();
    });

    it('shows the report before confirmation', () => {
        mockResolution.mockReturnValue({ data: { report } });
        render(
            <SendConfirmDialog
                open
                onOpenChange={vi.fn()}
                campaign={dynamicCampaign}
            />
        );
        expect(screen.getByText('block-one')).toBeInTheDocument();
        expect(screen.getByText(/actions.skip_run/)).toBeInTheDocument();
        expect(mockSend).not.toHaveBeenCalled();
        expect(mockResolution).toHaveBeenCalledWith(
            expect.objectContaining({ enabled: true, id: campaign.id })
        );
    });
    it('explains a below-minimum preview rejection and keeps confirmation disabled', () => {
        mockResolution.mockReturnValue({
            isError: true,
            error: new ApiError('Blocked', {
                status: 422,
                body: { error: { code: 'DYNAMIC_BLOCK_BELOW_MIN', details: { report } } }
            })
        });
        render(
            <SendConfirmDialog
                open
                onOpenChange={vi.fn()}
                campaign={dynamicCampaign}
            />
        );
        expect(screen.getByRole('alert')).toHaveTextContent(/sendBlocked.*block-one/);
        expect(screen.getByText('block-one')).toBeInTheDocument();
        expect(screen.getByText('admin-newsletter.dynamicBlock.found: 1')).toBeInTheDocument();
        expect(screen.getByText(/actions.skip_run/)).toBeInTheDocument();
        const confirm = screen.getByRole('button', {
            name: 'admin-newsletter.campaigns.confirmSendButton'
        });
        expect(confirm).toBeDisabled();
        fireEvent.click(confirm);
        expect(mockSend).not.toHaveBeenCalled();
    });
    it('prevents confirmation before the report is available', () => {
        mockResolution.mockReturnValue({ isLoading: true });
        render(
            <SendConfirmDialog
                open
                onOpenChange={vi.fn()}
                campaign={dynamicCampaign}
            />
        );
        expect(
            screen.getByRole('button', { name: 'admin-newsletter.campaigns.confirmSendButton' })
        ).toBeDisabled();
    });
    it('keeps the dialog and draft on 422 and identifies affected blocks', async () => {
        mockResolution.mockReturnValue({ data: { report } });
        mockSend.mockRejectedValue(
            new ApiError('Blocked', {
                status: 422,
                body: { error: { code: 'DYNAMIC_BLOCK_BELOW_MIN', details: { report } } }
            })
        );
        const onOpenChange = vi.fn();
        render(
            <SendConfirmDialog
                open
                onOpenChange={onOpenChange}
                campaign={dynamicCampaign}
            />
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'admin-newsletter.campaigns.confirmSendButton' })
        );
        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(/sendBlocked.*block-one/)
        );
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(mockToast).not.toHaveBeenCalled();
    });
});
