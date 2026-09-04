/**
 * @file qrCodeScan.model.test.ts
 *
 * Unit tests for `QrCodeScanModel.getScanAggregateForCode` (HOS-1044 §6.4).
 *
 * **Test strategy**: mirrors `entity-view-admin.model.test.ts` — spies on
 * `getClient` to inject a mock db whose `execute` returns controlled
 * fixtures, in the exact order the five queries are issued
 * (`Promise.all` starts every promise synchronously before any resolves, so
 * `mockResolvedValueOnce` chained in call order is deterministic). No live
 * PostgreSQL instance is required.
 *
 * The `NULL` → `'unknown'` fold and the UTC-safe day math are SERVICE
 * concerns, pinned in `qr-code.scan-stats.test.ts` — this file only checks
 * that the model maps raw rows (both the postgres-js bare-array shape and the
 * node-postgres `{ rows }` shape) into `QrCodeScanAggregate` faithfully,
 * without inventing or dropping a `NULL` key.
 *
 * @module test/models/qrCodeScan.model
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QrCodeScanModel } from '../../src/models/qr-code/qrCodeScan.model.ts';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn(),
    dbLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

const QR_ID = '550e8400-e29b-41d4-a716-446655440001';
const WINDOW_START = new Date('2026-01-09T00:00:00.000Z');

type MockDb = { execute: ReturnType<typeof vi.fn> };

/** Injects a mock db whose `execute` resolves the five queries in call order. */
function injectDb(
    model: QrCodeScanModel,
    results: {
        total: unknown;
        daily: unknown;
        device: unknown;
        os: unknown;
        language: unknown;
    }
): MockDb {
    const execute = vi
        .fn()
        .mockResolvedValueOnce(results.total)
        .mockResolvedValueOnce(results.daily)
        .mockResolvedValueOnce(results.device)
        .mockResolvedValueOnce(results.os)
        .mockResolvedValueOnce(results.language);
    const mockDb: MockDb = { execute };
    vi.spyOn(model as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(mockDb);
    return mockDb;
}

describe('QrCodeScanModel', () => {
    let model: QrCodeScanModel;

    beforeEach(() => {
        model = new QrCodeScanModel();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('maps the qr_code_scans table', () => {
        expect(model.entityName).toBe('qr_code_scans');
        expect((model as unknown as { getTableName: () => string }).getTableName()).toBe(
            'qrCodeScans'
        );
    });

    describe('getScanAggregateForCode', () => {
        it('coerces the total from the bare-array (postgres-js) driver shape', async () => {
            injectDb(model, {
                total: [{ total: '3' }],
                daily: [],
                device: [],
                os: [],
                language: []
            });

            const result = await model.getScanAggregateForCode({
                qrCodeId: QR_ID,
                windowStart: WINDOW_START
            });

            expect(result.total).toBe(3);
            expect(typeof result.total).toBe('number');
        });

        it('coerces the total from the { rows } (node-postgres) driver shape', async () => {
            injectDb(model, {
                total: { rows: [{ total: 3 }] },
                daily: { rows: [] },
                device: { rows: [] },
                os: { rows: [] },
                language: { rows: [] }
            });

            const result = await model.getScanAggregateForCode({
                qrCodeId: QR_ID,
                windowStart: WINDOW_START
            });

            expect(result.total).toBe(3);
        });

        it('returns total: 0 when the table holds no matching rows', async () => {
            injectDb(model, { total: [], daily: [], device: [], os: [], language: [] });

            const result = await model.getScanAggregateForCode({
                qrCodeId: QR_ID,
                windowStart: WINDOW_START
            });

            expect(result.total).toBe(0);
            expect(result.dailySeries).toEqual([]);
        });

        it('maps daily rows with numeric coercion and preserves SQL ordering', async () => {
            injectDb(model, {
                total: [{ total: '2' }],
                daily: [
                    { date: '2026-01-10', total: '1' },
                    { date: '2026-01-12', total: '1' }
                ],
                device: [],
                os: [],
                language: []
            });

            const result = await model.getScanAggregateForCode({
                qrCodeId: QR_ID,
                windowStart: WINDOW_START
            });

            expect(result.dailySeries).toEqual([
                { date: '2026-01-10', total: 1 },
                { date: '2026-01-12', total: 1 }
            ]);
        });

        /**
         * The model must not invent an 'unknown' string, and must not drop a
         * `NULL` grouping key — both are the caller's job
         * (`buildQrScanBreakdown` in `qr-code.scan-stats.ts`). This is the
         * boundary test proving the raw `key: null` survives the model layer
         * unchanged, which is what that later fold depends on.
         */
        it('passes a NULL grouping key through as key: null, never as a placeholder string', async () => {
            injectDb(model, {
                total: [{ total: '2' }],
                daily: [],
                device: [{ key: null, total: '2' }],
                os: [
                    { key: null, total: '1' },
                    { key: 'IOS', total: '1' }
                ],
                language: [{ key: null, total: '2' }]
            });

            const result = await model.getScanAggregateForCode({
                qrCodeId: QR_ID,
                windowStart: WINDOW_START
            });

            expect(result.byDeviceType).toEqual([{ key: null, total: 2 }]);
            expect(result.byOs).toEqual([
                { key: null, total: 1 },
                { key: 'IOS', total: 1 }
            ]);
            expect(result.byBrowserLanguage).toEqual([{ key: null, total: 2 }]);
        });

        it('issues the total, daily, device, os and language queries scoped to the given qrCodeId', async () => {
            const mockDb = injectDb(model, {
                total: [{ total: '0' }],
                daily: [],
                device: [],
                os: [],
                language: []
            });

            await model.getScanAggregateForCode({ qrCodeId: QR_ID, windowStart: WINDOW_START });

            expect(mockDb.execute).toHaveBeenCalledTimes(5);
            for (const call of mockDb.execute.mock.calls) {
                const fragment = call[0] as { queryChunks?: unknown[] };
                // Drizzle's `sql` template wraps literal SQL text in a
                // `StringChunk` (`{ value: string[] }`) and passes each bound
                // parameter through as its own queryChunks entry — a plain
                // string for `qrCodeId`, a `Date` for `windowStart`. Neither
                // is a bare string, so the literal-text extraction below reads
                // `StringChunk.value` explicitly rather than `typeof === 'string'`.
                const literalText = (fragment.queryChunks ?? [])
                    .filter(
                        (chunk): chunk is { value: string[] } =>
                            typeof chunk === 'object' &&
                            chunk !== null &&
                            Array.isArray((chunk as { value?: unknown }).value)
                    )
                    .flatMap((chunk) => chunk.value)
                    .join(' ');
                expect(literalText).toContain('qr_code_scans');
                // Every query is bound to the requested code, never scoped to
                // "all codes" — the parameter travels as a bare string chunk.
                expect(fragment.queryChunks).toContain(QR_ID);
            }
        });
    });
});
