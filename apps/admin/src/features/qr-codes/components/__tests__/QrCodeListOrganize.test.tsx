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

import { applyTagDiff, diffTagSelection } from '../../qr-code-tags.diff';
import {
    applyQrCodeFilterChange,
    DEFAULT_QR_CODE_LIST_FILTERS,
    QR_FILTER_ALL,
    toQrCodeListQueryFilters
} from '../QrCodeListFilters';
import { tagSelectionChanged, toggleTagId } from '../QrCodeTagPicker';
import { QrCodeTagsCell } from '../QrCodeTagsCell';

const QR_ID = '11111111-1111-4111-8111-111111111111';
const TAG_A = '22222222-2222-4222-8222-222222222222';
const TAG_B = '33333333-3333-4333-8333-333333333333';
const TAG_C = '44444444-4444-4444-8444-444444444444';

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

    /** N7: a campaign literally named like the sentinel is still a filter. */
    it('treats a campaign named ALL as a real campaign; null as no filter', () => {
        expect(
            toQrCodeListQueryFilters({
                filters: { ...DEFAULT_QR_CODE_LIST_FILTERS, utmCampaign: 'ALL' }
            })
        ).toStrictEqual({ source: 'MANUAL', utmCampaign: 'ALL' });
        expect(DEFAULT_QR_CODE_LIST_FILTERS.utmCampaign).toBeNull();
    });
});

describe('applyQrCodeFilterChange', () => {
    it('switches MANUAL to all when a purpose is picked', () => {
        expect(
            applyQrCodeFilterChange({
                current: DEFAULT_QR_CODE_LIST_FILTERS,
                key: 'purpose',
                next: QrCodePurposeEnum.MENU
            })
        ).toMatchObject({ source: QR_FILTER_ALL, purpose: 'MENU' });
    });

    it('keeps MANUAL for an entity type: hand-made codes can point at one', () => {
        expect(
            applyQrCodeFilterChange({
                current: DEFAULT_QR_CODE_LIST_FILTERS,
                key: 'entityType',
                next: EntityTypeEnum.VENUE
            })
        ).toMatchObject({ source: 'MANUAL', entityType: 'VENUE' });
    });

    it('leaves an explicit GENERATED source alone', () => {
        expect(
            applyQrCodeFilterChange({
                current: { ...DEFAULT_QR_CODE_LIST_FILTERS, source: QrCodeSourceEnum.GENERATED },
                key: 'purpose',
                next: QrCodePurposeEnum.MENU
            }).source
        ).toBe('GENERATED');
    });
});

describe('tag diff (I2)', () => {
    it('applies the edit to the server set, not to the stale one', () => {
        const diff = diffTagSelection({ before: [TAG_A], after: [TAG_A, TAG_B] });
        expect(diff).toStrictEqual({ added: [TAG_B], removed: [] });
        // Another tab added C meanwhile: it survives.
        expect(applyTagDiff({ current: [TAG_A, TAG_C], diff })).toStrictEqual([
            TAG_A,
            TAG_C,
            TAG_B
        ]);
    });

    it('removes only what the operator removed', () => {
        const diff = diffTagSelection({ before: [TAG_A, TAG_B], after: [TAG_B] });
        expect(applyTagDiff({ current: [TAG_A, TAG_B, TAG_C], diff })).toStrictEqual([
            TAG_B,
            TAG_C
        ]);
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

    it('renders the tag colour', () => {
        const client = new QueryClient();
        render(
            <QueryClientProvider client={client}>
                <QrCodeTagsCell
                    qrCodeId={QR_ID}
                    tags={[{ id: TAG_A, name: 'Verano', slug: 'verano', color: 'BLUE' as never }]}
                    canEdit={false}
                />
            </QueryClientProvider>
        );

        expect(screen.getByRole('img', { name: 'Color: BLUE' })).toBeInTheDocument();
    });

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

    /** I2: a row read minutes ago must not undo a newer change. */
    it('keeps a tag another tab added since the row was read', async () => {
        // Arrange: the row shows [A]; the server holds [A, C] by now.
        fetchApiMock.mockImplementation(
            async ({ path, method }: { path: string; method?: string }) => {
                if (method === 'PUT') return { data: { data: { items: [] } } };
                if (path.endsWith(`/${QR_ID}/tags`)) {
                    return {
                        data: {
                            data: {
                                items: [
                                    { id: TAG_A, name: 'Verano', slug: 'verano', color: null },
                                    { id: TAG_C, name: 'Puerto', slug: 'puerto', color: null }
                                ]
                            }
                        }
                    };
                }
                return {
                    data: {
                        data: {
                            items: [
                                { id: TAG_A, name: 'Verano', slug: 'verano', color: null },
                                { id: TAG_B, name: 'Costanera', slug: 'costanera', color: null }
                            ],
                            pagination: { total: 2 }
                        }
                    }
                };
            }
        );
        renderCell(true);

        // Act: add B.
        fireEvent.click(screen.getByRole('button', { name: /editTrigger/ }));
        fireEvent.click(await screen.findByRole('checkbox', { name: 'Costanera' }));
        fireEvent.click(screen.getByRole('button', { name: 'admin-qr-codes.tags.save' }));

        // Assert: C survives.
        await waitFor(() =>
            expect(fetchApiMock).toHaveBeenCalledWith({
                path: `/api/v1/admin/qr-codes/${QR_ID}/tags`,
                method: 'PUT',
                body: { tagIds: [TAG_A, TAG_C, TAG_B] }
            })
        );
    });
});
