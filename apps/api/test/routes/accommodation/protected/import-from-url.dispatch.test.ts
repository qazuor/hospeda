/**
 * Unit tests for `buildImportFromUrlDispatchResponse` (HOS-50 / SPEC-277 R3 T-010).
 *
 * Pure-function tests (no Hono context, no service, no network) covering the
 * 4 scenarios required by T-010:
 * - Fast source (Generic/Google/MercadoLibre) stays `200` — regression.
 * - Airbnb with credentials (async run started) returns `202` with the run
 *   handle shape.
 * - Airbnb missing credentials still returns `200` with a sync failure
 *   (the async-capable adapter could not even start the run).
 * - Booking whose JSON-LD tier was sufficient stays `200` (the async-capable
 *   adapter resolved immediately via `{ raw }`).
 */

import type { ImportDispatchResult } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import { buildImportFromUrlDispatchResponse } from '../../../../src/routes/accommodation/protected/import-from-url';
import type { AiGateState } from '../../../../src/routes/accommodation/protected/import-from-url.ai';

const noGate: AiGateState = { blockedReason: null };

describe('buildImportFromUrlDispatchResponse', () => {
    it('returns 200 for a fast source resolved synchronously (regression)', () => {
        // Arrange — a Generic/Google/MercadoLibre dispatch always resolves `sync`.
        const dispatch: ImportDispatchResult = {
            kind: 'sync',
            response: {
                draft: { name: { value: 'Hotel Sol', source: 'jsonld' } },
                source: 'generic',
                methodsUsed: ['jsonld'],
                partial: true
            }
        };

        // Act
        const result = buildImportFromUrlDispatchResponse(dispatch, noGate);

        // Assert
        expect(result.statusCode).toBe(200);
        expect(result.body).toMatchObject({ source: 'generic' });
    });

    it('returns 202 with the run handle when Airbnb starts an async Apify run (credentials present)', () => {
        // Arrange
        const dispatch: ImportDispatchResult = {
            kind: 'async',
            runId: 'run-abc123',
            datasetId: 'dataset-xyz789',
            source: 'airbnb',
            startedAt: '2026-07-02T09:20:00.000Z',
            url: 'https://www.airbnb.com/rooms/12345'
        };

        // Act
        const result = buildImportFromUrlDispatchResponse(dispatch, noGate);

        // Assert
        expect(result.statusCode).toBe(202);
        expect(result.body).toEqual({
            runId: 'run-abc123',
            datasetId: 'dataset-xyz789',
            source: 'airbnb',
            startedAt: '2026-07-02T09:20:00.000Z',
            url: 'https://www.airbnb.com/rooms/12345'
        });
    });

    it('returns 200 with a sync failure when Airbnb is missing credentials (async start never happened)', () => {
        // Arrange — the orchestrator's dispatchImportFromUrl already finalized
        // the failureCode through the normal pipeline when extractAsync could
        // not even start the run.
        const dispatch: ImportDispatchResult = {
            kind: 'sync',
            response: {
                draft: {},
                source: 'none',
                methodsUsed: [],
                partial: true,
                failureCode: 'credentials_missing'
            }
        };

        // Act
        const result = buildImportFromUrlDispatchResponse(dispatch, noGate);

        // Assert
        expect(result.statusCode).toBe(200);
        expect(result.body).toMatchObject({ source: 'none', failureCode: 'credentials_missing' });
    });

    it('returns 200 when Booking resolves immediately via its JSON-LD tier (no Apify run needed)', () => {
        // Arrange — BookingAdapter.extractAsync() returned `{ raw }` because the
        // free JSON-LD-first tier already had enough data.
        const dispatch: ImportDispatchResult = {
            kind: 'sync',
            response: {
                draft: { name: { value: 'Hotel Booking JSON-LD', source: 'jsonld' } },
                source: 'booking',
                methodsUsed: ['jsonld'],
                partial: true
            }
        };

        // Act
        const result = buildImportFromUrlDispatchResponse(dispatch, noGate);

        // Assert
        expect(result.statusCode).toBe(200);
        expect(result.body).toMatchObject({ source: 'booking' });
    });

    it('applies the AI-gate notice on the sync branch but not on the async branch', () => {
        // Arrange
        const gate: AiGateState = { blockedReason: 'quota' };
        const syncDispatch: ImportDispatchResult = {
            kind: 'sync',
            response: {
                draft: { name: { value: 'Hotel Sol', source: 'jsonld' } },
                source: 'generic',
                methodsUsed: ['jsonld'],
                partial: false
            }
        };
        const asyncDispatch: ImportDispatchResult = {
            kind: 'async',
            runId: 'run-1',
            datasetId: 'dataset-1',
            source: 'airbnb',
            startedAt: '2026-07-02T09:20:00.000Z',
            url: 'https://www.airbnb.com/rooms/1'
        };

        // Act
        const syncResult = buildImportFromUrlDispatchResponse(syncDispatch, gate);
        const asyncResult = buildImportFromUrlDispatchResponse(asyncDispatch, gate);

        // Assert — sync branch gets the notice appended to `message`.
        expect(syncResult.statusCode).toBe(200);
        expect((syncResult.body as { message?: string }).message).toContain(
            'límite mensual de extracción con IA'
        );
        // Async branch has no `message` field at all (different response shape).
        expect(asyncResult.statusCode).toBe(202);
        expect(asyncResult.body).not.toHaveProperty('message');
    });
});
