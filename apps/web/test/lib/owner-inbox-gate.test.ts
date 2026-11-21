/**
 * @file owner-inbox-gate.test.ts
 * @description Behavior tests for the owner inbox gate (HOS-2433): who is
 * redirected, and that both pages decide BEFORE touching the API.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveOwnerInboxGate } from '@/lib/owner-inbox-gate';

describe('resolveOwnerInboxGate', () => {
    it('redirects a venue-owner-only user to the account home', () => {
        expect(resolveOwnerInboxGate({ roles: ['VENUE_OWNER'], locale: 'es' })).toEqual({
            action: 'redirect',
            location: '/es/mi-cuenta/'
        });
    });

    it('redirects a plain tourist and a user without roles', () => {
        expect(resolveOwnerInboxGate({ roles: ['USER'], locale: 'en' }).action).toBe('redirect');
        expect(resolveOwnerInboxGate({ roles: [], locale: 'en' }).action).toBe('redirect');
        expect(resolveOwnerInboxGate({ roles: null, locale: 'pt' }).action).toBe('redirect');
    });

    it('lets a HOST continue, including one who also holds other roles', () => {
        expect(resolveOwnerInboxGate({ roles: ['HOST'], locale: 'es' })).toEqual({
            action: 'continue'
        });
        expect(resolveOwnerInboxGate({ roles: ['VENUE_OWNER', 'HOST'], locale: 'es' }).action).toBe(
            'continue'
        );
    });
});

describe('owner inbox pages decide before any API read', () => {
    it.each(['index.astro', '[conversationId].astro'])('%s', (file) => {
        const source = readFileSync(
            resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/consultas-propietario', file),
            'utf8'
        );
        const gateAt = source.indexOf('resolveOwnerInboxGate(');
        const apiAt = source.indexOf('ownerConversationsApi.');
        expect(gateAt).toBeGreaterThan(-1);
        expect(apiAt).toBeGreaterThan(gateAt);
        expect(source).toContain("gate.action === 'redirect'");
    });
});
