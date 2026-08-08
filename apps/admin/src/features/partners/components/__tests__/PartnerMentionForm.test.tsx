// @vitest-environment jsdom
/**
 * PartnerMentionForm — component tests (HOS-377 T-024).
 *
 * The property worth the most here is AC-7 and it is a REQUEST COUNT: picking
 * three channels must produce ONE POST carrying three entries, not three POSTs.
 * Three POSTs would give the partner three ungrouped log entries and three
 * emails about one campaign, and a test that only asserted "a request went out"
 * would pass on exactly that bug.
 *
 * The second is the per-channel URL rule cutting both ways: a channel that
 * produces a permalink blocks submit without one, while WhatsApp — which has no
 * public permalink — submits fine empty. Asserting only the blocking half would
 * pass on a form that demands a URL for every channel and makes admins invent
 * links for broadcasts.
 *
 * `fetchApi` is mocked; `@/hooks/use-translations` and `@repo/icons` are mocked
 * globally in `test/setup.tsx`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { PartnerMentionForm } from '../PartnerMentionForm';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

const PARTNER_ID = '00000000-0000-4000-a000-000000000001';

function renderForm(onSubmitted?: (created: number) => void) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <PartnerMentionForm
                partnerId={PARTNER_ID}
                onSubmitted={onSubmitted}
            />
        </QueryClientProvider>
    );
}

/**
 * Clicks a channel chip.
 *
 * Addressed by its i18n KEY rather than its Spanish label: `test/setup.tsx`
 * mocks `t()` to echo the key, and keying off the copy would make these tests
 * fail on a wording change that breaks nothing.
 */
function selectChannel(channel: string) {
    fireEvent.click(
        screen.getByRole('button', { name: `admin-pages.partnerMentions.channels.${channel}` })
    );
}

/** The submit button, found by its type rather than by translated copy. */
function submitButton(): HTMLButtonElement {
    const button = document
        .querySelector('form')
        ?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (!button) throw new Error('submit button not found');
    return button;
}

function urlInput(channel: string): HTMLInputElement {
    return document.getElementById(`mention-url-${channel}`) as HTMLInputElement;
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('PartnerMentionForm — channel selection reveals its own URL field', () => {
    it('renders no URL input until a channel is picked', () => {
        renderForm();

        expect(urlInput('INSTAGRAM')).toBeNull();
        expect(document.querySelectorAll('input[type="url"]')).toHaveLength(0);
    });

    it('renders exactly THREE URL inputs for three selected channels', () => {
        renderForm();

        selectChannel('INSTAGRAM');
        selectChannel('FACEBOOK');
        selectChannel('NEWSLETTER');

        expect(document.querySelectorAll('input[type="url"]')).toHaveLength(3);
        expect(urlInput('INSTAGRAM')).not.toBeNull();
        expect(urlInput('FACEBOOK')).not.toBeNull();
        expect(urlInput('NEWSLETTER')).not.toBeNull();
    });

    it('removes a channel URL field when the channel is deselected', () => {
        renderForm();

        selectChannel('INSTAGRAM');
        expect(document.querySelectorAll('input[type="url"]')).toHaveLength(1);

        selectChannel('INSTAGRAM');
        expect(document.querySelectorAll('input[type="url"]')).toHaveLength(0);
    });
});

describe('PartnerMentionForm — AC-7: N channels, ONE request', () => {
    it('posts a SINGLE request carrying three entries', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { data: { mentions: [{}, {}, {}] } }
            // biome-ignore lint/suspicious/noExplicitAny: the hook reads only .data
        } as any);
        const onSubmitted = vi.fn();
        renderForm(onSubmitted);

        selectChannel('INSTAGRAM');
        selectChannel('FACEBOOK');
        selectChannel('NEWSLETTER');
        fireEvent.change(urlInput('INSTAGRAM'), { target: { value: 'https://ig.test/1' } });
        fireEvent.change(urlInput('FACEBOOK'), { target: { value: 'https://fb.test/1' } });
        fireEvent.change(urlInput('NEWSLETTER'), { target: { value: 'https://hospeda.test/n/8' } });

        fireEvent.click(submitButton());

        await waitFor(() => expect(onSubmitted).toHaveBeenCalled());

        // THE assertion. Three calls would mean three batches, three log
        // entries and three emails for one campaign.
        expect(mockedFetchApi).toHaveBeenCalledTimes(1);

        const call = mockedFetchApi.mock.calls[0]?.[0] as {
            path: string;
            method: string;
            body: { entries: { channel: string; url?: string }[] };
        };
        expect(call.method).toBe('POST');
        expect(call.path).toBe(`/api/v1/admin/partners/${PARTNER_ID}/mentions`);
        expect(call.body.entries).toHaveLength(3);
        expect(call.body.entries.map((entry) => entry.channel)).toEqual([
            'INSTAGRAM',
            'FACEBOOK',
            'NEWSLETTER'
        ]);
    });

    it('never sends partnerId in the body — the path is the authoritative scope', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { data: { mentions: [{}] } }
            // biome-ignore lint/suspicious/noExplicitAny: the hook reads only .data
        } as any);
        renderForm();

        selectChannel('WHATSAPP');
        fireEvent.click(submitButton());

        await waitFor(() => expect(mockedFetchApi).toHaveBeenCalled());

        const call = mockedFetchApi.mock.calls[0]?.[0] as { body: Record<string, unknown> };
        expect(call.body).not.toHaveProperty('partnerId');
        expect(call.body).not.toHaveProperty('batchId');
    });
});

describe('PartnerMentionForm — the URL rule cuts both ways', () => {
    it('blocks submit when a permalink channel has no URL', async () => {
        renderForm();

        selectChannel('INSTAGRAM');
        fireEvent.click(submitButton());

        await waitFor(() => {
            expect(urlInput('INSTAGRAM').getAttribute('aria-invalid')).toBe('true');
        });
        expect(mockedFetchApi).not.toHaveBeenCalled();
    });

    it('submits WhatsApp with NO url — a broadcast has no public permalink', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { data: { mentions: [{}] } }
            // biome-ignore lint/suspicious/noExplicitAny: the hook reads only .data
        } as any);
        const onSubmitted = vi.fn();
        renderForm(onSubmitted);

        selectChannel('WHATSAPP');
        fireEvent.click(submitButton());

        await waitFor(() => expect(onSubmitted).toHaveBeenCalled());

        const call = mockedFetchApi.mock.calls[0]?.[0] as {
            body: { entries: { channel: string; url?: string }[] };
        };
        expect(call.body.entries).toEqual([{ channel: 'WHATSAPP' }]);
    });

    it('blocks the whole submit when ONE of several channels is missing its URL', async () => {
        // The batch is all-or-nothing: a campaign that logged three of four
        // networks understates what was done, and the partner is shown that.
        renderForm();

        selectChannel('INSTAGRAM');
        selectChannel('FACEBOOK');
        fireEvent.change(urlInput('INSTAGRAM'), { target: { value: 'https://ig.test/1' } });

        fireEvent.click(submitButton());

        await waitFor(() => {
            expect(urlInput('FACEBOOK').getAttribute('aria-invalid')).toBe('true');
        });
        expect(urlInput('INSTAGRAM').getAttribute('aria-invalid')).not.toBe('true');
        expect(mockedFetchApi).not.toHaveBeenCalled();
    });

    it('refuses a submit with no channel selected at all', async () => {
        renderForm();

        fireEvent.click(submitButton());

        await waitFor(() => expect(mockedFetchApi).not.toHaveBeenCalled());
    });
});
