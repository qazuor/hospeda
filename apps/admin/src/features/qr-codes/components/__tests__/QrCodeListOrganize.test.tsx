// @vitest-environment jsdom
/**
 * HOS-2679 — the pure pieces behind the QR list's filters and tag editing,
 * plus the row tag cell's save flow.
 */

import { EntityTypeEnum, QrCodePurposeEnum, QrCodeSourceEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchApiMock = vi.hoisted(() => vi.fn());
const addToastMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/client', () => ({ fetchApi: fetchApiMock }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ addToast: addToastMock }) }));

import {
    DEFAULT_QR_CODE_LIST_FILTERS,
    QR_FILTER_ALL,
    toQrCodeListQueryFilters
} from '../QrCodeListFilters';
import { tagSelectionChanged, toggleTagId } from '../QrCodeTagPicker';
import { QrCodeTagsCell } from '../QrCodeTagsCell';

const QR_ID = '11111111-1111-4111-8111-111111111111';
const TAG_A = '22222222-2222-4222-8222-222222222222';
const TAG_B = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
    fetchApiMock.mockReset();
    addToastMock.mockReset();
});

describe('toQrCodeListQueryFilters', () => {
    it('sends only MANUAL by default', () => {
        expect(toQrCodeListQueryFilters({ filters: DEFAULT_QR_CODE_LIST_FILTERS })).toStrictEqual({
            source: QrCodeSourceEnum.MANUAL
        });
    });

    it('sends nothing at all when every filter is ALL', () => {
        expect(
            toQrCodeListQueryFilters({
                filters: { ...DEFAULT_QR_CODE_LIST_FILTERS, source: QR_FILTER_ALL }
            })
        ).toStrictEqual({});
    });

    it('maps every filter, joining tag ids with commas', () => {
        expect(
            toQrCodeListQueryFilters({
                filters: {
                    source: QrCodeSourceEnum.GENERATED,
                    entityType: EntityTypeEnum.VENUE,
                    purpose: QrCodePurposeEnum.MENU,
                    isActive: 'false',
                    utmCampaign: 'verano 2026',
                    tagIds: [TAG_A, TAG_B]
                }
            })
        ).toStrictEqual({
            source: 'GENERATED',
            entityType: 'VENUE',
            purpose: 'MENU',
            isActive: 'false',
            utmCampaign: 'verano 2026',
            tagIds: `${TAG_A},${TAG_B}`
        });
    });
});

describe('toggleTagId / tagSelectionChanged', () => {
    it('adds a missing id and removes a present one', () => {
        expect(toggleTagId({ value: [TAG_A], id: TAG_B })).toStrictEqual([TAG_A, TAG_B]);
        expect(toggleTagId({ value: [TAG_A, TAG_B], id: TAG_A })).toStrictEqual([TAG_B]);
    });

    it('compares selections as sets', () => {
        expect(tagSelectionChanged({ before: [TAG_A, TAG_B], after: [TAG_B, TAG_A] })).toBe(false);
        expect(tagSelectionChanged({ before: [TAG_A], after: [TAG_B] })).toBe(true);
        expect(tagSelectionChanged({ before: [TAG_A], after: [] })).toBe(true);
        expect(tagSelectionChanged({ before: [], after: [] })).toBe(false);
    });
});

describe('QrCodeTagsCell', () => {
    function renderCell(canEdit: boolean) {
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
        });
        return render(
            <QueryClientProvider client={client}>
                <QrCodeTagsCell
                    qrCodeId={QR_ID}
                    tags={[{ id: TAG_A, name: 'Verano', slug: 'verano', color: null }]}
                    canEdit={canEdit}
                />
            </QueryClientProvider>
        );
    }

    it('shows the tags without an editor for a read-only viewer', () => {
        renderCell(false);

        expect(screen.getByText('Verano')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /editTrigger/ })).toBeNull();
    });

    it('PUTs the complete new selection once, on save', async () => {
        // Arrange: the catalog read, then the PUT.
        fetchApiMock.mockImplementation(async ({ method }: { method?: string }) =>
            method === 'PUT'
                ? { data: { data: { items: [] } } }
                : {
                      data: {
                          data: {
                              items: [
                                  { id: TAG_A, name: 'Verano', slug: 'verano', color: null },
                                  { id: TAG_B, name: 'Costanera', slug: 'costanera', color: null }
                              ]
                          }
                      }
                  }
        );
        renderCell(true);

        // Act
        fireEvent.click(screen.getByRole('button', { name: /editTrigger/ }));
        fireEvent.click(await screen.findByRole('checkbox', { name: 'Costanera' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Verano' }));
        // Ticking boxes alone writes nothing.
        expect(fetchApiMock.mock.calls.some(([arg]) => arg.method === 'PUT')).toBe(false);
        fireEvent.click(screen.getByRole('button', { name: 'admin-qr-codes.tags.save' }));

        // Assert
        await waitFor(() =>
            expect(fetchApiMock).toHaveBeenCalledWith({
                path: `/api/v1/admin/qr-codes/${QR_ID}/tags`,
                method: 'PUT',
                body: { tagIds: [TAG_B] }
            })
        );
        expect(fetchApiMock.mock.calls.filter(([arg]) => arg.method === 'PUT')).toHaveLength(1);
    });
});
