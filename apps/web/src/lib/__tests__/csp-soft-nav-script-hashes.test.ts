/**
 * @file csp-soft-nav-script-hashes.test.ts
 * @description Unit tests for the runtime side of the CSP soft-nav union
 * (HOS-807): parsing the substituted value, the boot-time hashes, and their
 * publication in `buildCspHeader()`.
 *
 * Expected digests use `node:crypto` directly, independently of the module
 * under test. AAA pattern.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { STRIP_CHECKOUT_RETURN_PARAMS_SNIPPET } from '../../components/billing/strip-checkout-return-params.snippet';
import { SOFT_NAV_SCRIPT_HASHES_PLACEHOLDER } from '../csp-soft-nav-placeholder';
import { parseSoftNavScriptHashes, SOFT_NAV_SCRIPT_HASHES } from '../csp-soft-nav-script-hashes';
import { FEEDBACK_NAV_BOOTSTRAP_SNIPPET } from '../feedback/feedback-nav-bootstrap.snippet';
import { iconSpriteClientScript } from '../icon-sprite';
import { buildCspHeader } from '../middleware-helpers';

const referenceHash = (source: string): string =>
    `sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}`;

const scriptSrcOf = (csp: string): string =>
    csp.split(';').find((part) => part.trim().startsWith('script-src')) ?? '';

describe('parseSoftNavScriptHashes', () => {
    it('yields an empty list for the untouched placeholder (dev, tests)', () => {
        expect(
            parseSoftNavScriptHashes({ serialized: SOFT_NAV_SCRIPT_HASHES_PLACEHOLDER })
        ).toEqual([]);
    });

    it('parses a substituted list', () => {
        // Arrange
        const hash = referenceHash('run()');

        // Act
        const result = parseSoftNavScriptHashes({ serialized: JSON.stringify([hash]) });

        // Assert
        expect(result).toEqual([hash]);
    });

    it('throws on a malformed substitution instead of publishing a broken policy', () => {
        expect(() => parseSoftNavScriptHashes({ serialized: '["not-a-hash"]' })).toThrow();
        expect(() => parseSoftNavScriptHashes({ serialized: '{' })).toThrow();
    });
});

describe('SOFT_NAV_SCRIPT_HASHES', () => {
    it('carries the boot-time hashes of the set:html constants', () => {
        expect(SOFT_NAV_SCRIPT_HASHES).toContain(referenceHash(FEEDBACK_NAV_BOOTSTRAP_SNIPPET));
        expect(SOFT_NAV_SCRIPT_HASHES).toContain(
            referenceHash(STRIP_CHECKOUT_RETURN_PARAMS_SNIPPET)
        );
        expect(SOFT_NAV_SCRIPT_HASHES).toContain(referenceHash(iconSpriteClientScript()));
    });
});

describe('buildCspHeader soft-nav union (HOS-807)', () => {
    it('authorises the union on a response whose own body carries none of it', () => {
        // Arrange: a page with no inline script of its own, like the ORIGIN of
        // a soft navigation into a page that has one.
        const otherPageScript = referenceHash('filterChips()');

        // Act
        const csp = buildCspHeader({
            scriptHashes: [],
            styleHashes: [],
            softNavScriptHashes: [otherPageScript]
        });

        // Assert
        expect(scriptSrcOf(csp)).toContain(`'${otherPageScript}'`);
    });

    it('keeps the response own hashes and deduplicates them against the union', () => {
        // Arrange
        const own = referenceHash('own()');

        // Act
        const csp = buildCspHeader({
            scriptHashes: [own],
            styleHashes: [],
            softNavScriptHashes: [own]
        });

        // Assert
        expect(scriptSrcOf(csp).split(`'${own}'`)).toHaveLength(2);
    });

    it('defaults to the module union', () => {
        // Act
        const csp = buildCspHeader({ scriptHashes: [], styleHashes: [] });

        // Assert
        for (const hash of SOFT_NAV_SCRIPT_HASHES) {
            expect(scriptSrcOf(csp)).toContain(`'${hash}'`);
        }
    });
});
