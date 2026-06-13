/**
 * QZPay test-only control module (SPEC-092 T-036).
 *
 * Provides an in-memory mechanism for E2E tests to inject deterministic
 * failures into the MercadoPago adapter — failures the real sandbox
 * cannot produce on demand (timeouts, 500s, partial-failure compensation
 * scenarios). Used by HOST-07c, HOST-07d, RES-01, RES-04.
 *
 * **HARD GATE**: every entry point checks `process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED === 'true'`.
 * Without it, all functions are no-ops and the adapter behaves normally.
 * This prevents accidental activation in production deployments even if
 * the test-only HTTP endpoint were ever exposed.
 *
 * @module billing/adapters/qzpay-test-control
 */

/** Operations that can be intercepted by failNext / delayNext. */
export type ControllableOperation =
    | 'startTrial'
    | 'cancelTrial'
    | 'createPaymentPreference'
    | 'capturePayment'
    | 'refundPayment'
    | 'cancelSubscription'
    | 'updateSubscription';

interface FailNextEntry {
    readonly operation: ControllableOperation;
    readonly errorCode: string;
    readonly errorMessage: string;
    readonly delayMs?: number;
    /**
     * Optional ownerId/subscriptionId scope. When set, the entry only matches
     * a call whose extracted scope equals this value. When omitted, the entry
     * matches ANY caller of `operation` (backward-compat).
     */
    readonly scope?: string;
}

interface DelayNextEntry {
    readonly operation: ControllableOperation;
    readonly ms: number;
    /**
     * Optional ownerId/subscriptionId scope. When set, the entry only matches
     * a call whose extracted scope equals this value. When omitted, the entry
     * matches ANY caller of `operation` (backward-compat). Same semantics as
     * {@link FailNextEntry.scope} — required so parallel E2E workers that share
     * this global queue do not consume each other's delays.
     */
    readonly scope?: string;
}

interface RecordedCall {
    readonly operation: ControllableOperation;
    readonly args: unknown;
    readonly timestamp: number;
    readonly outcome: 'ok' | 'failed' | 'delayed-then-failed';
}

interface ControlState {
    failNextQueue: FailNextEntry[];
    delayNextQueue: DelayNextEntry[];
    recordedCalls: RecordedCall[];
}

const state: ControlState = {
    failNextQueue: [],
    delayNextQueue: [],
    recordedCalls: []
};

/**
 * Returns true when the test-only control gate is enabled. Production
 * environments must NEVER set this env var.
 */
export function isTestControlEnabled(): boolean {
    return process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED === 'true';
}

/**
 * Programs the next call to `operation` to fail with the given error.
 * No-op when the gate is disabled.
 *
 * Calls are consumed in FIFO order: if you queue two failNext for
 * `startTrial`, the first call fails with the first entry, the second
 * with the second, and the third uses the real adapter again.
 *
 * The entry may carry an optional `scope` (ownerId or subscriptionId). When
 * set, the entry only matches a call whose extracted scope equals it — this
 * prevents cross-contamination between parallel E2E workers that share this
 * global queue. An entry WITHOUT `scope` matches any caller (backward-compat).
 */
export function failNext(entry: FailNextEntry): void {
    if (!isTestControlEnabled()) return;
    state.failNextQueue.push(entry);
}

/**
 * Programs the next call to `operation` to delay by `ms` milliseconds
 * before invoking the real adapter (or the queued failure, whichever
 * comes first).
 *
 * Like {@link failNext}, the delay is consumed in FIFO order and may carry an
 * optional `scope` (ownerId or subscriptionId). When set, only a call whose
 * extracted scope equals it consumes this delay; when omitted, any caller of
 * `operation` does (backward-compat). Scoping prevents cross-contamination
 * between parallel E2E workers sharing this global queue.
 */
export function delayNext(operation: ControllableOperation, ms: number, scope?: string): void {
    if (!isTestControlEnabled()) return;
    state.delayNextQueue.push({ operation, ms, scope });
}

/**
 * Returns recorded calls for the given operation (or all operations when
 * `operation` is omitted), in the order they happened.
 */
export function getRecordedCalls(operation?: ControllableOperation): ReadonlyArray<RecordedCall> {
    if (!isTestControlEnabled()) return [];
    if (operation === undefined) return [...state.recordedCalls];
    return state.recordedCalls.filter((call) => call.operation === operation);
}

