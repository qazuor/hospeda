import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { CampaignPreview } from '@/routes/_authed/newsletter/campaigns/-components/CampaignPreview';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));
const bodyJson = { type: 'doc', content: [{ type: 'dynamicBlock' }] };
const report = {
    blocks: [
        {
            blockKey: 'block-one',
            candidates: ['a', 'b'],
            dropped: [{ id: 'c', reason: 'not_published' }],
            repeatsUsed: 0,
            belowMin: true,
            action: 'hide_block'
        }
    ]
};

function preview({ dynamic = true, id = 'campaign-one' } = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <CampaignPreview
                html="<p>Static body</p>"
                subject="Subject"
                campaignId={id}
                bodyJson={dynamic ? bodyJson : { type: 'doc', content: [] }}
            />
        </QueryClientProvider>
    );
}

describe('CampaignPreview dynamic content', () => {
    it('shows below-minimum diagnostics from a rejected preview', async () => {
        vi.mocked(fetchApi).mockRejectedValue(
            new ApiError('Blocked', {
                status: 422,
                body: { error: { code: 'DYNAMIC_BLOCK_BELOW_MIN', details: { report } } }
            })
        );
        preview();
        expect(
            await screen.findByText('admin-newsletter.dynamicBlock.sendBlocked')
        ).toBeInTheDocument();
        expect(screen.getByText('block-one')).toBeInTheDocument();
        expect(screen.getByText('admin-newsletter.dynamicBlock.found: 2')).toBeInTheDocument();
        expect(screen.getByText('admin-newsletter.dynamicBlock.dropped: 1')).toBeInTheDocument();
        expect(
            screen.queryByText('admin-newsletter.dynamicBlock.previewError')
        ).not.toBeInTheDocument();
    });
    beforeEach(() => {
        vi.mocked(fetchApi).mockReset();
    });
    it('posts to the resolver and isolates returned HTML in an empty sandbox', async () => {
        vi.mocked(fetchApi).mockResolvedValue({
            status: 200,
            data: { data: { html: '<h1>Resolved</h1>', report } }
        });
        preview();
        const frame = await screen.findByTitle('admin-newsletter.dynamicBlock.previewTitle');
        expect(frame).toHaveAttribute('sandbox', '');
        expect(frame).toHaveAttribute('srcdoc', '<h1>Resolved</h1>');
        expect(fetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/newsletter/campaigns/campaign-one/resolve-preview',
                method: 'POST'
            })
        );
        expect(screen.getByText('admin-newsletter.dynamicBlock.found: 2')).toBeInTheDocument();
        expect(screen.getByText('admin-newsletter.dynamicBlock.dropped: 1')).toBeInTheDocument();
        expect(screen.getByText('admin-newsletter.dynamicBlock.belowMinimum')).toBeInTheDocument();
        expect(screen.getByText(/actions.hide_block/)).toBeInTheDocument();
    });
    it('keeps static preview and makes no resolution request', () => {
        preview({ dynamic: false });
        expect(screen.getByText('Static body')).toBeInTheDocument();
        expect(fetchApi).not.toHaveBeenCalled();
    });
    it('asks to save a new draft before resolving', () => {
        preview({ id: '' });
        expect(screen.getByText('admin-newsletter.dynamicBlock.saveFirst')).toBeInTheDocument();
        expect(fetchApi).not.toHaveBeenCalled();
    });
    it('shows a recoverable localized resolution failure', async () => {
        vi.mocked(fetchApi).mockRejectedValue(new Error('offline'));
        preview();
        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                'admin-newsletter.dynamicBlock.previewError'
            )
        );
        expect(
            screen.getByRole('button', { name: 'admin-newsletter.dynamicBlock.retry' })
        ).toBeInTheDocument();
    });
});
