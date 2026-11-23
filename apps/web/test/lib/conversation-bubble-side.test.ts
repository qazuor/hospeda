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

const src = resolve(__dirname, '../../src/components/account');

describe.each([
    ['consultas', 'guest'],
    ['consultas-propietario', 'owner']
])('%s thread page wiring (viewer %s, on the kit since HOS-2481)', (dir, role) => {
    const source = pageSource(dir);

    it('hands the viewer to the shared panel instead of the sender type', () => {
        expect(source).toMatch(new RegExp(`<ConversationPanel[\\s\\S]*?viewer="${role}"`));
        expect(source).not.toMatch(/conv-thread__message--|resolveConversationBubbleSide/);
    });
});

describe('the kit thread resolves the side from the viewer (HOS-2419)', () => {
    const thread = readFileSync(resolve(src, 'ui/ConversationThread.tsx'), 'utf8');
    const css = readFileSync(resolve(src, 'ui/MessageBubble.module.css'), 'utf8');

    it('classes each bubble by viewer-relative side, not by sender type', () => {
        expect(thread).toContain('resolveConversationBubbleSide({');
        expect(thread).toContain('viewerRole: viewer');
    });

    it('aligns mine to the right and theirs to the left', () => {
        expect(css).toMatch(/\.mine\s*\{\s*align-items:\s*flex-end;/);
        expect(css).toMatch(/\.theirs\s*\{\s*align-items:\s*flex-start;/);
    });
});
