/**
 * Tests for the provider-read provenance marker (HOS-914 F4).
 *
 * The marker is what lets a caller that wraps `processSubscriptionUpdated` whole
 * tell "MercadoPago could not resolve this preapproval" apart from "a notification
 * template was missing". Both arrive as one `Error` through one `catch`, and the
 * message heuristic that used to decide cannot tell them apart:
 * `Error('Notification template not found')` matches every "not found" test there
 * is while saying nothing about the preapproval.
 *
 * Two things are pinned here. The marker's own behaviour, including the cases where
 * it must refuse to mark, and — the part a unit test of the helper cannot reach —
 * that the `subscriptions.retrieve()` boundary in `subscription-logic.ts` actually
 * calls it. A marker nothing stamps is indistinguishable from no marker at all: the
 * classifier would simply file every failure as transient and retry for ever in
 * silence.
 *
 * @module test/routes/webhooks/provider-read-failure
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    isProviderReadFailure,
    markProviderReadFailure,
    PROVIDER_READ_FAILURE
} from '../../../src/routes/webhooks/mercadopago/provider-read-failure';

describe('markProviderReadFailure / isProviderReadFailure', () => {
    it('marks an Error and reads the mark back', () => {
        // Arrange
        const error = new Error('Retrieve subscription - Not Found');
        // Act
        markProviderReadFailure(error);
        // Assert
        expect(isProviderReadFailure(error)).toBe(true);
    });

    it('reports false for an error nobody marked', () => {
        // Arrange — a later-phase failure: the write, the audit, a notification.
        const error = new Error('Notification template not found');
        // Act & Assert
        expect(isProviderReadFailure(error)).toBe(false);
    });

    it('does not throw on a non-object throw, and reports false for it', () => {
        // Arrange — a string or undefined cannot carry a mark. Refusing is correct:
        // the conservative branch is the one that does not page a human.
        // Act & Assert
        expect(() => markProviderReadFailure('boom')).not.toThrow();
        expect(() => markProviderReadFailure(undefined)).not.toThrow();
        expect(isProviderReadFailure('boom')).toBe(false);
        expect(isProviderReadFailure(undefined)).toBe(false);
        expect(isProviderReadFailure(null)).toBe(false);
    });

    it('keeps the mark off every enumerable surface — logs, JSON, Sentry payloads', () => {
        // Arrange
        const error = Object.assign(new Error('boom'), { code: 'provider_error' });
        // Act
        markProviderReadFailure(error);
        // Assert — non-enumerable, so it cannot leak into a serialized payload as
        // mystery noise.
        expect(Object.keys(error)).not.toContain(String(PROVIDER_READ_FAILURE));
        expect(JSON.stringify({ ...error })).not.toContain('providerReadFailure');
        expect(isProviderReadFailure(error)).toBe(true);
    });

    it('cannot be forged by a plain property of the same name', () => {
        // Arrange — a Symbol key, so a JSON-shaped error carrying the string key
        // does not satisfy the predicate.
        const impostor = { 'hospeda.providerReadFailure': true };
        // Act & Assert
        expect(isProviderReadFailure(impostor)).toBe(false);
    });
});

describe('the retrieve() boundary actually stamps the mark', () => {
    /*
     * Source-level, and honest about it: this asserts the call is PRESENT in the
     * `.catch` attached to `subscriptions.retrieve()`, not that it executed. The
     * runtime behaviour it guards is covered from the consumer side in
     * `test/cron/subscription-drift-reconcile.handler.test.ts`, whose ghost-row test
     * only reaches `unknown_at_provider` because its fixture is marked.
     *
     * Worth asserting anyway: if this one call site disappeared, every read failure
     * would silently become `transient` and the drift sweep would retry an
     * unresolvable row for ever without ever escalating it — a regression with no
     * other visible symptom.
     */
    const source = readFileSync(
        resolve(__dirname, '../../../src/routes/webhooks/mercadopago/subscription-logic.ts'),
        'utf-8'
    );

    it('subscription-logic imports the marker', () => {
        // Arrange & Act & Assert
        expect(source).toContain(
            "import { markProviderReadFailure } from './provider-read-failure.js';"
        );
    });

    it('calls it inside the catch on subscriptions.retrieve(), before rethrowing', () => {
        // Arrange — the window from the retrieve call to its `throw error;`.
        const start = source.indexOf('.retrieve(mpPreapprovalId)');
        expect(start).toBeGreaterThan(-1);
        const window = source.slice(start, start + 1200);
        // Act & Assert
        expect(window).toContain('markProviderReadFailure(error);');
        const markAt = window.indexOf('markProviderReadFailure(error);');
        const throwAt = window.indexOf('throw error;');
        expect(throwAt).toBeGreaterThan(-1);
        // The mark must land BEFORE the rethrow, or the caller receives it unmarked.
        expect(markAt).toBeLessThan(throwAt);
    });
});
