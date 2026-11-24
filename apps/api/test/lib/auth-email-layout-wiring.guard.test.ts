/**
 * CI guard: the Better Auth reset and verify mails pass their catalog layout (HOS-2580).
 *
 * Without `layout:`, `sendAppEmail` renders the user layout with an empty context, so
 * the inbox mail loses the `account` illustration the previewer shows. Instantiating
 * Better Auth under test needs a live DB, so the wiring is asserted over the source:
 * every `sendAppEmail({ ... })` call that attributes an auth key must also pass
 * `layout: buildAppEmailLayout({ templateKey: <the same key> })`.
 *
 * @module test/lib/auth-email-layout-wiring.guard.test
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUTH_EMAIL_KEYS } from '../../src/utils/email-attribution';

const AUTH_SOURCE = readFileSync(join(__dirname, '../../src/lib/auth.ts'), 'utf8');

/** Every `sendAppEmail({ ... })` call, from its opening up to the closing `});`. */
function sliceSendCalls(source: string): readonly string[] {
    const calls: string[] = [];
    let from = source.indexOf('sendAppEmail({');
    while (from !== -1) {
        const end = source.indexOf('\n                        });', from);
        // Whitespace collapsed, so a formatter re-wrap never breaks the match.
        calls.push(source.slice(from, end === -1 ? undefined : end).replace(/\s+/g, ' '));
        from = source.indexOf('sendAppEmail({', from + 1);
    }
    return calls;
}

describe('Better Auth email layout wiring (HOS-2580)', () => {
    const calls = sliceSendCalls(AUTH_SOURCE);

    it.each(Object.keys(AUTH_EMAIL_KEYS))('the %s send passes its catalog layout', (name) => {
        // Arrange
        const call = calls.find((candidate) =>
            candidate.includes(`templateKey: AUTH_EMAIL_KEYS.${name}`)
        );

        // Assert: the slicer found the call, and the call carries the layout of the same key.
        expect(call, `no sendAppEmail call attributes AUTH_EMAIL_KEYS.${name}`).toBeDefined();
        expect(call).toContain(
            `layout: buildAppEmailLayout({ templateKey: AUTH_EMAIL_KEYS.${name} })`
        );
    });
});
