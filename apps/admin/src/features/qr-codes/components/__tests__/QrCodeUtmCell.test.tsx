// @vitest-environment jsdom
/**
 * HOS-2679 — the UTM cell of the admin QR list.
 *
 * The pure helpers are asserted on exact strings: the editor's whole promise is
 * that saving touches ONLY the five UTM params, so a rewrite that reorders,
 * re-encodes or drops any other byte is a bug even if the UTMs come out right.
 * The component tests assert the request that leaves (the PATCH body), not the
 * inputs' state.
 */

import { type QrCodeAdminListItem, QrCodeSourceEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchApiMock = vi.hoisted(() => vi.fn());
const addToastMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/client', () => ({ fetchApi: fetchApiMock }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ addToast: addToastMock }) }));

import { buildUtmTargetUrl, QrCodeUtmCell, toUtmDraft } from '../QrCodeUtmCell';

const EMPTY_DRAFT = {
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: ''
};

const NO_UTM = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null
};

function row(over: Partial<QrCodeAdminListItem>): QrCodeAdminListItem {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'Live2345',
        label: 'Cartelera',
        targetUrl: 'https://hospeda.com.ar/es/destinos/colon/?ref=a&utm_source=flyer#mapa',
        source: QrCodeSourceEnum.MANUAL,
        tags: [],
        scanUrl: 'https://hospeda.com.ar/qr/Live2345/',
        scanUtm: { ...NO_UTM, utm_source: 'flyer', utm_medium: 'print', utm_campaign: 'manual' },
        ...over
    } as QrCodeAdminListItem;
}

function renderCell(props: { row: QrCodeAdminListItem; canEdit: boolean }) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return render(
        <QueryClientProvider client={client}>
            <QrCodeUtmCell {...props} />
        </QueryClientProvider>
    );
}

beforeEach(() => {
    fetchApiMock.mockReset();
    addToastMock.mockReset();
});

describe('toUtmDraft', () => {
    it('reads each key, blank for the absent ones', () => {
        expect(
            toUtmDraft({ url: 'https://x.test/?utm_source=qr&utm_campaign=verano%202026' })
        ).toStrictEqual({ ...EMPTY_DRAFT, utm_source: 'qr', utm_campaign: 'verano 2026' });
    });
});

describe('buildUtmTargetUrl', () => {
    const url = 'https://hospeda.com.ar/es/?ref=a&utm_source=flyer#mapa';

    it('answers null when nothing changed, whitespace included', () => {
        const draft = { ...toUtmDraft({ url }), utm_source: '  flyer ' };
        expect(buildUtmTargetUrl({ url, draft })).toBeNull();
    });

    it('rewrites in place and appends new keys, keeping every other byte', () => {
        const draft = { ...toUtmDraft({ url }), utm_source: 'cartel', utm_campaign: 'verano 2026' };
        expect(buildUtmTargetUrl({ url, draft })).toBe(
            'https://hospeda.com.ar/es/?ref=a&utm_source=cartel&utm_campaign=verano%202026#mapa'
        );
    });

    it('removes a key whose field was cleared', () => {
        const draft = { ...toUtmDraft({ url }), utm_source: '' };
        expect(buildUtmTargetUrl({ url, draft })).toBe('https://hospeda.com.ar/es/?ref=a#mapa');
    });
});

describe('QrCodeUtmCell', () => {
    it('shows the landing UTMs of a GENERATED code, read-only', () => {
        renderCell({
            row: row({
                source: QrCodeSourceEnum.GENERATED,
                scanUtm: { ...NO_UTM, utm_source: 'qr', utm_campaign: 'venue', utm_content: 'menu' }
            }),
            canEdit: true
        });

        expect(screen.getByText('venue')).toBeInTheDocument();
        expect(screen.getByText('menu')).toBeInTheDocument();
        expect(screen.getByText('admin-qr-codes.utm.generatedHint')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /admin-qr-codes\.utm\.edit/ })).toBeNull();
    });

    it('hides the editor from a viewer without update permission', () => {
        renderCell({ row: row({}), canEdit: false });

        expect(screen.queryByRole('button', { name: /admin-qr-codes\.utm\.edit/ })).toBeNull();
    });

    it('says so when a code lands with no UTM at all', () => {
        renderCell({ row: row({ scanUtm: NO_UTM }), canEdit: false });

        expect(screen.getByText('admin-qr-codes.utm.none')).toBeInTheDocument();
    });

    it('PATCHes only the rewritten targetUrl of a MANUAL code', async () => {
        // Arrange
        fetchApiMock.mockResolvedValue({ data: { data: {} } });
        renderCell({ row: row({}), canEdit: true });

        // Act
        fireEvent.click(screen.getByRole('button', { name: /admin-qr-codes\.utm\.edit/ }));
        fireEvent.change(screen.getByLabelText('utm_campaign'), {
            target: { value: 'verano' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'admin-qr-codes.utm.save' }));

        // Assert
        await waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(1));
        expect(fetchApiMock.mock.calls[0]?.[0]).toStrictEqual({
            path: '/api/v1/admin/qr-codes/11111111-1111-4111-8111-111111111111',
            method: 'PATCH',
            body: {
                targetUrl:
                    'https://hospeda.com.ar/es/destinos/colon/?ref=a&utm_source=flyer&utm_campaign=verano#mapa'
            }
        });
        await waitFor(() =>
            expect(addToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ variant: 'success' })
            )
        );
    });

    it('sends nothing when the editor is saved unchanged', async () => {
        renderCell({ row: row({}), canEdit: true });

        fireEvent.click(screen.getByRole('button', { name: /admin-qr-codes\.utm\.edit/ }));
        fireEvent.click(screen.getByRole('button', { name: 'admin-qr-codes.utm.save' }));

        await waitFor(() =>
            expect(screen.queryByRole('button', { name: 'admin-qr-codes.utm.save' })).toBeNull()
        );
        expect(fetchApiMock).not.toHaveBeenCalled();
    });

    it('toasts the failure and keeps the editor open', async () => {
        fetchApiMock.mockRejectedValue(new Error('400'));
        renderCell({ row: row({}), canEdit: true });

        fireEvent.click(screen.getByRole('button', { name: /admin-qr-codes\.utm\.edit/ }));
        fireEvent.change(screen.getByLabelText('utm_term'), { target: { value: 'x' } });
        fireEvent.click(screen.getByRole('button', { name: 'admin-qr-codes.utm.save' }));

        await waitFor(() =>
            expect(addToastMock).toHaveBeenCalledWith({
                message: 'admin-qr-codes.utm.saveError',
                variant: 'error'
            })
        );
        expect(screen.getByRole('button', { name: 'admin-qr-codes.utm.save' })).toBeInTheDocument();
    });
});