/**
 * Clears all queued failures, delays, and recorded calls. Call from
 * test setup / teardown to ensure isolation.
 */
export function resetTestControl(): void {
    state.failNextQueue.length = 0;
    state.delayNextQueue.length = 0;
    state.recordedCalls.length = 0;
}

/**
 * Extracts the scope of a call from its `args`, used to match a scoped
 * `failNext` / `delayNext` entry against the specific caller that armed it.
 *
 * Rules:
 *  - `args` is a string (e.g. cancelTrial receives `subscriptionId`) → that string.
 *  - `args` is an object with a string `ownerId` (e.g. startTrial receives
 *    `{ ownerId, accommodationId }`) → that ownerId (extra fields are ignored).
 *  - otherwise (null, number, object without a string `ownerId`, etc.) → undefined.
 *
 * EXTENSIBILITY: this only understands the two arg shapes used by the operations
 * currently wired through {@link applyTestControl} — `startTrial`
 * (`{ ownerId, accommodationId }`, scoped by `ownerId`) and `cancelTrial` (bare
 * `subscriptionId` string). The other
 * {@link ControllableOperation}s (createPaymentPreference, capturePayment,
 * refundPayment, cancelSubscription, updateSubscription) are declared but NOT yet
 * wired. When you wire one whose args carry their scope key under a different
 * field (e.g. `{ subscriptionId }` or `{ paymentId }`), extend this resolver to
 * read that field — otherwise a scoped entry for that operation silently never
 * matches (it falls back to `undefined`, so only UNSCOPED entries match it). Add
 * a unit case proving the new operation's scope key is extracted.
 */
function extractScope(args: unknown): string | undefined {
    if (typeof args === 'string') {
        return args;
    }
    if (args !== null && typeof args === 'object' && 'ownerId' in args) {
        const ownerId = (args as { ownerId?: unknown }).ownerId;
        return typeof ownerId === 'string' ? ownerId : undefined;
    }
    return undefined;
}

/**
 * Internal hook used by the QZPay adapter wrapper. Determines whether the
 * next call should fail / delay / proceed normally, and records the
 * outcome for assertions.
 *
 * @internal
 */
export async function applyTestControl(
    operation: ControllableOperation,
    args: unknown,
    realCall: () => Promise<unknown>
): Promise<unknown> {
    if (!isTestControlEnabled()) {
        return realCall();
    }

    const callScope = extractScope(args);

    const delayIdx = state.delayNextQueue.findIndex(
        (entry) =>
            entry.operation === operation &&
            (entry.scope === undefined || entry.scope === callScope)
    );
    let delayed = false;
    if (delayIdx !== -1) {
        const entry = state.delayNextQueue[delayIdx];
        state.delayNextQueue.splice(delayIdx, 1);
        if (entry !== undefined) {
            delayed = true;
            await new Promise((resolve) => setTimeout(resolve, entry.ms));
        }
    }

    const failureIdx = state.failNextQueue.findIndex(
        (entry) =>
            entry.operation === operation &&
            (entry.scope === undefined || entry.scope === callScope)
    );
    if (failureIdx !== -1) {
        const failure = state.failNextQueue[failureIdx];
        if (failure === undefined) {
            return realCall();
        }
        state.failNextQueue.splice(failureIdx, 1);
        state.recordedCalls.push({
            operation,
            args,
            timestamp: Date.now(),
            outcome: delayed ? 'delayed-then-failed' : 'failed'
        });
        const error = new Error(failure.errorMessage);
        (error as Error & { code?: string }).code = failure.errorCode;
        throw error;
    }

    const result = await realCall();
    state.recordedCalls.push({
        operation,
        args,
        timestamp: Date.now(),
        outcome: 'ok'
    });
    return result;
}

/**
 * Snapshot of the in-memory state. Exposed for the test-only HTTP endpoint
 * so E2E suites can inspect the queue from out-of-process Playwright.
 *
 * @internal
 */
export function getTestControlSnapshot(): {
    readonly enabled: boolean;
    readonly failNextQueueLength: number;
    readonly delayNextQueueLength: number;
    readonly recordedCallsLength: number;
} {
    return {
        enabled: isTestControlEnabled(),
        failNextQueueLength: state.failNextQueue.length,
        delayNextQueueLength: state.delayNextQueue.length,
        recordedCallsLength: state.recordedCalls.length
    };
}
