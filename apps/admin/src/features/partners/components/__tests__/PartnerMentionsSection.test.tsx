// @vitest-environment jsdom
/**
 * PartnerMentionsSection — component tests (HOS-377 T-023).
 *
 * Three properties, in order of what they protect:
 *
 * 1. **A batch renders as ONE entry.** The partner sees a four-network campaign
 *    as one thing that happened, and an admin who sees four flat rows cannot
 *    answer the question they are actually asked ("what went out together?").
 * 2. **A channel with no permalink renders no anchor.** WhatsApp and "other"
 *    have no public URL. A dead `<a>` on a surface whose entire promise is
 *    "click through and verify" is worse than plain text.
 * 3. **Newest promotion first.** The order comes from the server, so this pins
 *    that the grouping does not reshuffle it — a `Map`-based regroup that
 *    emitted insertion order of the map rather than of the list would.
 *
 * `fetchApi` is mocked; `@/hooks/use-translations` and `@repo/icons` are mocked
 * globally in `test/setup.tsx`, so `t()` echoes the key.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { PartnerMentionsSection } from '../PartnerMentionsSection';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

const PARTNER_ID = '00000000-0000-4000-a000-000000000001';
const BATCH_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const makeMention = (overrides: Record<string, unknown>) => ({
    id: 'm-1',
    partnerId: PARTNER_ID,
    channel: 'INSTAGRAM',
    batchId: null,
    mentionedAt: '2026-08-01T12:00:00.000Z',
    url: 'https://ig.test/1',
    internalNote: null,
    ...overrides
});

/**
 * Newest first, as the server returns it: an August campaign across three
 * channels, then a standalone July WhatsApp broadcast with no link.
 */
const ITEMS = [
    makeMention({ id: 'a1', batchId: BATCH_ID, channel: 'INSTAGRAM', url: 'https://ig.test/1' }),
    makeMention({ id: 'a2', batchId: BATCH_ID, channel: 'FACEBOOK', url: 'https://fb.test/1' }),
    makeMention({
        id: 'a3',
        batchId: BATCH_ID,
        channel: 'NEWSLETTER',
        url: 'https://hospeda.test/n/8'
    }),
    makeMention({
        id: 'b1',
        channel: 'WHATSAPP',
        url: null,
        mentionedAt: '2026-07-15T12:00:00.000Z'
    })
];

function renderSection(items: unknown[] = ITEMS) {
    mockedFetchApi.mockResolvedValue({
        data: { data: { items, pagination: { total: items.length } } }
        // biome-ignore lint/suspicious/noExplicitAny: the hook reads only .data
    } as any);
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <PartnerMentionsSection partnerId={PARTNER_ID} />
        </QueryClientProvider>
    );
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('PartnerMentionsSection — grouping', () => {
    it('renders a three-channel batch as ONE entry, not three', async () => {
        const { container } = renderSection();

        await waitFor(() => {
            expect(
                screen.getAllByText(/admin-pages\.partnerMentions\.channels\./)
            ).not.toHaveLength(0);
        });

        // Two batches: the August campaign and the standalone July broadcast.
        const batchItems = container.querySelectorAll('ul > li.rounded-md');
        expect(batchItems).toHaveLength(2);
    });

    it('keeps the server order — newest promotion first', async () => {
        const { container } = renderSection();

        await waitFor(() => {
            expect(container.querySelectorAll('ul > li.rounded-md')).toHaveLength(2);
        });

        const dates = Array.from(container.querySelectorAll('ul > li.rounded-md > p')).map(
            (node) => node.textContent ?? ''
        );
        expect(dates[0]).toContain('agosto');
        expect(dates[1]).toContain('julio');
    });
});

describe('PartnerMentionsSection — a channel with no permalink', () => {
    it('renders NO anchor for the WhatsApp row', async () => {
        const { container } = renderSection();

        await waitFor(() => {
            expect(container.querySelectorAll('a')).not.toHaveLength(0);
        });

        // Three linked channels, four rows: the broadcast is not one of them.
        const anchors = Array.from(container.querySelectorAll('a'));
        expect(anchors).toHaveLength(3);
        for (const anchor of anchors) {
            expect(anchor.getAttribute('href')).toBeTruthy();
            expect(anchor.getAttribute('href')).not.toBe('null');
        }
    });

    it('labels the linkless row instead of leaving it blank', async () => {
        renderSection();

        await waitFor(() => {
            expect(
                screen.getByText('admin-pages.partnerMentions.actions.noPublicationLink')
            ).toBeTruthy();
        });
    });
});

describe('PartnerMentionsSection — empty and error states', () => {
    it('shows the empty copy when nothing has been logged yet', async () => {
        renderSection([]);

        await waitFor(() => {
            expect(screen.getByText('admin-pages.partnerMentions.empty')).toBeTruthy();
        });
    });

    it('surfaces a load failure instead of rendering an empty log', async () => {
        // An empty log and a failed request look identical to the admin unless
        // the failure is said out loud — and "nothing was ever promoted" is a
        // damaging thing to imply about a partner who is paying.
        mockedFetchApi.mockRejectedValue(new Error('boom'));
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
        });
        render(
            <QueryClientProvider client={queryClient}>
                <PartnerMentionsSection partnerId={PARTNER_ID} />
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(screen.getByText('admin-pages.partnerMentions.errors.loadFailed')).toBeTruthy();
        });
        expect(screen.queryByText('admin-pages.partnerMentions.empty')).toBeNull();
    });
});

describe('PartnerMentionsSection — internalNote', () => {
    it('shows the note LABELLED as internal, never bare', async () => {
        renderSection([
            makeMention({ id: 'n1', internalNote: 'acordado con la dueña antes del finde' })
        ]);

        await waitFor(() => {
            expect(screen.getByText(/acordado con la dueña/)).toBeTruthy();
        });

        // The label travels with the value: an admin copy-pasting a row into an
        // email is the realistic way this field reaches a partner.
        const noteNode = screen.getByText(/acordado con la dueña/);
        expect(noteNode.textContent).toContain('admin-pages.partnerMentions.fields.internalNote');
    });
});
