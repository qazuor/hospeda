/**
 * TEST:B1:1 (AC:B1:1), runtime half: the interface has the eight capabilities
 * and nothing more, both implementations implement all of it, each declares
 * what it offers of every capability without claiming a parity it lacks, and
 * neither the interface nor the fake names a provider concept.
 *
 * The compile-time half (the type check that fails on a provider concept) is in
 * `provider-concepts.typecheck.test.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import {
    CAPABILITY_METHODS,
    type CapabilitySupportMap,
    FakePaymentProvider,
    MercadoPagoPaymentProvider,
    NOT_ASKED_OF_THE_PROVIDER,
    PAYMENT_CAPABILITIES,
    type PaymentProvider,
    PROVIDER_CONCEPT_TERMS,
    PROVIDER_METHODS
} from '../src/index';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });

const SRC = resolve(import.meta.dirname, '../src');

const IMPLEMENTATIONS: readonly { readonly name: string; readonly make: () => PaymentProvider }[] =
    [
        { name: 'fake', make: () => new FakePaymentProvider({ clock }) },
        { name: 'Mercado Pago adapter', make: () => new MercadoPagoPaymentProvider({ clock }) }
    ];

/** Every method name reachable on an instance, own or inherited (Object excluded). */
function methodNamesOf({ instance }: { readonly instance: object }): readonly string[] {
    const names = new Set<string>();
    let proto: object | null = Object.getPrototypeOf(instance);
    while (proto && proto !== Object.prototype) {
        for (const name of Object.getOwnPropertyNames(proto)) {
            if (name !== 'constructor') names.add(name);
        }
        proto = Object.getPrototypeOf(proto);
    }
    return [...names];
}

/** The capabilities a support map declares as partial or none. */
function notFull({ support }: { readonly support: CapabilitySupportMap }): readonly string[] {
    return PAYMENT_CAPABILITIES.filter((capability) => support[capability].level !== 'full');
}

describe('the eight capabilities', () => {
    it('are exactly the eight of B/06 §1, in order', () => {
        expect(PAYMENT_CAPABILITIES).toEqual([
            'authorize',
            'charge',
            'changeAmount',
            'pauseAndResume',
            'cancel',
            'refund',
            'read',
            'notify'
        ]);
    });

    it('map every interface method to exactly one capability', () => {
        // Arrange
        const mapped = Object.values(CAPABILITY_METHODS).flat();

        // Assert
        expect(Object.keys(CAPABILITY_METHODS)).toEqual([...PAYMENT_CAPABILITIES]);
        expect(new Set(mapped).size).toBe(mapped.length);
        expect([...PROVIDER_METHODS]).toEqual(mapped);
        expect(PROVIDER_METHODS).toHaveLength(10);
    });
});

describe.each(IMPLEMENTATIONS)('the $name', ({ make }) => {
    it('implements every method of the interface', () => {
        // Arrange
        const provider = make();

        // Act
        const methods = methodNamesOf({ instance: provider });

        // Assert
        for (const method of PROVIDER_METHODS) {
            expect(typeof provider[method], method).toBe('function');
            expect(methods, method).toContain(method);
        }
    });

    it('declares its support for each of the eight capabilities, and only those', () => {
        // Arrange
        const { capabilitySupport } = make();

        // Assert
        expect(Object.keys(capabilitySupport).sort()).toEqual([...PAYMENT_CAPABILITIES].sort());
        for (const capability of PAYMENT_CAPABILITIES) {
            const support = capabilitySupport[capability];
            if (support.level === 'partial') {
                expect(support.gaps.length, capability).toBeGreaterThan(0);
                for (const gap of support.gaps) {
                    expect(['emulate', 'degrade', 'block'], capability).toContain(gap.handling);
                    expect(gap.gap.trim().length, capability).toBeGreaterThan(0);
                    expect(gap.how.trim().length, capability).toBeGreaterThan(0);
                }
            }
        }
    });

    it('carries no method for what the domain does not ask of a provider', () => {
        // Arrange
        const methods = methodNamesOf({ instance: make() });

        // Assert
        for (const absent of NOT_ASKED_OF_THE_PROVIDER) {
            expect(methods).not.toContain(absent);
        }
    });
});

describe('what each implementation declares', () => {
    it('the fake offers all eight whole: it is the reference', () => {
        expect(notFull({ support: new FakePaymentProvider({ clock }).capabilitySupport })).toEqual(
            []
        );
    });

    it('Mercado Pago declares the three measured half-capabilities as partial, with their handling', () => {
        // Arrange
        const support = new MercadoPagoPaymentProvider({ clock }).capabilitySupport;

        // Assert: the B/06 §2 table, no parity faked
        expect(notFull({ support })).toEqual(['pauseAndResume', 'read', 'notify']);
        const handlingOf = (capability: keyof CapabilitySupportMap) => {
            const entry = support[capability];
            return entry.level === 'partial' ? entry.gaps.map((gap) => gap.handling) : [];
        };
        expect(handlingOf('pauseAndResume')).toEqual(['emulate']);
        expect(handlingOf('read')).toEqual(['block']);
        expect(handlingOf('notify')).toEqual(['emulate', 'emulate']);
    });
});

describe('no provider concept in the interface or in the fake', () => {
    /** Every TypeScript file under a source folder, at any depth (src-relative). */
    const filesUnder = ({ folder }: { readonly folder: string }): readonly string[] =>
        readdirSync(join(SRC, folder), { withFileTypes: true }).flatMap((entry) => {
            const relative = join(folder, entry.name);
            if (entry.isDirectory()) return filesUnder({ folder: relative });
            return entry.name.endsWith('.ts') ? [relative] : [];
        });

    // provider-concepts.ts is the one file that must spell the banned terms.
    const CONCEPTS_FILE = join('provider', 'provider-concepts.ts');
    const scanned = [
        ...filesUnder({ folder: 'provider' }).filter((file) => file !== CONCEPTS_FILE),
        ...filesUnder({ folder: 'fake' })
    ];

    it('scans the interface folder and the fake folder', () => {
        expect(scanned.length).toBeGreaterThanOrEqual(6);
        expect(scanned).toContain(join('provider', 'payment-provider.ts'));
        expect(scanned).toContain(join('fake', 'fake-payment-provider.ts'));
        expect(scanned).not.toContain(CONCEPTS_FILE);
    });

    it.each(scanned)('%s names none of the banned terms, comments included', (file) => {
        // Arrange
        const source = readFileSync(join(SRC, file), 'utf8').toLowerCase();

        // Assert
        for (const term of PROVIDER_CONCEPT_TERMS) {
            expect(source.includes(term), `${file} contains "${term}"`).toBe(false);
        }
    });
});
