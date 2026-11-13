/**
 * TEST:B7:7 AC:B7:10 production wiring of the complete chargeback detection.
 *
 * The detection that runs S6 on a `charged_back` read is assembled ONCE, in
 * `src/utils/billing-chargeback-detection.ts`. Every production root hands it to
 * its `chargebacks` port, and only the builder may call `createChargebackDetection`.
 *
 * What this guard does NOT see, one per line:
 * - a root that assembles the ports in a helper with another name;
 * - a `...ports` spread that brings `chargebacks` from somewhere else;
 * - a dynamic call (a variable holding the primitive, `Reflect.apply`, etc.).
 * - whether S12's service-end implementation changes behavior after composition.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '../../src');
const BUILDER = 'utils/billing-chargeback-detection.ts';
const DETECTION_FACTORY = 'createChargebackDetection(';
const WIRING = 'chargebacks: buildChargebackDetection(';
/** The primitives that reach the chargeback detection through their ports object. */
const PRIMITIVES = [
    'recordChargeFact(',
    'runCreditedPaymentsCheck(',
    'confirmRefund(',
    'processProviderNotice('
] as const;

/** The production roots, closed and declared: all four must pass the built detection. */
const ROOTS: readonly {
    readonly file: string;
    readonly calls: number;
    readonly root: string;
}[] = [
    {
        file: 'routes/webhooks/mercadopago-ports.ts',
        calls: 1,
        root: 'the provider notice receiver'
    },
    {
        file: 'cron/jobs/billing-reconciliation-sweep.job.ts',
        calls: 2,
        root: 'the credited-payments check and the grace-expiry settlement'
    },
    {
        file: 'routes/billing-refund/admin/confirm.ts',
        calls: 1,
        root: 'the refund confirmation'
    }
];

/** The only declared direct call of a primitive, with the wiring it must pass. */
const DECLARED_PRIMITIVE_CALLS: readonly {
    readonly file: string;
    readonly primitive: (typeof PRIMITIVES)[number];
}[] = [
    {
        file: 'routes/billing-refund/admin/confirm.ts',
        primitive: 'confirmRefund('
    }
];

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const file = join(dir, name);
        return statSync(file).isDirectory()
            ? sourceFiles(file)
            : /\.tsx?$/.test(name)
              ? [file]
              : [];
    });
}

/** Removes line and block comments while preserving quoted strings and template contents. */
function stripComments(source: string): string {
    let result = '';
    let state: 'code' | 'single' | 'double' | 'template' | 'line' | 'block' = 'code';
    for (let i = 0; i < source.length; i++) {
        const char = source[i]!;
        const next = source[i + 1];
        if (state === 'line') {
            if (char === '\n') {
                result += char;
                state = 'code';
            }
            continue;
        }
        if (state === 'block') {
            if (char === '*' && next === '/') {
                state = 'code';
                i++;
            }
            continue;
        }
        if (state !== 'code') {
            result += char;
            if (char === '\\') {
                result += next ?? '';
                i++;
                continue;
            }
            if (
                (state === 'single' && char === "'") ||
                (state === 'double' && char === '"') ||
                (state === 'template' && char === '`')
            )
                state = 'code';
            continue;
        }
        if (char === '/' && next === '/') {
            state = 'line';
            i++;
            continue;
        }
        if (char === '/' && next === '*') {
            state = 'block';
            i++;
            continue;
        }
        if (char === "'") state = 'single';
        else if (char === '"') state = 'double';
        else if (char === '`') state = 'template';
        result += char;
    }
    return result;
}

function occurrences(source: string, needle: string): number {
    return source.split(needle).length - 1;
}

const FILES = sourceFiles(SRC).map((file) => ({
    path: relative(SRC, file).split('\\').join('/'),
    source: stripComments(readFileSync(file, 'utf8'))
}));

describe('TEST:B7:7 AC:B7:10 the four production roots pass the chargeback detection', () => {
    it('AC:B8a:7 adds the S12 serviceEnd port to the shared builder', () => {
        const source = FILES.find((file) => file.path === BUILDER)?.source;
        expect(source).toContain('serviceEnd: {');
        expect(source).toContain('applyS12ByChargeback(request, {');
    });
    it.each(ROOTS)('$root wires chargebacks in $file', ({ file, calls }) => {
        const source = FILES.find((candidate) => candidate.path === file)?.source;
        expect(source, `${file} is missing`).toBeDefined();
        expect(occurrences(source ?? '', WIRING)).toBe(calls);
    });

    it('(d) finds every root, so the guard is not vacuous', () => {
        const total = FILES.reduce((sum, file) => sum + occurrences(file.source, WIRING), 0);
        expect(total).toBe(4);
        for (const root of ROOTS) {
            expect(FILES.some((file) => file.path === root.file)).toBe(true);
        }
    });

    it('assembles the detection only in the builder', () => {
        const factories = FILES.filter((file) => file.source.includes(DETECTION_FACTORY));
        expect(factories.map((file) => file.path)).toEqual([BUILDER]);
    });

    it('never calls a detection primitive without the built chargebacks port', () => {
        const offenders: string[] = [];
        for (const file of FILES) {
            for (const primitive of PRIMITIVES) {
                if (!file.source.includes(primitive)) continue;
                const declared = DECLARED_PRIMITIVE_CALLS.some(
                    (call) => call.file === file.path && call.primitive === primitive
                );
                if (declared) {
                    if (!file.source.includes(WIRING)) offenders.push(`${file.path}: ${primitive}`);
                    continue;
                }
                // A receiver root hands the whole ports object built by the production builder.
                if (!file.source.includes('buildMercadoPagoNoticePorts('))
                    offenders.push(`${file.path}: ${primitive}`);
            }
        }
        expect(offenders).toEqual([]);
    });
});
