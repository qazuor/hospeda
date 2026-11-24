/**
 * @file SendConfirmDialog.test.tsx
 * Tests the audience count shown in the send confirmation (HOS-2586).
 */
import type { NewsletterCampaign } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SendConfirmDialog } from '@/routes/_authed/newsletter/campaigns/-components/SendConfirmDialog';

const mockUseAudience = vi.fn();

vi.mock('@/hooks/newsletter', () => ({
    useCampaignAudienceCount: (args: unknown) => mockUseAudience(args),
    useSendCampaign: () => ({ mutateAsync: vi.fn(), isPending: false })
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ addToast: vi.fn() }) }));
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
    beforeEach(() => mockUseAudience.mockReset());

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
});
