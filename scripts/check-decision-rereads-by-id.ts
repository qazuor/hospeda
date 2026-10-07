/**
 * @file check-decision-rereads-by-id.ts
 * @description GUARD:G17 (HOS-1352 program, built by B1 / HOS-1509, AC:B1:11,
 * TEST:B1:11, INV:D17, DEC-MP-009#📌1): no decision comes out of a provider
 * notice without re-reading the resource by id. A notice says WHAT changed
 * (resource kind, id, version), never the new state; it arrives late, repeated,
 * never, or once per channel (M6). The failure message names the predicate.
 *
 * ## The three predicates
 *
 * Over production code (`.ts .tsx .mts .cts .js .jsx .mjs .cjs .astro`, tests
 * excluded, comments ignored):
 *
 * - **(a)** code that RECEIVES a notice reads from the body anything but the
 *   resource kind, its id and its version. A file receives a notice when its code
 *   names the interface's notice surface (`decodeNotice`, `NoticeDelivery`,
 *   `NoticeDeliverySchema`, `ProviderNotice`, `decodeFakeNoticeBody`,
 *   `FakeNoticeBodySchema`). In such a file, a BODY is an identifier named
 *   `body`, `rawBody`, `payload`, `notice`, `notification`, `noticeBody`,
 *   `parsedBody`, `requestBody` or `reqBody` (any case, `_`/`-` ignored), an
 *   identifier bound to `JSON.parse(…)`, `….json(…)`, `….parseBody(…)`,
 *   `….formData(…)`, Hono's `….valid('json'|'form')` or an argument-less
 *   `….query()`/`….queries()`, or such a call
 *   itself. Reading a body means a member access, a bracket access with a string,
 *   a destructuring, or a spread of it. Allowed members: `resourceKind`,
 *   `resourceId`, `version`, `type`, `topic`, `kind`, `id`, and `data` only when
 *   followed by nothing or by `id` (Webhooks carries the id at `data.id`). The
 *   same list (plus `data.id`) bounds the names read through `….query('…')` and
 *   `searchParams.get('…')`, because IPN carries the notice in the query string.
 *   `packages/payments/src/adapters/` and `packages/payments/src/fake/` are not
 *   read: they implement `decodeNotice`, the one place that parses the
 *   provider's wire format into a `ProviderNotice` (kind, id, version only).
 * - **(b)** a decision gets the provider's state other than through the
 *   adapter's read by id (`ProviderRead`, handed over by `assertFreshForAct`).
 *   Outside `packages/payments/`: any code naming `stampProviderRead` (only an
 *   implementation builds a read); and in a file importing `@repo/payments`, a
 *   provider state type (`AuthorizationSnapshot`, `ChargeSnapshot`,
 *   `AuthorizationStatus`, `ChargeStatus`) named anywhere but inside
 *   `ProviderRead<…>` or an import/export clause, a `.snapshot` read off anything but `assertFreshForAct(…)`
 *   or an identifier bound to it, or a `snapshot` destructured from anything
 *   else. A decision takes a `ProviderRead`, never a bare state.
 * - **(c)** something reads `provider_notification`, the table where the
 *   receiver stores both channels' deliveries: the identifiers or table names
 *   `provider_notification` and `providerNotification` (also plural), in code or
 *   in a string. This predicate also reads `scripts/`. The ONE exemption is
 *   `scripts/cutover/` (U3.3 / HOS-1428 reads the table, read only, in step 4b
 *   of the cutover).
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * - (a) A receiver that never names the interface's notice surface (it then
 *   cannot produce a `ProviderNotice` either); a body held under any other name
 *   that is not bound to one of the calls above; a body read through a helper
 *   in another file; headers (they are not the body).
 * - (b) Transitions and administrative actions are not recognised as such: (b)
 *   reads every file importing `@repo/payments`, which over-approximates them,
 *   and none that does not. A state copied into a local type or variable and
 *   passed on, an untyped parameter named `snapshot`, and the data flow across
 *   files are not seen. The freshness of a read is not a predicate: it lives in
 *   the type and `assertFreshForAct` (AC:B1:4).
 * - (c) It does not tell a read from a write. Until B3 creates the table, any
 *   mention is red, including the schema definition, the receiver's insert and
 *   its 180-day deletion, which the spec allows: B3 must refine (c) when it
 *   names the table's schema export (HOS-1525). A table name assembled at run
 *   time is not seen, and neither are `.sql` files (migrations) nor `.sh`
 *   scripts: (c) reads code files only.
 *
 * ## Scope and positive control
 *
 * The files git sees in the tree. A scan of fewer than `MIN_SCANNED_FILES` files
 * is a moved root or a wrong cwd, not a clean tree. `run({ root, minScannedFiles })`
 * takes any tree; `scripts/__tests__/check-decision-rereads-by-id.test.ts` runs
 * it over throwaway git trees that violate each predicate.
 *
 * Exit codes: 0 = clean; 1 = a violation, or a scan too small to trust.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importedSpecifiers } from './check-sdk-outside-adapter.js';
import {
    declaredDestructurings,
    identifiersBoundTo,
    lineOf,
    listProductionFiles,
    literalAt,
    type MaskedSource,
    maskSource,
    matchingClose,
    matchingOpen,
    membersAfter,
    normalizeName,
    PAYMENTS_ADAPTERS_DIR,
    PAYMENTS_DIR,
    PAYMENTS_FAKE_DIR,
    patternKeys,
    skipSpace
} from './payments-guard-scan.js';

/** Fewer files than this means the scan is broken, not that the tree is clean. */
export const MIN_SCANNED_FILES = 1000;

