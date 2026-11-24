/**
 * @file guest-thread-bubble-radius.source.test.ts
 * @description The guest message thread draws chat bubbles with the card
 * radius and a small corner on the author's side, like the account kit's
 * MessageBubble. The organic hero radii (`--radius-organic-*`, 0 75px /
 * 100px 0) made short bubbles look deformed (owner smoke, 24/11/2026).
 *
 * jsdom cannot lay out Astro scoped CSS, so this guards the source rules.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/guest/messages/[token].astro'),
    'utf8'
);

/** Returns the body of the rule whose selector matches `selector` exactly. */
function ruleBody({ selector }: { readonly selector: string }): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = SOURCE.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    return match?.[1] ?? '';
}

describe('guest thread bubble radius', () => {
    it('never uses the organic hero radii', () => {
        // Assert
        expect(SOURCE).not.toMatch(/--radius-organic/);
    });

    it('rounds the guest bubble like a chat bubble, small corner at the end side', () => {
        // Act
        const body = ruleBody({ selector: '.guest-thread__message--guest .guest-thread__bubble' });

        // Assert
        expect(body).toMatch(/border-radius:\s*var\(--radius-card\)/);
        expect(body).toMatch(/border-end-end-radius:\s*var\(--radius-control\)/);
    });

    it('rounds the owner bubble like a chat bubble, small corner at the start side', () => {
        // Act
        const body = ruleBody({ selector: '.guest-thread__message--owner .guest-thread__bubble' });

        // Assert
        expect(body).toMatch(/border-radius:\s*var\(--radius-card\)/);
        expect(body).toMatch(/border-end-start-radius:\s*var\(--radius-control\)/);
    });
});
