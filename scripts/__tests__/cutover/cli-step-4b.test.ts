import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CliDeps } from '../../cutover/cli-main.ts';
import { runCli } from '../../cutover/cli-main.ts';
import { createFakeProvider } from './fake-provider.ts';

const SECRET = {
    CUTOVER_MP_ACCESS_TOKEN: 'access-secret-value',
    CUTOVER_NEW_DATABASE_URL: 'postgresql://database-secret-value',
    CUTOVER_CARD_TOKEN: 'card-secret-value',
    CUTOVER_PAYER_EMAIL: 'owner-secret@example.invalid',
    CUTOVER_PAYMENT_METHOD_ID: 'visa'
} as const;

function setup({
    args = [],
    session = SECRET,
    seen = true
}: {
    readonly args?: readonly string[];
    readonly session?: Readonly<Record<string, string | undefined>>;
    readonly seen?: boolean;
} = {}) {
    const dir = mkdtempSync(path.join(tmpdir(), 'cli-step-4b-'));
    const manifest = path.join(dir, 'manifest.json');
    const fake = createFakeProvider({ objects: [] });
    let apisCreated = 0;
    let deliveryReaders = 0;
    let oldDbReaders = 0;
    const lines: string[] = [];
    const errors: string[] = [];
    const deps: CliDeps = {
        args: [...args, '--manifest-out', manifest],
        session,
        createApi: () => {
            apisCreated += 1;
            return fake.api;
        },
        createKnownIdsReader: () => {
            oldDbReaders += 1;
            return async () => ({ planIds: [], preapprovalIds: [] });
        },
        createDeliveryReader: () => {
            deliveryReaders += 1;
            return async ({ channel }) => channel === 'WEBHOOKS' || seen;
        },
        sleep: async () => {},
        out: (line) => lines.push(line),
        err: (line) => errors.push(line)
    };
    return {
        deps,
        dir,
        manifest,
        fake,
        lines,
        errors,
        counts: () => ({ apisCreated, deliveryReaders, oldDbReaders })
    };
}

const confirmed = ['--step-4b', '--confirm-step-4b', '--payment-amount', '20'];

describe('CLI --step-4b (AC:U3:8)', () => {
    it('refuses to run without explicit confirmation before creating the API', async () => {
        // Arrange
        const { deps, errors, counts } = setup({ args: ['--step-4b', '--payment-amount', '20'] });
        // Act
        const code = await runCli(deps);
        // Assert
        expect(code).toBe(2);
        expect(counts().apisCreated).toBe(0);
        expect(errors.join('\n')).toContain('refusing to run step 4b without --confirm-step-4b');
    });

    it.each([
        { extra: ['--dry-run'] },
        { extra: ['--abort-inverse', 'missing-manifest.json'] }
    ])('rejects combination $extra', async ({ extra }) => {
        // Arrange
        const { deps, counts } = setup({ args: [...confirmed, ...extra] });
        // Act
        const code = await runCli(deps);
        // Assert
        expect(code).toBe(2);
        expect(counts().apisCreated).toBe(0);
    });

    it.each([
        { amountArgs: [] },
        { amountArgs: ['--payment-amount', '14'] },
        { amountArgs: ['--payment-amount', '1001'] },
        { amountArgs: ['--payment-amount', '15.5'] }
    ])('rejects invalid amount arguments $amountArgs', async ({ amountArgs }) => {
        // Arrange
        const args = ['--step-4b', '--confirm-step-4b', ...amountArgs];
        const { deps, counts } = setup({ args });
        // Act
        const code = await runCli(deps);
        // Assert
        expect(code).toBe(2);
        expect(counts().apisCreated).toBe(0);
    });

    it('names missing variables without exposing any supplied values', async () => {
        // Arrange
        const { CUTOVER_PAYER_EMAIL: _omitted, ...session } = SECRET;
        const { deps, errors, counts } = setup({ args: confirmed, session });
        // Act
        const code = await runCli(deps);
        // Assert
        expect(code).toBe(2);
        expect(errors.join('\n')).toContain('CUTOVER_PAYER_EMAIL');
        for (const value of Object.values(session)) expect(errors.join('\n')).not.toContain(value);
        expect(counts().apisCreated).toBe(0);
    });

    it('runs, writes only ids, and never prints or writes credentials', async () => {
        // Arrange
        const { deps, manifest, lines, errors, counts } = setup({ args: confirmed });
        // Act
        const code = await runCli(deps);
        const content = readFileSync(manifest, 'utf8');
        // Assert
        expect(code).toBe(0);
        expect(counts()).toEqual({ apisCreated: 1, deliveryReaders: 1, oldDbReaders: 0 });
        expect(JSON.parse(content)).toMatchObject({
            step: '4b',
            probeId: 'probe-1',
            paymentId: 'pay-1',
            refundId: 'refund-1'
        });
        for (const value of Object.values(SECRET)) {
            expect(lines.join('\n')).not.toContain(value);
            expect(errors.join('\n')).not.toContain(value);
            expect(content).not.toContain(value);
        }
    });

    it('returns 1 when the reader never sees delivery and still refunds the payment', async () => {
        // Arrange
        const { deps, fake, manifest } = setup({ args: confirmed, seen: false });
        // Act
        const code = await runCli(deps);
        // Assert
        expect(code).toBe(1);
        expect(fake.calls).toContain('REFUND payment pay-1');
        expect(readFileSync(manifest, 'utf8')).toContain('DELIVERY_NOT_SEEN');
    });

    it('does not require or read the old database in this mode', async () => {
        // Arrange
        const { deps, counts } = setup({
            args: confirmed,
            session: { ...SECRET, CUTOVER_OLD_DATABASE_URL: undefined }
        });
        // Act
        const code = await runCli(deps);
        // Assert
        expect(code).toBe(0);
        expect(counts().oldDbReaders).toBe(0);
    });
});