/** The only path (c) does not read. */
export const CUTOVER_DIR = 'scripts/cutover/';

/** The notification table's name, assembled so this file does not itself name it for (c). */
export const NOTIFICATION_TABLE_NAME = ['provider', 'notification'].join('_');

/** Which predicate a violation breaks. */
export type Rule = 'G17(a)' | 'G17(b)' | 'G17(c)';

/** One offending occurrence. */
export interface Violation {
    readonly rule: Rule;
    readonly file: string;
    readonly line: number;
    readonly detail: string;
}

/** What each predicate means. */
export const RULE_MESSAGES: Readonly<Record<Rule, string>> = {
    'G17(a)':
        'GUARD:G17 predicate (a): code that receives a provider notice reads from the body something ' +
        'other than the resource kind, its id and its version. A notice says what changed, never the ' +
        'new state: re-read the resource by id (INV:D17, DEC-MP-009#📌1).',
    'G17(b)':
        "GUARD:G17 predicate (b): a decision gets the provider's state other than through the adapter's " +
        'read by id. Take a ProviderRead and hand it to assertFreshForAct; never a bare snapshot or ' +
        'status, never a read built by hand (INV:D17, AC:B1:4).',
    'G17(c)':
        `GUARD:G17 predicate (c): code names ${NOTIFICATION_TABLE_NAME}. Only the receiver writes it and only ` +
        'its 180-day deletion removes from it; no transition, action, sweep or other code reads it, nor ' +
        `the receiver itself (B/02 §2.7). The only exemption is ${CUTOVER_DIR}.`
};

/** The interface's notice surface: a file naming it receives notices. */
const NOTICE_SURFACE =
    /\b(?:decodeNotice|decodeFakeNoticeBody|NoticeDelivery(?:Schema)?|ProviderNotice|FakeNoticeBodySchema)\b/;

/** Body names, normalized. */
const BODY_NAMES = new Set([
    'body',
    'rawbody',
    'payload',
    'notice',
    'notification',
    'noticebody',
    'parsedbody',
    'requestbody',
    'reqbody'
]);

/** What may be read from a notice body, normalized. */
const NOTICE_FIELDS = new Set([
    'resourcekind',
    'resourceid',
    'version',
    'type',
    'topic',
    'kind',
    'id',
    'data'
]);

