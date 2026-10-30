import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runAbortInverse } from '../../cutover/abort-inverse.ts';
import type { InverseManifest } from '../../cutover/read-manifest.ts';
import { readInverseManifest } from '../../cutover/read-manifest.ts';
import type { FakeProviderOptions } from './fake-provider.ts';
import { createFakeProvider } from './fake-provider.ts';

const PROBE = 'pre-delivery-probe';
const PAYMENT = 'pay-small-1';

function run({
    manifest,
    provider = {}
}: {
    readonly manifest: InverseManifest;
    readonly provider?: Partial<FakeProviderOptions>;
}) {
    const fake = createFakeProvider({
        objects: [{ kind: 'preapproval', id: PROBE, status: 'authorized' }],
        payments: [{ id: PAYMENT, status: 'approved' }],
        ...provider
    });
    const sleeps: number[] = [];
    const promise = runAbortInverse({
        api: fake.api,
        manifest,
        sleep: async (ms) => {
            sleeps.push(ms);
        }
    });
    return { fake, sleeps, promise };
}

const AFTER_4B: InverseManifest = {
    schemaVersion: 1,
    outcome: 'in-progress',
    probeId: PROBE,
    paymentId: PAYMENT
};

describe('TEST:U3:10 abort inverses (b) and (c) (AC:U3:9)', () => {
    it('cancels the live probe and re-reads it cancelled; refunds the payment and re-reads the refund by id', async () => {
        // Arrange
        const { fake, promise } = run({ manifest: AFTER_4B });
        // Act
        const { ok, report } = await promise;
        // Assert
        expect(fake.calls).toEqual([
            `GET preapproval ${PROBE}`,
            `CANCEL preapproval ${PROBE}`,
            `GET preapproval ${PROBE}`,
            `GET payment ${PAYMENT}`,
            `REFUND payment ${PAYMENT}`,
            'GET refund refund-1'
        ]);
        expect(ok).toBe(true);
        expect(report.probe).toEqual({ id: PROBE, action: 'cancelled' });
        expect(report.payment).toEqual({ id: PAYMENT, refundId: 'refund-1', action: 'refunded' });
        expect(fake.state.get(PROBE)?.status).toBe('cancelled');
        expect(fake.payments.get(PAYMENT)?.status).toBe('refunded');
    });

    it('tolerates an abort before step 4b: no ids, no call, nothing to undo', async () => {
        // Arrange
        const { fake, promise } = run({ manifest: { schemaVersion: 1, outcome: 'failed' } });
        // Act
        const { ok, report } = await promise;
        // Assert
        expect(fake.calls).toEqual([]);
        expect(ok).toBe(true);
        expect(report.probe.action).toBe('absent');
        expect(report.payment.action).toBe('absent');
    });

    it('acts only on what exists: a probe already cancelled and a refund already in the manifest are only re-read', async () => {
        // Arrange
        const { fake, promise } = run({
            manifest: { ...AFTER_4B, refundId: 'refund-old' },
            provider: {
                objects: [{ kind: 'preapproval', id: PROBE, status: 'cancelled' }],
                payments: [{ id: PAYMENT, status: 'refunded', refundIds: ['refund-old'] }]
            }
        });
        // Act
        const { ok, report } = await promise;
        // Assert
        expect(fake.calls).toEqual([`GET preapproval ${PROBE}`, 'GET refund refund-old']);
        expect(ok).toBe(true);
        expect(report.probe.action).toBe('already-cancelled');
        expect(report.payment).toEqual({
            id: PAYMENT,
            refundId: 'refund-old',
            action: 'already-refunded'
        });
    });

    it('does not refund twice when the refund happened but its id never reached the manifest', async () => {
        // Arrange
        const { fake, promise } = run({
            manifest: { schemaVersion: 1, outcome: 'in-progress', paymentId: PAYMENT },
            provider: { payments: [{ id: PAYMENT, status: 'refunded', refundIds: ['refund-9'] }] }
        });
        // Act
        const { ok, report } = await promise;
        // Assert
        expect(fake.calls).toEqual([`GET payment ${PAYMENT}`, 'GET refund refund-9']);
        expect(ok).toBe(true);
        expect(report.payment.refundId).toBe('refund-9');
    });

    it('does nothing for a payment that never charged', async () => {
        // Arrange
        const { fake, promise } = run({
            manifest: { schemaVersion: 1, outcome: 'in-progress', paymentId: PAYMENT },
            provider: { payments: [{ id: PAYMENT, status: 'rejected' }] }
        });
        // Act
        const { ok, report } = await promise;
        // Assert
        expect(fake.calls).toEqual([`GET payment ${PAYMENT}`]);
        expect(ok).toBe(true);
        expect(report.payment.action).toBe('not-charged');
    });

    it('fails when the probe never reads cancelled after the retries', async () => {
        // Arrange
        const { sleeps, promise } = run({
            manifest: { schemaVersion: 1, outcome: 'in-progress', probeId: PROBE },
            provider: { stuckIds: [PROBE] }
        });
        // Act
        const { ok, report } = await promise;
        // Assert
        expect(ok).toBe(false);
        expect(report.probe.action).toBe('failed');
        expect(report.failures).toEqual([
            expect.objectContaining({ code: 'NOT_CANCELLED', id: PROBE })
        ]);
        expect(sleeps).toEqual([2_000, 5_000, 10_000]);
    });

    it('fails when the refund never reads done, re-reading it without ever re-sending the refund', async () => {
        // Arrange
        const { fake, promise } = run({
            manifest: { schemaVersion: 1, outcome: 'in-progress', paymentId: PAYMENT },
            provider: { refundStatus: { 'refund-1': 'in_process' } }
        });
        // Act
        const { ok, report } = await promise;
        // Assert
        expect(ok).toBe(false);
        expect(fake.calls.filter((c) => c.startsWith('REFUND'))).toHaveLength(1);
        expect(fake.calls.filter((c) => c === 'GET refund refund-1')).toHaveLength(4);
        expect(report.failures).toEqual([
            expect.objectContaining({ code: 'REFUND_NOT_CONFIRMED', id: 'refund-1' })
        ]);
    });

    it('does not refund a payment in a status it does not know', async () => {
        // Arrange
        const { fake, promise } = run({
            manifest: { schemaVersion: 1, outcome: 'in-progress', paymentId: PAYMENT },
            provider: { payments: [{ id: PAYMENT, status: 'in_process' }] }
        });
        // Act
        const { ok, report } = await promise;
        // Assert
        expect(ok).toBe(false);
        expect(fake.calls).not.toContain(`REFUND payment ${PAYMENT}`);
        expect(report.failures).toEqual([
            expect.objectContaining({ code: 'UNEXPECTED_STATUS', id: PAYMENT })
        ]);
    });

    it('runs inverse (c) even when inverse (b) cannot read the probe', async () => {
        // Arrange: the probe id is not at the provider
        const { fake, promise } = run({
            manifest: AFTER_4B,
            provider: { objects: [] }
        });
        // Act
        const { ok, report } = await promise;
        // Assert
        expect(ok).toBe(false);
        expect(report.probe.action).toBe('failed');
        expect(report.payment.action).toBe('refunded');
        expect(fake.calls).toContain(`REFUND payment ${PAYMENT}`);
    });

    it('flags a refund id without its payment id instead of guessing', async () => {
        // Arrange
        const { fake, promise } = run({
            manifest: { schemaVersion: 1, outcome: 'in-progress', refundId: 'refund-x' }
        });
        // Act
        const { ok, report } = await promise;
        // Assert
        expect(ok).toBe(false);
        expect(fake.calls).toEqual([]);
        expect(report.payment.action).toBe('failed');
    });
});

