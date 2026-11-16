/**
 * @file ai-assistants.test.ts
 * @description Unit tests for the AI assistants panel helpers (HOS-2184 T-028).
 */

import { describe, expect, it } from 'vitest';
import {
    buildAiConnectionsResetReviewUrl,
    buildAiConnectionsUrl,
    parseAiConnections,
    resolveAiAssistantsVisibility
} from '../../src/lib/ai-assistants';

describe('buildAiConnectionsUrl', () => {
    it('targets the collection and tolerates a trailing slash', () => {
        expect(buildAiConnectionsUrl({ apiUrl: 'https://api.x/' })).toBe(
            'https://api.x/api/v1/protected/ai-connections'
        );
    });

    it('percent-encodes a client id that is a URL', () => {
        expect(
            buildAiConnectionsUrl({ apiUrl: 'https://api.x', clientId: 'https://c.io/m.json?a=1' })
        ).toBe(
            'https://api.x/api/v1/protected/ai-connections?clientId=https%3A%2F%2Fc.io%2Fm.json%3Fa%3D1'
        );
    });
});

describe('parseAiConnections', () => {
    const item = {
        clientId: 'c1',
        name: 'Claude',
        uri: null,
        logoUri: null,
        scopes: ['openid'],
        connectedAt: '2026-11-01T10:00:00.000Z',
        lastUsedAt: null
    };

    it('accepts the envelope and coerces dates', () => {
        const result = parseAiConnections({ body: { success: true, data: { items: [item] } } });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.items[0]?.connectedAt).toBeInstanceOf(Date);
            expect(result.items[0]?.lastUsedAt).toBeNull();
            expect(result.pendingResetReview).toBeNull();
        }
    });

    it('tolerates an API that does not send pendingResetReview yet', () => {
        const result = parseAiConnections({ body: { success: true, data: { items: [item] } } });
        expect(result.ok && result.pendingResetReview).toBeNull();
    });

    it('carries the pending post-reset review', () => {
        const result = parseAiConnections({
            body: {
                success: true,
                data: {
                    items: [item],
                    pendingResetReview: {
                        resetAt: '2026-11-10T12:00:00.000Z',
                        connectionsBeforeReset: [item]
                    }
                }
            }
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.pendingResetReview?.resetAt).toBeInstanceOf(Date);
            expect(result.pendingResetReview?.connectionsBeforeReset).toHaveLength(1);
        }
    });

    it('rejects a malformed pendingResetReview', () => {
        const body = {
            success: true,
            data: { items: [item], pendingResetReview: { resetAt: 'nope' } }
        };
        expect(parseAiConnections({ body }).ok).toBe(false);
    });

    it.each([
        ['not an object', 'nope'],
        ['success false', { success: false, data: { items: [] } }],
        ['no data', { success: true }],
        ['bad item', { success: true, data: { items: [{ clientId: '' }] } }]
    ])('rejects %s', (_label, body) => {
        expect(parseAiConnections({ body }).ok).toBe(false);
    });
});

describe('buildAiConnectionsResetReviewUrl', () => {
    it('targets the reset-review sub-resource and tolerates a trailing slash', () => {
        expect(buildAiConnectionsResetReviewUrl({ apiUrl: 'https://api.x/' })).toBe(
            'https://api.x/api/v1/protected/ai-connections/reset-review'
        );
    });
});

describe('resolveAiAssistantsVisibility', () => {
    it.each([
        [true, 0, 'full'],
        [true, 3, 'full'],
        [false, 2, 'manage-only'],
        [false, 0, 'unavailable']
    ] as const)('flag %s with %s connections is %s', (mcpEnabled, connectionCount, expected) => {
        expect(resolveAiAssistantsVisibility({ mcpEnabled, connectionCount })).toBe(expected);
    });
});
