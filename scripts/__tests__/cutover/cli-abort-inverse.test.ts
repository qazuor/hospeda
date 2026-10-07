import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CliDeps } from '../../cutover/cli-main.ts';
import { runCli } from '../../cutover/cli-main.ts';
import { createFakeProvider } from './fake-provider.ts';

/**
 * The `--abort-inverse` wiring of the CLI (AC:U3:9): its own confirmation, its refusal to mix
 * with a cutover run, and a confirmed run reaching the provider through the inverses only.
 */
const PROBE = 'pre-delivery-probe';
const PAYMENT = 'pay-small-1';

function setup({ args }: { readonly args: (manifest: string) => readonly string[] }) {
    const dir = mkdtempSync(path.join(tmpdir(), 'cli-inverse-'));
    const manifest = path.join(dir, 'cutover-manifest.json');
    writeFileSync(
        manifest,
        JSON.stringify({
            schemaVersion: 1,
            outcome: 'in-progress',
            probeId: PROBE,
            paymentId: PAYMENT
        })
    );
    const fake = createFakeProvider({
        objects: [{ kind: 'preapproval', id: PROBE, status: 'authorized' }],
        payments: [{ id: PAYMENT, status: 'approved' }]
    });
    let apisCreated = 0;
    let oldDbReaders = 0;
    const errors: string[] = [];
    const lines: string[] = [];
    const deps: CliDeps = {
        args: args(manifest),
        session: { CUTOVER_MP_ACCESS_TOKEN: 'fake-token' },
        createApi: () => {
            apisCreated += 1;
            return fake.api;
        },
        createKnownIdsReader: () => {
            oldDbReaders += 1;
            return async () => ({ planIds: [], preapprovalIds: [] });
        },
        sleep: async () => {},
        out: (line) => lines.push(line),
        err: (line) => errors.push(line)
    };
    return {
        deps,
        manifest,
        fake,
        errors,
        lines,
        counts: () => ({ apisCreated, oldDbReaders })
    };
}

describe('CLI --abort-inverse wiring (AC:U3:9)', () => {
    it('without --confirm-abort-inverse makes zero provider calls and exits non-zero', async () => {
        // Arrange
        const { deps, fake, errors, counts } = setup({ args: (m) => ['--abort-inverse', m] });
        // Act
        const code = await runCli(deps);
        // Assert
        expect(code).toBe(2);
        expect(fake.calls).toEqual([]);
        expect(counts()).toEqual({ apisCreated: 0, oldDbReaders: 0 });
        expect(errors.join('\n')).toContain('--confirm-abort-inverse');
    });

    it('is rejected when combined with --dry-run, even confirmed, with zero provider calls', async () => {
        // Arrange
        const { deps, fake, errors } = setup({
            args: (m) => ['--abort-inverse', m, '--confirm-abort-inverse', '--dry-run']
        });
        // Act
        const code = await runCli(deps);
        // Assert
        expect(code).toBe(2);
        expect(fake.calls).toEqual([]);
        expect(errors.join('\n')).toContain('cannot be combined');
    });

    it('is rejected when combined with --confirm-cancel-all', async () => {
        // Arrange
        const { deps, fake } = setup({
            args: (m) => ['--abort-inverse', m, '--confirm-abort-inverse', '--confirm-cancel-all']
        });
        // Act
        const code = await runCli(deps);
        // Assert
        expect(code).toBe(2);
        expect(fake.calls).toEqual([]);
    });

    it('with the confirm flag runs the inverses, never the cutover, and writes its report next to the manifest', async () => {
        // Arrange
        const { deps, fake, manifest, lines, counts } = setup({
            args: (m) => ['--abort-inverse', m, '--confirm-abort-inverse']
        });
        const before = readFileSync(manifest, 'utf8');
        // Act
        const code = await runCli(deps);
        // Assert
        expect(code).toBe(0);
        expect(fake.calls).toEqual([
            `GET preapproval ${PROBE}`,
            `CANCEL preapproval ${PROBE}`,
            `GET preapproval ${PROBE}`,
            `GET payment ${PAYMENT}`,
            `REFUND payment ${PAYMENT}`,
            'GET refund refund-1'
        ]);
        expect(counts()).toEqual({ apisCreated: 1, oldDbReaders: 0 });
        expect(readFileSync(manifest, 'utf8')).toBe(before);
        const report = path.join(path.dirname(manifest), 'cutover-manifest-abort-inverse.json');
        expect(existsSync(report)).toBe(true);
        expect(JSON.parse(readFileSync(report, 'utf8')).payment.refundId).toBe('refund-1');
        expect(lines.join('\n')).toContain('outcome=ok');
    });
});