/** A call whose result is the body, at the start of an expression (masked code). */
const BODY_CALL_START =
    /^(?:JSON\s*\.\s*parse\s*\(|[\w$.]*\.\s*(?:json|parseBody|formData)\s*(?:<[^>]*>)?\s*\(|[\w$.]*\.\s*quer(?:y|ies)\s*\(\s*\)|[\w$.]*\.\s*valid\s*\(\s*['"](?:json|form)['"]\s*\))/;

/** The same calls, anywhere (masked code). */
const BODY_CALL =
    /\bJSON\s*\.\s*parse\s*\(|\.\s*(?:json|parseBody|formData)\s*(?:<[^>]*>)?\s*\(|\.\s*quer(?:y|ies)\s*\(\s*\)|\.\s*valid\s*\(\s*['"](?:json|form)['"]\s*\)/g;

/**
 * The masked code with the `'json'`/`'form'` target of every `….valid(…)` call
 * written back, so the body calls above can see Hono's validated body. Same
 * length as the masked code: offsets do not move.
 */
function withValidTargets({ masked }: { readonly masked: MaskedSource }): string {
    const out = masked.code.split('');
    for (const literal of masked.strings) {
        if (literal.value !== 'json' && literal.value !== 'form') continue;
        if (
            !/\.\s*valid\s*\(\s*$/.test(
                masked.code.slice(Math.max(0, literal.start - 40), literal.start)
            )
        )
            continue;
        for (let k = 0; k < literal.value.length; k += 1)
            out[literal.start + 1 + k] = literal.value[k] as string;
    }
    return out.join('');
}

/** A provider state type: only allowed inside `ProviderRead<…>`. */
const STATE_TYPE = /\b(?:AuthorizationSnapshot|ChargeSnapshot|AuthorizationStatus|ChargeStatus)\b/g;

/** `provider_notification` / `providerNotification`, assembled so this file does not name it. */
const NOTIFICATION_TABLE = new RegExp(
    `\\b(?:${NOTIFICATION_TABLE_NAME}|${['provider', 'Notification'].join('')})s?\\b`,
    'g'
);

const IDENT = /^[A-Za-z_$][\w$]*/;

/** Whether a read of `members` off a notice body stays within kind, id and version. */
function allowedNoticeRead(members: readonly string[]): boolean {
    const [first, second] = members.map((name) => normalizeName({ name }));
    if (first === undefined) return true;
    if (!NOTICE_FIELDS.has(first)) return false;
    return first !== 'data' || second === undefined || second === 'id';
}

/**
 * Predicate (a) over one file.
 *
 * @param args.file - Repo-relative path, for the report
 * @param args.source - The file text
 * @returns One violation per forbidden read; none when the file receives no notice
 */
export function findNoticeBodyReads(args: {
    readonly file: string;
    readonly source: string;
}): readonly Violation[] {
    const masked = maskSource({ source: args.source });
    const code = withValidTargets({ masked });
    if (!NOTICE_SURFACE.test(code)) return [];
    const found: { offset: number; detail: string }[] = [];
    const bound = identifiersBoundTo({ code, start: BODY_CALL_START });
    const isBody = (name: string) => bound.has(name) || BODY_NAMES.has(normalizeName({ name }));
    const check = (offset: number, after: number, what: string) => {
        const members = membersAfter({ masked, at: after });
        if (!allowedNoticeRead(members))
            found.push({ offset, detail: `reads ${what}.${members.join('.')}` });
    };
    for (const match of code.matchAll(/[A-Za-z_$][\w$]*/g)) {
        const before = code.slice(0, match.index).trimEnd();
        if (/[\w$]$/.test(code[match.index - 1] ?? '') || !isBody(match[0])) continue;
        if (before.endsWith('.') && !BODY_NAMES.has(normalizeName({ name: match[0] }))) continue;
        if (before.endsWith('...'))
            found.push({ offset: match.index, detail: `spreads ${match[0]}` });
        else check(match.index, match.index + match[0].length, match[0]);
    }
    for (const match of code.matchAll(BODY_CALL)) {
        const last = match.index + match[0].length - 1;
        // `….query()` and `….valid('json')` match through their closing parenthesis.
        let k = code[last] === ')' ? last + 1 : matchingClose({ code, open: last }) + 1;
        if (k === 0) continue;
        for (let j = skipSpace({ code, at: k }); code[j] === ')'; j = skipSpace({ code, at: k })) {
            const open = matchingOpen({ code, close: j });
            if (open === -1 || !/^\(\s*await\b/.test(code.slice(open))) break;
            k = j + 1;
        }
        check(match.index, k, 'the body');
    }
    for (const { inner, rhs, at } of declaredDestructurings({ code })) {
        const root = /^[\w$.]+/.exec(rhs)?.[0] ?? '';
        const last = root.split('.').pop() ?? '';
        if (!BODY_CALL_START.test(rhs) && !isBody(last)) continue;
        for (const { key, value } of patternKeys({ inner })) {
            const nested = value.startsWith('{')
                ? patternKeys({ inner: value.slice(1, -1) }).map((p) => p.key)
                : [];
            const ok = key.startsWith('...')
                ? false
                : nested.length === 0
                  ? allowedNoticeRead([key])
                  : nested.every((sub) => allowedNoticeRead([key, sub]));
            if (!ok)
                found.push({
                    offset: at,
                    detail: `destructures ${key}${nested.length ? `.{${nested.join(', ')}}` : ''}`
                });
        }
    }
    for (const match of code.matchAll(
        /(?:\.\s*quer(?:y|ies)|\bsearchParams\s*\.\s*get(?:All)?)\s*\(\s*/g
    )) {
        const value = literalAt({ masked, offset: match.index + match[0].length });
        if (value === undefined) continue;
        const name = normalizeName({ name: value }).replace(/\./g, '');
        if (name !== 'dataid' && !NOTICE_FIELDS.has(name))
            found.push({ offset: match.index, detail: `reads query '${value}'` });
    }
    return toViolations({ rule: 'G17(a)', file: args.file, source: args.source, found });
}

/**
 * Predicate (b) over one file outside `packages/payments/`.
 *
 * @param args.file - Repo-relative path, for the report
 * @param args.source - The file text
 * @returns One violation per way the provider's state is taken apart from a read by id
 */
export function findStateOutsideRead(args: {
    readonly file: string;
    readonly source: string;
}): readonly Violation[] {
    const masked = maskSource({ source: args.source });
    const { code } = masked;
    const found: { offset: number; detail: string }[] = [];
    for (const match of code.matchAll(/\bstampProviderRead\b/g))
        found.push({
            offset: match.index,
            detail: 'builds a ProviderRead by hand (stampProviderRead)'
        });
    const importsPayments = importedSpecifiers({ source: args.source }).some(({ specifier }) =>
        /^@repo\/payments(?:\/|$)/.test(specifier)
    );
    if (importsPayments) {
        const importClauses = [
            ...code.matchAll(/\b(?:import|export)\s+(?:type\s+)?\{[^}]*\}\s*from\b/g)
        ];
        for (const match of code.matchAll(STATE_TYPE)) {
            if (/\bProviderRead\s*<\s*$/.test(code.slice(0, match.index))) continue;
            const inImport = importClauses.some(
                (clause) =>
                    match.index > clause.index && match.index < clause.index + clause[0].length
            );
            if (inImport) continue;
            found.push({
                offset: match.index,
                detail: `names ${match[0]} outside ProviderRead<…>`
            });
        }
        const fresh = identifiersBoundTo({ code, start: /^assertFreshForAct\s*(?:<[^>]*>)?\s*\(/ });
        const freshSource = (expr: string) =>
            /^assertFreshForAct\s*(?:<[^>]*>)?\s*\(/.test(expr) ||
            fresh.has(IDENT.exec(expr)?.[0] ?? '');
        for (const match of code.matchAll(/(?:\?\.|\.)\s*snapshot\b/g)) {
            const end = code.slice(0, match.index).trimEnd().length - 1;
            let ok = false;
            if (code[end] === ')') {
                const open = matchingOpen({ code, close: end });
                ok =
                    open !== -1 &&
                    /\bassertFreshForAct\s*(?:<[^>]*>)?\s*$/.test(code.slice(0, open));
            } else {
                ok = fresh.has(/[A-Za-z_$][\w$]*$/.exec(code.slice(0, end + 1))?.[0] ?? '');
            }
            if (!ok)
                found.push({
                    offset: match.index,
                    detail: 'reads .snapshot off something assertFreshForAct did not return'
                });
        }
        for (const { inner, rhs, at } of declaredDestructurings({ code })) {
            if (patternKeys({ inner }).some(({ key }) => key === 'snapshot') && !freshSource(rhs))
                found.push({
                    offset: at,
                    detail: 'destructures snapshot from something assertFreshForAct did not return'
                });
        }
    }
    return toViolations({ rule: 'G17(b)', file: args.file, source: args.source, found });
}

/**
 * Predicate (c) over one file.
 *
 * @param args.file - Repo-relative path, for the report
 * @param args.source - The file text
 * @returns One violation per mention of the notification table; none under {@link CUTOVER_DIR}
 */
export function findNotificationTableReads(args: {
    readonly file: string;
    readonly source: string;
}): readonly Violation[] {
    if (args.file.startsWith(CUTOVER_DIR)) return [];
    const { comments } = maskSource({ source: args.source });
    const found = [...args.source.matchAll(NOTIFICATION_TABLE)]
        .filter(
            (match) => !comments.some(({ start, end }) => match.index >= start && match.index < end)
        )
        .map((match) => ({ offset: match.index, detail: `names ${match[0]}` }));
    return toViolations({ rule: 'G17(c)', file: args.file, source: args.source, found });
}

function toViolations(args: {
    readonly rule: Rule;
    readonly file: string;
    readonly source: string;
    readonly found: readonly { readonly offset: number; readonly detail: string }[];
}): readonly Violation[] {
    return args.found
        .map(({ offset, detail }) => ({
            rule: args.rule,
            file: args.file,
            line: lineOf({ source: args.source, offset }),
            detail
        }))
        .sort((a, b) => a.line - b.line);
}

/**
 * Runs GUARD:G17.
 *
 * @param args.root - Repository root; defaults to this repo
 * @param args.minScannedFiles - Scan floor; defaults to {@link MIN_SCANNED_FILES}
 * @returns The exit code and the report
 */
export function run(args: { readonly root?: string; readonly minScannedFiles?: number } = {}): {
    readonly exitCode: 0 | 1;
    readonly output: string;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const minScannedFiles = args.minScannedFiles ?? MIN_SCANNED_FILES;
    const lines = [
        '=== GUARD:G17 - no decision comes out of a notice without re-reading by id ==='
    ];
    const production = listProductionFiles({ root, excludePrefixes: [] });
    const withScripts = listProductionFiles({
        root,
        excludePrefixes: [],
        scanRoot: /^(?:apps|packages|scripts)\//
    });
    if (production.length < minScannedFiles) {
        lines.push(
            `ERROR: only ${production.length} file(s) scanned under ${root}, expected at least ` +
                `${minScannedFiles}. The cwd is wrong or the scan is broken; this is not a clean tree.`
        );
        return { exitCode: 1, output: lines.join('\n') };
    }
    const read = (file: string) => readFileSync(join(root, file), 'utf8');
    const violations = [
        ...production
            .filter(
                (file) =>
                    !file.startsWith(PAYMENTS_ADAPTERS_DIR) && !file.startsWith(PAYMENTS_FAKE_DIR)
            )
            .flatMap((file) => findNoticeBodyReads({ file, source: read(file) })),
        ...production
            .filter((file) => !file.startsWith(PAYMENTS_DIR))
            .flatMap((file) => findStateOutsideRead({ file, source: read(file) })),
        ...withScripts.flatMap((file) => findNotificationTableReads({ file, source: read(file) }))
    ];
    if (violations.length > 0) {
        for (const rule of Object.keys(RULE_MESSAGES) as Rule[]) {
            const own = violations.filter((v) => v.rule === rule);
            if (own.length === 0) continue;
            lines.push('', `FAIL ${RULE_MESSAGES[rule]}`);
            for (const v of own) lines.push(`  ${v.file}:${v.line}  ${v.detail}`);
        }
        return { exitCode: 1, output: lines.join('\n') };
    }
    lines.push(
        `OK: ${production.length} production file(s) scanned for (a) and (b), ${withScripts.length} with ` +
            'scripts/ for (c); no notice body read beyond kind, id and version, no provider state outside ' +
            `a read by id, no read of the notification table outside ${CUTOVER_DIR}.`
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