describe('TEST:U3:6 the inverse path sends nothing and records ids only (AC:U3:5)', () => {
    it('calls only GET, CANCEL and REFUND by id, and its report carries ids and fixed text only', async () => {
        // Arrange
        const { fake, promise } = run({ manifest: AFTER_4B });
        // Act
        const { report } = await promise;
        // Assert
        expect(fake.calls.every((c) => /^(GET|CANCEL|REFUND) /.test(c))).toBe(true);
        expect(fake.calls.filter((c) => c.startsWith('CANCEL'))).toEqual([
            `CANCEL preapproval ${PROBE}`
        ]);
        expect(fake.calls.filter((c) => c.startsWith('REFUND'))).toEqual([
            `REFUND payment ${PAYMENT}`
        ]);
        expect(Object.keys(report).sort()).toEqual(
            [
                'failures',
                'finishedAt',
                'kind',
                'outcome',
                'payment',
                'probe',
                'schemaVersion',
                'startedAt'
            ].sort()
        );
        expect(JSON.stringify(report)).not.toMatch(/@|email|name|phone|payer/i);
    });
});

describe('reading the manifest of an aborted run', () => {
    it('accepts a partial (in-progress) manifest and its 4b ids', () => {
        // Arrange
        const dir = mkdtempSync(path.join(tmpdir(), 'inverse-'));
        const file = path.join(dir, 'm.json');
        writeFileSync(
            file,
            JSON.stringify({
                schemaVersion: 1,
                outcome: 'in-progress',
                cancelledPlanIds: ['plan-1'],
                probeId: PROBE
            })
        );
        // Act
        const manifest = readInverseManifest({ path: file });
        // Assert
        expect(manifest).toEqual({ schemaVersion: 1, outcome: 'in-progress', probeId: PROBE });
    });

    it('refuses an id that could be turned into another provider path', () => {
        // Arrange
        const dir = mkdtempSync(path.join(tmpdir(), 'inverse-'));
        const file = path.join(dir, 'm.json');
        writeFileSync(
            file,
            JSON.stringify({ schemaVersion: 1, outcome: 'failed', paymentId: '1/../2' })
        );
        // Act / Assert
        expect(() => readInverseManifest({ path: file })).toThrow(/not a version-1 manifest/);
    });

    it('refuses another schema version', () => {
        // Arrange
        const dir = mkdtempSync(path.join(tmpdir(), 'inverse-'));
        const file = path.join(dir, 'm.json');
        writeFileSync(file, JSON.stringify({ schemaVersion: 2, outcome: 'ok' }));
        // Act / Assert
        expect(() => readInverseManifest({ path: file })).toThrow(/not a version-1 manifest/);
    });
});
