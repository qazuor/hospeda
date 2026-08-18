/**
 * @fileoverview
 * No-op IndexNow adapter — the safe default (HOS-585 G-1).
 *
 * Selected whenever notification must not happen: local development, tests, a
 * missing shared secret, or any environment that is not production. It reports
 * success so callers do not log a failure for something that was never meant to
 * be attempted, but reports `submitted: 0` so no reader can mistake it for a
 * real submission.
 */

import type {
    IndexNowAdapter,
    IndexNowNotifyResult,
    NotifiableEntity
} from './indexnow.adapter.js';

/** Adapter that accepts every notification and sends nothing. */
export class NoOpIndexNowAdapter implements IndexNowAdapter {
    readonly name = 'noop';

    /**
     * Accept and discard.
     *
     * @param _params - Ignored.
     * @returns A successful result reporting zero submissions.
     */
    async notify(_params: {
        readonly entities: ReadonlyArray<NotifiableEntity>;
    }): Promise<IndexNowNotifyResult> {
        return { success: true, submitted: 0, durationMs: 0 };
    }
}
