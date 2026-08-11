/**
 * @file ReviewReplyForm.bounds.test.ts
 * @description Guards the mirrored length bounds of the reply form (HOS-376 T-051).
 *
 * `ReviewReplyForm.tsx` hardcodes `REPLY_MIN` / `REPLY_MAX` instead of importing
 * `HOST_TRADE_REVIEW_REPLY_MIN` / `_MAX`, deliberately: the import would pull
 * `@repo/schemas` — and Zod behind it — into the provider panel's bundle, which
 * ships neither today. The literal is the cheap half of that trade; THIS is the
 * other half.
 *
 * Without it the drift is silent and one-directional in the worst way: raising
 * the schema's floor leaves the form accepting a reply the API then rejects with
 * a 400 the provider cannot act on, and lowering the schema's ceiling leaves the
 * `maxLength` attribute cutting text off at a limit that no longer exists.
 *
 * The assertion reads the SOURCE rather than importing the component, because
 * importing it would only prove the values agree at runtime for whatever code
 * path a render happens to take — not that these two declarations are the ones
 * in force.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HOST_TRADE_REVIEW_REPLY_MAX, HOST_TRADE_REVIEW_REPLY_MIN } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

const COMPONENT_PATH = resolve(
    __dirname,
    '../../../../src/components/host/host-trades/ReviewReplyForm.tsx'
);
const source = readFileSync(COMPONENT_PATH, 'utf8');

/** Reads back the literal a `const NAME = <number>;` declaration is fixed at. */
function declaredConstant(name: string): number {
    const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)\\s*;`));
    if (match === null) {
        throw new Error(
            `ReviewReplyForm.tsx no longer declares \`const ${name} = <number>;\`. If the bound moved elsewhere, point this guard at its new home — do not delete it.`
        );
    }
    return Number(match[1]);
}

describe('ReviewReplyForm length bounds', () => {
    it('should mirror the schema floor exactly', () => {
        // Arrange + Act
        const declared = declaredConstant('REPLY_MIN');

        // Assert
        expect(declared).toBe(HOST_TRADE_REVIEW_REPLY_MIN);
    });

    it('should mirror the schema ceiling exactly', () => {
        // Arrange + Act
        const declared = declaredConstant('REPLY_MAX');

        // Assert
        expect(declared).toBe(HOST_TRADE_REVIEW_REPLY_MAX);
    });

    it('should feed the ceiling to the textarea, so the browser stops at the same number the API does', () => {
        // Assert — a `maxLength` wired to anything but REPLY_MAX would let the
        // field outgrow the bound the other two assertions pin.
        expect(source).toContain('maxLength={REPLY_MAX}');
    });
});
