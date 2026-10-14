import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProviderCancellationTransition } from '../../../../src/services/billing/reconciliation/provider-cancellation-decision';
import { BEFORE_CANCEL_KIND_BY_TRANSITION } from '../../../../src/services/billing/reconciliation/sweep/our-cancellation-retry';
import { BEFORE_CANCEL_TEMPLATE_BY_KIND } from '../../../../src/services/billing/subscription/before-cancel-notice-kinds';

/**
 * HOS-1683: there is no default before-cancel notice. Every transition our code records as a
 * cancellation decision declares its notice kind in `BEFORE_CANCEL_KIND_BY_TRANSITION`, and the
 * file that records it asks its first notice with that same kind, because the template is part
 * of the dedupe key and the sweep's retry repeats the map's kind. A transition recorded while
 * still `UNDECLARED` would make the retry fail closed forever; this guard fails first.
 */
const REPO_ROOT = resolve(import.meta.dirname, '../../../../../..');
const BILLING_DIR = join(REPO_ROOT, 'packages/service-core/src/services/billing');

const RECORDED_TRANSITION =
    /recordProviderCancellationDecided\(\{[^}]*?transition:\s*'([A-Z0-9_]+)'/g;

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const file = join(dir, name);
        return statSync(file).isDirectory()
            ? sourceFiles(file)
            : name.endsWith('.ts')
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

/** The transitions a piece of code records, read from its `recordProviderCancellationDecided` calls. */
function recordedTransitions(code: string): string[] {
    return [...code.matchAll(RECORDED_TRANSITION)].map((match) => match[1]!);
}

const sources = sourceFiles(BILLING_DIR).map((file) => ({
    path: relative(BILLING_DIR, file).split('\\').join('/'),
    code: stripComments(readFileSync(file, 'utf8'))
}));
const recordings = sources.flatMap(({ path, code }) =>
    recordedTransitions(code).map((transition) => ({ path, code, transition }))
);

function declaredKind(transition: string) {
    return Object.hasOwn(BEFORE_CANCEL_KIND_BY_TRANSITION, transition)
        ? BEFORE_CANCEL_KIND_BY_TRANSITION[transition as ProviderCancellationTransition]
        : 'UNDECLARED';
}

const EXPECTED_KINDS = [
    'AUTHORIZATION_EXPIRED',
    'FIRST_CHARGE_DECLINED',
    'REVOCATION',
    'LIVE_AUTHORIZATION_ON_CLOSED_ROW',
    'SCHEDULED_CANCELLATION',
    'TOURIST_VIP_INHERITED',
    'ARREARS_SUSPENSION',
    'ADDON_CANCELLED'
];

describe('TEST:1683:1 AC:1683:1 AC:1683:3 every cancellation declares its notice kind', () => {
    it('(a) every recorded transition is declared in BEFORE_CANCEL_KIND_BY_TRANSITION', () => {
        const undeclared = recordings
            .filter(({ transition }) => declaredKind(transition) === 'UNDECLARED')
            .map(({ path, transition }) => `${path}: ${transition}`);
        expect(undeclared).toEqual([]);
    });

    it('(b) the file that records a transition asks its first notice with the same kind', () => {
        const mismatched = recordings
            .map(({ path, code, transition }) => ({ path, code, kind: declaredKind(transition) }))
            .filter(({ kind }) => kind !== 'RECIPIENTLESS' && kind !== 'UNDECLARED')
            .filter(({ code, kind }) => !code.includes(`kind: '${kind}'`))
            .map(({ path, kind }) => `${path}: kind: '${kind}'`);
        expect(mismatched).toEqual([]);
    });

    it('(c) is not vacuous: the known recorded transitions are found', () => {
        const found = new Set(recordings.map(({ transition }) => transition));
        for (const transition of [
            'S3',
            'S16',
            'S36',
            'REJECTION_REVIVED',
            'RECEPTION_TOMBSTONE',
            'TOURIST_VIP_INHERITED',
            'A5'
        ])
            expect(found.has(transition), transition).toBe(true);
    });

    it('(d) the eight kinds have eight distinct templates and only S3 says the window expired', () => {
        expect(Object.keys(BEFORE_CANCEL_TEMPLATE_BY_KIND)).toStrictEqual(EXPECTED_KINDS);
        const templates = Object.values(BEFORE_CANCEL_TEMPLATE_BY_KIND);
        expect(new Set(templates).size).toBe(templates.length);
        const generic = Object.entries(BEFORE_CANCEL_TEMPLATE_BY_KIND)
            .filter(([, template]) => template === 'billing.before-cancel')
            .map(([kind]) => kind);
        expect(generic).toStrictEqual(['AUTHORIZATION_EXPIRED']);
    });

    it('(e) every declared retry kind has a template, and S6 never goes through the retry', () => {
        const values: string[] = Object.values(BEFORE_CANCEL_KIND_BY_TRANSITION);
        const kinds = values.filter((value) => value !== 'RECIPIENTLESS' && value !== 'UNDECLARED');
        for (const kind of kinds)
            expect(Object.hasOwn(BEFORE_CANCEL_TEMPLATE_BY_KIND, kind), kind).toBe(true);
        expect(values).not.toContain('ARREARS_SUSPENSION');
    });

    it('(f) ignores a recorded transition that only appears in a comment', () => {
        const call = "recordProviderCancellationDecided({ transition: 'S13' })";
        expect(recordedTransitions(stripComments(call))).toStrictEqual(['S13']);
        expect(recordedTransitions(stripComments(`// ${call}`))).toStrictEqual([]);
        expect(recordedTransitions(stripComments(`/* ${call} */`))).toStrictEqual([]);
    });
});
