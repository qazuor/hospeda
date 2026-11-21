/**
 * @file conversation-bubble-side.test.ts
 * @description Regression tests for HOS-2419: bubbles aligned by sender type
 * instead of by who is viewing the thread.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveConversationBubbleSide } from '../../src/lib/conversation-bubble-side';

const pageSource = (dir: string): string =>
    readFileSync(
        resolve(__dirname, `../../src/pages/[lang]/mi-cuenta/${dir}/[conversationId].astro`),
        'utf8'
    );

describe('resolveConversationBubbleSide', () => {
    it('guest viewer: own (guest) messages are mine, owner messages are theirs', () => {
        expect(resolveConversationBubbleSide({ senderType: 'GUEST', viewerRole: 'guest' })).toBe(
            'mine'
        );
        expect(resolveConversationBubbleSide({ senderType: 'OWNER', viewerRole: 'guest' })).toBe(
            'theirs'
        );
    });

    it('owner viewer: own (owner) messages are mine, guest messages are theirs', () => {
        expect(resolveConversationBubbleSide({ senderType: 'owner', viewerRole: 'owner' })).toBe(
            'mine'
        );
        expect(resolveConversationBubbleSide({ senderType: 'guest', viewerRole: 'owner' })).toBe(
            'theirs'
        );
    });

    it('anything else is a system message', () => {
        expect(resolveConversationBubbleSide({ senderType: 'SYSTEM', viewerRole: 'guest' })).toBe(
            'system'
        );
        expect(resolveConversationBubbleSide({ senderType: null, viewerRole: 'owner' })).toBe(
            'system'
        );
    });
});

describe.each([
    ['consultas', 'guest'],
    ['consultas-propietario', 'owner']
])('%s thread page wiring (viewer %s)', (dir, role) => {
    const source = pageSource(dir);

    it('classes each bubble by viewer-relative side, not by sender type', () => {
        expect(source).toContain(`viewerRole: '${role}'`);
        expect(source).toContain('conv-thread__message--${resolveConversationBubbleSide({');
        expect(source).not.toMatch(/conv-thread__message--\$\{msg\.senderType/);
    });

    it('aligns mine to the right and theirs to the left', () => {
        expect(source).toMatch(/\.conv-thread__message--mine\s*\{\s*justify-content:\s*flex-end;/);
        expect(source).toMatch(
            /\.conv-thread__message--theirs,\s*\.conv-thread__message--system\s*\{\s*justify-content:\s*flex-start;/
        );
    });
});
