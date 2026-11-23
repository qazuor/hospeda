/**
 * @file owner-inbox-gate.test.ts
 * @description Behavior tests for the owner inbox gate (HOS-2433, HOS-2482): who
 * is locked out, and that both pages decide BEFORE any conversation is read.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveOwnerInboxGate } from '@/lib/owner-inbox-gate';

describe('resolveOwnerInboxGate', () => {
    it('locks a venue-owner-only user out (no accommodation permission)', () => {
        expect(resolveOwnerInboxGate({ roles: ['VENUE_OWNER'] })).toEqual({ action: 'locked' });
    });

    it('locks a plain tourist and a user without roles out', () => {
        expect(resolveOwnerInboxGate({ roles: ['USER'] }).action).toBe('locked');
        expect(resolveOwnerInboxGate({ roles: [] }).action).toBe('locked');
        expect(resolveOwnerInboxGate({ roles: null }).action).toBe('locked');
    });

    it('lets a HOST continue, including one who also holds other roles', () => {
        expect(resolveOwnerInboxGate({ roles: ['HOST'] })).toEqual({ action: 'continue' });
        expect(resolveOwnerInboxGate({ roles: ['VENUE_OWNER', 'HOST'] }).action).toBe('continue');
    });
});

describe('owner inbox pages decide before any conversation is read', () => {
    const read = (file: string) =>
        readFileSync(
            resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/consultas-propietario', file),
            'utf8'
        );

    it('the thread page reads the thread only when the gate lets it continue', () => {
        const source = read('[conversationId].astro');
        const gateAt = source.indexOf('resolveOwnerInboxGate(');
        const continueAt = source.indexOf("if (gate.action === 'continue') {");
        const apiAt = source.indexOf('ownerConversationsApi.getById(');
        expect(gateAt).toBeGreaterThan(-1);
        expect(continueAt).toBeGreaterThan(gateAt);
        expect(apiAt).toBeGreaterThan(continueAt);
    });

    it('the inbox page mounts the reading island only when the gate lets it continue', () => {
        const source = read('index.astro');
        expect(source).not.toContain('ownerConversationsApi');
        expect(source).toMatch(
            /\{gate\.action === 'locked' \? \(\s*<OwnerInboxLocked locale=\{locale\} \/>\s*\) : \(\s*<ConversationInbox client:load/
        );
    });

    it.each([
        'index.astro',
        '[conversationId].astro'
    ])('%s renders the locked state, never redirects', (file) => {
        const source = read(file);
        expect(source).toContain("gate.action === 'locked'");
        expect(source).toContain('<OwnerInboxLocked locale={locale} />');
        expect(source).not.toContain('gate.location');
    });
});
