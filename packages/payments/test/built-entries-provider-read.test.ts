/** The built main and fake entries must use the same private read brand. */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';

const dist = join(import.meta.dirname, '../dist');
const require = createRequire(import.meta.url);
const instant = new Date('2026-10-01T03:40:00.000Z');

type MainEntry = typeof import('../src/index');
type FakeEntry = typeof import('../src/fake/index');

async function assertSharedBrand(main: MainEntry, fakeEntry: FakeEntry): Promise<void> {
    const clock = createAdjustableClock({ start: instant });
    const fake = new fakeEntry.FakePaymentProvider({ clock });
    const { authorizationId } = await fake.authorize({
        reference: 'built-entry-test',
        amount: { amountMinor: 1_800_000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'Plan Básico mensual',
        returnUrl: 'https://hospeda.test/return'
    });
    const read = await fake.readAuthorization({ authorizationId });

    expect(
        main.assertFreshForAct({
            read,
            act: { kind: 'decision', startedAt: instant }
        }).snapshot.authorizationId
    ).toBe(authorizationId);
    expect(Object.getOwnPropertySymbols(read)).toHaveLength(1);
    expect(Symbol.keyFor(Object.getOwnPropertySymbols(read)[0]!)).toBeUndefined();
    expect(main).not.toHaveProperty('stampProviderRead');
    expect(fakeEntry).not.toHaveProperty('stampProviderRead');

    const forged = { snapshot: read.snapshot, readAt: instant } as typeof read;
    expect(() =>
        main.assertFreshForAct({
            read: forged,
            act: { kind: 'decision', startedAt: instant }
        })
    ).toThrow(main.ProviderReadRejectedError);
}

describe('built @repo/payments entries share the private ProviderRead brand', () => {
    it('shares the brand between the ESM main and fake entries', async () => {
        const main = (await import(pathToFileURL(join(dist, 'index.js')).href)) as MainEntry;
        const fake = (await import(pathToFileURL(join(dist, 'fake/index.js')).href)) as FakeEntry;
        await assertSharedBrand(main, fake);
    });

    it('shares the brand between the CJS main and fake entries', async () => {
        const main = require(join(dist, 'index.cjs')) as MainEntry;
        const fake = require(join(dist, 'fake/index.cjs')) as FakeEntry;
        await assertSharedBrand(main, fake);
    });
});
