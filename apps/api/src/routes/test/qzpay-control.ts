/**
 * QZPay test-only control endpoint (SPEC-092 T-036).
 *
 * Allows E2E tests running out-of-process (Playwright) to inject
 * deterministic failures into the QZPay adapter — failures the real MP
 * sandbox cannot produce on demand. Used by HOST-07c, HOST-07d, RES-01,
 * RES-04.
 *
 * **HARD GATE**: route is registered ONLY when
 * `HOSPEDA_QZPAY_TEST_CONTROL_ENABLED === 'true'` AND
 * `NODE_ENV !== 'production'`. Even if mounted in production by mistake,
 * the underlying control module still no-ops every entry.
 *
 * @module routes/test/qzpay-control
 */

import {
    type ControllableOperation,
    delayNext,
    failNext,
    getRecordedCalls,
    getTestControlSnapshot,
    resetTestControl
} from '@repo/billing';
import { Hono } from 'hono';

const VALID_OPERATIONS: ReadonlyArray<ControllableOperation> = [
    'startTrial',
    'cancelTrial',
    'createPaymentPreference',
    'capturePayment',
    'refundPayment',
    'cancelSubscription',
    'updateSubscription'
];

interface FailNextBody {
    operation?: string;
    errorCode?: string;
    errorMessage?: string;
    delayMs?: number;
    scope?: string;
}

interface DelayNextBody {
    operation?: string;
    ms?: number;
    scope?: string;
}

function isControllableOperation(value: unknown): value is ControllableOperation {
    return typeof value === 'string' && VALID_OPERATIONS.includes(value as ControllableOperation);
}

/**
 * Builds the test-only Hono router. The caller is responsible for
 * checking the gate before mounting.
 */
export function createQZPayTestControlRoutes(): Hono {
    const app = new Hono();

    app.get('/state', (c) => {
        return c.json(getTestControlSnapshot());
    });

    app.post('/fail-next', async (c) => {
        const body = (await c.req.json().catch(() => ({}))) as FailNextBody;
        if (!isControllableOperation(body.operation)) {
            return c.json({ error: 'invalid operation' }, 400);
        }
        if (typeof body.errorCode !== 'string' || typeof body.errorMessage !== 'string') {
            return c.json({ error: 'errorCode and errorMessage are required' }, 400);
        }
        failNext({
            operation: body.operation,
            errorCode: body.errorCode,
            errorMessage: body.errorMessage,
            delayMs: typeof body.delayMs === 'number' ? body.delayMs : undefined,
            scope: typeof body.scope === 'string' ? body.scope : undefined
        });
        return c.json({ ok: true }, 200);
    });

    app.post('/delay-next', async (c) => {
        const body = (await c.req.json().catch(() => ({}))) as DelayNextBody;
        if (!isControllableOperation(body.operation)) {
            return c.json({ error: 'invalid operation' }, 400);
        }
        if (typeof body.ms !== 'number' || body.ms < 0) {
            return c.json({ error: 'ms must be a non-negative number' }, 400);
        }
        delayNext(body.operation, body.ms, typeof body.scope === 'string' ? body.scope : undefined);
        return c.json({ ok: true }, 200);
    });

    app.get('/recorded-calls', (c) => {
        const operationParam = c.req.query('operation');
        const operation =
            operationParam !== undefined && isControllableOperation(operationParam)
                ? operationParam
                : undefined;
        return c.json({ calls: getRecordedCalls(operation) });
    });

    app.post('/reset', (c) => {
        resetTestControl();
        return c.json({ ok: true }, 200);
    });

    return app;
}
