#!/usr/bin/env tsx
/**
 * check-mergeable-contact-info.ts
 *
 * `BaseModelImpl.mergeableJsonbColumns` decides whether `update({ column })`
 * MERGES a JSONB column against the stored row (PostgreSQL `||`) or REPLACES
 * it wholesale. The default is replace. A model whose table has a
 * `contact_info` JSONB column and does NOT declare `contactInfo` in
 * `mergeableJsonbColumns` loses, on every partial PATCH, every contact field
 * the caller's payload did not include.
 *
 * Measured against `origin/staging` before this guard existed: 4 of 7 tables
 * carrying a `contact_info` column (`event_organizers`, `post_sponsors`,
 * `gastronomies`, `experiences`) shipped with the dangerous default while
 * `accommodations`, `users` and `partners` had already opted in.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD ASSERTS — nothing more, nothing less
 * ---------------------------------------------------------------------------
 *
 * 1. Every `contact_info` JSONB column is discovered by SCANNING every `.ts`
 *    file under `packages/db/src/schemas/**` — never from a hardcoded list of
 *    table names. Discovery is anchored on the DATABASE column name alone
 *    (`jsonb('contact_info')`, in any of the three JavaScript quote styles,
 *    anywhere in the file, at any indentation, with or without further
 *    arguments); the owning table is then resolved by BRACKET-MATCHING the
 *    `pgTable(...)` call the column sits inside. That is deliberately NOT a
 *    `^export const X = pgTable(` regex: an earlier revision used one, and a
 *    synthetic eighth table written on ONE LINE, or as
 *    `export const x: T = pgTable(...)`, or declared and exported separately
 *    (`const x = pgTable(...); export { x };`), or living in a file not named
 *    `*.dbschema.ts`, VANISHED from the scan and the guard printed "All checks
 *    passed". The separately-exported spelling was worse than invisible: it
 *    was attributed to the PREVIOUS table in the file.
 * 2. A `contact_info` column the scan finds but cannot attribute to a named
 *    table — hoisted into a shared column object and spread into `pgTable`,
 *    passed to a table-factory helper, keyed by something that is not a
 *    readable property name, or readable only as part of a string literal —
 *    is a VIOLATION, not a silent skip. Same rule as the no-owning-model case
 *    below: "I cannot tell" never reads as "safe".
 * 3. Each discovered table must be owned by at least one model CLASS (a
 *    `protected table = <tableVar>;` assignment in any `.ts` file under
 *    `packages/db/src/models/**` — the suffix `*.model.ts` is NOT required,
 *    31 of the 148 files there do not carry it). Ownership is resolved
 *    through import aliases (`import { gastronomies as gastroTable }`),
 *    through further re-bindings of those aliases, through a type annotation
 *    on the property, and through a namespace qualifier
 *    (`protected table = schema.gastronomies;`). No owning model is a FAILURE,
 *    not a silent skip — a `contact_info` column with no model attached is
 *    exactly the kind of gap this guard exists to surface. When SEVERAL
 *    classes claim the same table — in different files OR in the same file —
 *    EVERY one of them must declare the column mergeable: the verdict must not
 *    depend on which file the directory walk reached first, nor on which class
 *    appears first inside a file.
 * 4. That class must declare `mergeableJsonbColumns` as a `readonly` class
 *    property (`protected override readonly mergeableJsonbColumns = [...] as
 *    const;`, or the same with `public` or with no visibility modifier) whose
 *    array literal contains the column's Drizzle property name
 *    (`'contactInfo'` for every table in this repo today) as a
 *    single- or double-quoted item.
 *
 * This guard PROHIBITS the dangerous state (a `contact_info` column reachable
 * through a model that does not declare it mergeable) — it does not merely
 * confirm the safe state exists elsewhere, which would fail open the moment
 * a declaration is silently removed.
 *
 * ---------------------------------------------------------------------------
 * HOW IT AVOIDS FAILING OPEN
 * ---------------------------------------------------------------------------
 *
 * Every match below runs against a COMMENT-STRIPPED copy of the source
 * ({@link stripComments}), never inside a STRING literal
 * ({@link findStringRanges}), and only within the body of a class that
 * actually owns the table ({@link findOwningClassBodies}). All three are
 * load-bearing, and none is a theoretical concern — earlier revisions of this
 * guard reported "All checks passed" on every one of:
 *
 *   - the declaration commented OUT from inside the array
 *     (`mergeableJsonbColumns = [ /* 'contactInfo' *\/ ] as const;`), the most
 *     natural way to disable an entry;
 *   - the declaration existing ONLY inside a JSDoc block, which is easy to
 *     produce by accident because these models carry long JSDoc quoting the
 *     very line the guard was looking for;
 *   - the declaration existing only inside a STRING literal — where the
 *     previous fix pushed it, since {@link stripComments} preserves strings on
 *     purpose;
 *   - a second model file claiming the same table, where the verdict flipped
 *     with the alphabetical order of the filenames;
 *   - a second owning CLASS in the same file, where only the first was read;
 *   - a second owning class in a file under `models/**` not named
 *     `*.model.ts`, which the walk never opened;
 *   - a second owning class whose `table` property carried a type annotation,
 *     or whose table came through a namespace import or a twice-rebound alias
 *     — none of which the ownership pattern matched, so the class was not an
 *     owner and its missing declaration was never rendered;
 *   - a second owning class whose heading held an inline object type
 *     (`class M extends BaseModelImpl<{ id: string }> {`), where the scan took
 *     the generic's brace for the body brace and the class ceased to exist;
 *   - a column spelled ``jsonb(`contact_info`)``, which was neither checked
 *     nor reported — the run's own inventory of what it had looked at simply
 *     did not contain it;
 *   - a column following a regex literal holding a lone apostrophe
 *     (`/^[a-z0-9'-]+$/`), where the unpaired quote opened a string range that
 *     ran to end of file and every later column was skipped in silence.
 *
 * That last one is the shape worth remembering: it produced neither a
 * violation nor an unattributed column, just a `continue`. A column this guard
 * cannot READ is now reported, because a skip is indistinguishable from a pass
 * in the output and this guard may not produce that ambiguity.
 *
 * The array literal is read by bracket matching rather than a lazy regex, so a
 * JSDoc example or a neighbouring property cannot be mistaken for the
 * declaration, and a `[...SHARED]` spread is resolved against a module-level
 * `const` in the same file. A spread this guard cannot resolve statically is
 * reported as a violation asking for an explicit literal — never passed over.
 *
 * A FLOOR on the number of discovered tables ({@link MIN_KNOWN_CONTACT_INFO_TABLES},
 * applied only to a run over this repository) catches a discovery regression
 * that loses one of today's tables. It is a cheap net, not a proof: it cannot
 * see an EIGHTH table that discovery never learned to find, which is why the
 * discovery hardening above exists and the floor is not the defence. The count
 * it reads is deduplicated per TABLE, not per file — keying it by file let one
 * table defined in two schema files count twice and pad the floor back over
 * the line while a real table was missing.
 *
 * WHAT IT DOES NOT PROVE
 *   - That `mergeableJsonbColumns` is *correct* for OTHER JSONB columns on
 *     the same table (e.g. `socialNetworks`, `seo`). Widening the merge set
 *     beyond `contactInfo` is a product decision, not something this guard
 *     opines on.
 *   - Runtime behaviour of the `||` merge itself — that is
 *     `packages/db/test/base/jsonb-merge.test.ts`'s job.
 *   - That a declaration INHERITED from an intermediate base class (rather
 *     than written in the owning class itself) covers `contactInfo`. Only the
 *     owning class body is read, so such a model is reported as missing the
 *     declaration. No model in this repo is shaped that way today.
 *   - Anything about a `contact_info` column declared OUTSIDE
 *     `packages/db/src/schemas/**` (a schema shipped by a dependency, or a
 *     table created by a raw-SQL migration with no Drizzle definition). This
 *     guard reads that tree and only that tree.
 *   - That a regex literal containing `//`, `/*` or a lone quote is read
 *     CORRECTLY. {@link stripComments} and {@link findStringRanges} track
 *     strings and template literals but not regex literals, so such a regex
 *     still confuses both. What changed is the CONSEQUENCE: a `contact_info`
 *     column that lands inside the resulting bogus string range is now
 *     reported as unreadable instead of skipped, so the failure is loud and
 *     fail-closed rather than silent. A regex swallowing a whole schema file
 *     will therefore make this guard fail; that is the intended trade.
 *   - That a declaration whose array item is written with BACKTICKS
 *     (``mergeableJsonbColumns = [`contactInfo`]``) is recognised. It is not,
 *     and it is reported as missing. That fails CLOSED — it costs a false
 *     alarm, never a missed column — so it is left alone rather than widened.
 *   - That a declaration written without the `readonly` keyword is
 *     recognised. Same direction: it is reported as missing.
 *   - That the model reached at runtime is the one this guard read: ownership
 *     is a static `table = <var>;` assignment. A table selected dynamically,
 *     or assigned in a constructor rather than as a class property, is
 *     invisible here.
 *   - That an owning class the walk finds is a `BaseModelImpl` subclass at
 *     all. Ownership is decided by the `table = <var>;` assignment alone, so a
 *     non-model class holding a same-named property would be judged too —
 *     which can only ADD violations, never remove one.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..');

const SCHEMA_DIR = 'packages/db/src/schemas';
const MODELS_DIR = 'packages/db/src/models';

/**
 * The number of `contact_info` tables this repository is known to have. Used
 * ONLY as a floor on a run over {@link REPO_ROOT} (see
 * {@link tableFloorViolation}).
 */
export const MIN_KNOWN_CONTACT_INFO_TABLES = 7;

/**
 * A `jsonb('contact_info')` column, anywhere in the file, at any indentation,
 * with or without extra arguments.
 *
 * Deliberately NOT anchored to a line start nor to a `contactInfo:` prefix:
 * the DATABASE column name is the thing that decides whether a PATCH can lose
 * data, so it is the thing discovery keys on. The Drizzle property name is
 * read separately ({@link COLUMN_PROPERTY_TAIL_RE}) and its absence is a
 * violation rather than a reason to look away.
 *
 * All THREE JavaScript string delimiters are accepted, backtick included.
 * ``jsonb(`contact_info`)`` is ordinary TypeScript and Biome leaves it alone —
 * the repo's preset does not enable `noUnusedTemplateLiteral` — so a
 * single-quote-only class made that column not merely unchecked but ABSENT
 * from the report: it was neither a violation nor an unattributed column, it
 * simply did not exist as far as the guard was concerned.
 */
const CONTACT_INFO_JSONB_RE = /\bjsonb\s*\(\s*(['"`])contact_info\1\s*[,)]/g;

/** The property key immediately preceding a column definition, quoted or bare. */
const COLUMN_PROPERTY_TAIL_RE = /(?:['"]([A-Za-z_$][\w$]*)['"]|([A-Za-z_$][\w$]*))\s*:\s*$/;

/** Any `pgTable(` call — no `export const` anchor, no line anchor. */
const PG_TABLE_CALL_RE = /\bpgTable\s*\(/g;

/**
 * The assignment head immediately preceding a `pgTable(` call, e.g.
 * `export const venues = `, `const venues: SomeType = `, `let venues =`.
 */
const TABLE_ASSIGNMENT_TAIL_RE = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]*)?=\s*$/;

/**
 * The HEAD of the `mergeableJsonbColumns` class-property declaration, up to
 * and including the `=`. The value itself is read by bracket matching from
 * there, not by this regex — a lazy `[\s\S]*?\]` tail would stop at the first
 * `]` it found, which is how a JSDoc example above the real declaration used
 * to shadow it.
 *
 * The visibility modifier is OPTIONAL and may be `public`: widening a
 * `protected` base member to `public` in a subclass is legal TypeScript and
 * changes nothing at runtime, but an earlier revision required the literal
 * word `protected` and answered `does not declare 'contactInfo'` on a model
 * that plainly did. That failed CLOSED, so it was never a hole — it just sent
 * the reader to fix something already correct. `private` is deliberately NOT
 * accepted: TypeScript rejects narrowing a protected base member to private,
 * so a declaration spelled that way does not compile in the first place.
 */
const MERGEABLE_DECL_HEAD_RE =
    /(?:(?:public|protected)\s+)?(?:override\s+)?readonly\s+mergeableJsonbColumns\s*(?::\s*readonly\s+string\[\]\s*)?=\s*/g;

/** `...IDENTIFIER` inside an array literal. */
const SPREAD_RE = /\.\.\.\s*([A-Za-z_$][\w$]*)/g;

/**
 * A class declaration head, e.g. `export class GastronomyModel extends ... {`.
 *
 * The NAME is optional and `extends` / `implements` are excluded from it:
 * `export default class extends BaseModelImpl { ... }` is legal, was detected
 * correctly, and was reported as `Model: <file> :: extends` because a bare
 * `class\s+(\w+)` happily captured the keyword. Making the name optional
 * rather than requiring an identifier keeps the anonymous class VISIBLE —
 * demanding a name would have dropped it from the walk, turning a cosmetic
 * mislabel into a blind spot.
 */
const CLASS_HEAD_RE = /\bclass\b(?!\s*[:=])(?:\s+(?!extends\b|implements\b)([A-Za-z_$][\w$]*))?/g;

/** What an anonymous (`export default class …`) class is called in the report. */
const ANONYMOUS_CLASS_NAME = '(anonymous default export)';

export interface ContactInfoTable {
    readonly tableVar: string;
    readonly schemaFile: string;
    /** The Drizzle property key the column is defined under, e.g. `contactInfo`. */
    readonly propertyName: string;
}

/** A `contact_info` column the scan found but could not attribute to a table. */
export interface UnattributedContactInfoColumn {
    readonly schemaFile: string;
    readonly line: number;
    readonly reason: string;
    /** Remediation for THIS reason, when the generic one would not fit. */
    readonly fix?: string;
}

export interface Violation {
    /** The table var, when one could be resolved. */
    readonly table?: string;
    /** `file:line` of the column, for a violation with no resolved table. */
    readonly columnLocation?: string;
    readonly schemaFile: string;
    readonly reason: string;
    /** Remediation text for THIS reason — never a generic one. */
    readonly fix: string;
    readonly modelFile?: string;
    readonly modelClass?: string;
}

/**
 * The three possible verdicts for one class body. `unresolved` is deliberately
 * distinct from `absent`: "I cannot tell" must not be reported as "it is
 * declared", and it must not be reported as "somebody deleted it" either.
 */
export type MergeableVerdict =
    | { readonly kind: 'declared' }
    | { readonly kind: 'absent' }
    | { readonly kind: 'unresolved'; readonly detail: string };

// ---------------------------------------------------------------------------
// Source primitives
// ---------------------------------------------------------------------------

/**
 * Replace every `//` and `/* *\/` comment with equivalent whitespace, leaving
 * string and template literals untouched so `'contactInfo'` and
 * `jsonb('contact_info')` still match.
 *
 * Whitespace rather than deletion: offsets and line boundaries are preserved,
 * so the anchored regexes above keep meaning on the stripped copy what they
 * meant on the raw file.
 */
export function stripComments(source: string): string {
    let out = '';
    let i = 0;
    const n = source.length;

    while (i < n) {
        const ch = source[i] as string;
        const next = source[i + 1];

        if (ch === '/' && next === '/') {
            while (i < n && source[i] !== '\n') {
                out += ' ';
                i++;
            }
            continue;
        }

        if (ch === '/' && next === '*') {
            out += '  ';
            i += 2;
            while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
                out += source[i] === '\n' ? '\n' : ' ';
                i++;
            }
            if (i < n) {
                out += '  ';
                i += 2;
            }
            continue;
        }

        if (ch === "'" || ch === '"' || ch === '`') {
            out += ch;
            i++;
            while (i < n) {
                if (source[i] === '\\') {
                    out += source[i] as string;
                    out += source[i + 1] ?? '';
                    i += 2;
                    continue;
                }
                out += source[i] as string;
                const closed = source[i] === ch;
                i++;
                if (closed) break;
            }
            continue;
        }

        out += ch;
        i++;
    }

    return out;
}

/**
 * Half-open `[start, end)` ranges covering every string / template literal
 * (quotes included) in comment-stripped source.
 *
 * {@link stripComments} preserves strings ON PURPOSE — the guard has to read
 * `'contactInfo'` — which means prose that merely QUOTES the declaration
 * survives stripping. This is how that prose is told apart from the real
 * declaration.
 */
export function findStringRanges(strippedSource: string): ReadonlyArray<readonly [number, number]> {
    const ranges: Array<readonly [number, number]> = [];
    let i = 0;
    const n = strippedSource.length;

    while (i < n) {
        const ch = strippedSource[i] as string;
        if (ch === "'" || ch === '"' || ch === '`') {
            const start = i;
            i++;
            while (i < n) {
                if (strippedSource[i] === '\\') {
                    i += 2;
                    continue;
                }
                const closed = strippedSource[i] === ch;
                i++;
                if (closed) break;
            }
            ranges.push([start, i] as const);
            continue;
        }
        i++;
    }

    return ranges;
}

/** Whether `index` falls strictly inside one of `ranges`. */
export function isInsideString(
    ranges: ReadonlyArray<readonly [number, number]>,
    index: number
): boolean {
    return ranges.some(([start, end]) => index > start && index < end);
}

/**
 * Index of the delimiter closing the one at `openIndex`, or `-1`.
 * String literals are skipped, so a `'}'` inside a string cannot unbalance it.
 * Expects comment-stripped input.
 */
export function findMatchingDelimiter(
    source: string,
    openIndex: number,
    open: string,
    close: string
): number {
    let depth = 0;
    let i = openIndex;
    const n = source.length;

    while (i < n) {
        const ch = source[i] as string;

        if (ch === "'" || ch === '"' || ch === '`') {
            i++;
            while (i < n) {
                if (source[i] === '\\') {
                    i += 2;
                    continue;
                }
                const closed = source[i] === ch;
                i++;
                if (closed) break;
            }
            continue;
        }

        if (ch === open) {
            depth++;
        } else if (ch === close) {
            depth--;
            if (depth === 0) return i;
        }
        i++;
    }

    return -1;
}

/**
 * Index of the `{` that opens a class BODY, starting the scan at `from` (just
 * past the class head), or `-1`.
 *
 * Not `indexOf('{')`: a type argument in the heading can contain braces of its
 * own. `class M extends BaseModelImpl<{ id: string }> {` made the first `{`
 * the one INSIDE the generic, so the "body" came out as ` id: string ` and the
 * class vanished from {@link findOwningClassBodies} — a model owning a
 * `contact_info` table simply stopped existing, which is the exact fail-open
 * shape this guard is built against.
 *
 * Type-argument lists are therefore tracked and skipped: `<`/`>` are counted
 * (with `=>` consumed as one token so an arrow inside a generic cannot
 * unbalance them), and a `{` seen while inside one is skipped wholesale by
 * bracket matching.
 */
export function findClassBodyBrace(strippedSource: string, from: number): number {
    let i = from;
    let angle = 0;
    const n = strippedSource.length;

    while (i < n) {
        const ch = strippedSource[i] as string;

        if (ch === "'" || ch === '"' || ch === '`') {
            i++;
            while (i < n) {
                if (strippedSource[i] === '\\') {
                    i += 2;
                    continue;
                }
                const closed = strippedSource[i] === ch;
                i++;
                if (closed) break;
            }
            continue;
        }

        if (ch === '=' && strippedSource[i + 1] === '>') {
            i += 2;
            continue;
        }

        if (ch === '<') {
            angle++;
            i++;
            continue;
        }

        if (ch === '>') {
            if (angle > 0) angle--;
            i++;
            continue;
        }

        if (ch === '{') {
            if (angle === 0) return i;
            const close = findMatchingDelimiter(strippedSource, i, '{', '}');
            if (close < 0) return -1;
            i = close + 1;
            continue;
        }

        i++;
    }

    return -1;
}

/** Every `class X { ... }` body in comment-stripped source, by declaration order. */
export function findClassBodies(
    strippedSource: string
): ReadonlyArray<{ readonly name: string; readonly body: string }> {
    const out: Array<{ name: string; body: string }> = [];

    for (const match of strippedSource.matchAll(CLASS_HEAD_RE)) {
        const start = match.index;
        if (start === undefined) continue;
        const braceIndex = findClassBodyBrace(strippedSource, start + match[0].length);
        if (braceIndex < 0) continue;
        const end = findMatchingDelimiter(strippedSource, braceIndex, '{', '}');
        if (end < 0) continue;
        out.push({
            name: match[1] ?? ANONYMOUS_CLASS_NAME,
            body: strippedSource.slice(braceIndex + 1, end)
        });
    }

    return out;
}

/**
 * Every local name that refers to `tableVar` inside one module: the table's own
 * name, an import alias (`import { gastronomies as gastroTable }`) and a
 * module-level re-binding (`const gastroTable = gastronomies;`).
 *
 * Without this, a model that imports the table under an alias is not recognised
 * as an owner. That fails OPEN in the worst possible way when a second model
 * declares the column: one owner is enough for the table to pass, so the
 * aliased — undeclared — model disappears from the report entirely.
 *
 * Resolution is TRANSITIVE, to a fixpoint. One hop was not enough: an import
 * alias re-bound once more (`import { gastronomies as gastroTable }` followed
 * by `const catalogTable = gastroTable;`) matched neither pattern against the
 * table's own name, so the model assigning `catalogTable` was not an owner and
 * went missing exactly like an unaliased one.
 */
export function findTableAliases(strippedSource: string, tableVar: string): readonly string[] {
    const names = new Set<string>([tableVar]);
    const pending: string[] = [tableVar];

    while (pending.length > 0) {
        const current = pending.pop() as string;
        const discovered: string[] = [];

        for (const m of strippedSource.matchAll(
            new RegExp(`\\b${current}\\s+as\\s+([A-Za-z_$][\\w$]*)`, 'g')
        )) {
            discovered.push(m[1] as string);
        }
        for (const m of strippedSource.matchAll(
            new RegExp(
                `\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*(?::[^=;]*)?=\\s*${current}\\s*;`,
                'g'
            )
        )) {
            discovered.push(m[1] as string);
        }

        for (const name of discovered) {
            if (names.has(name)) continue;
            names.add(name);
            pending.push(name);
        }
    }

    return [...names];
}

/**
 * EVERY class in the file that assigns `protected table = <tableVar>;` (or one
 * of the table's aliases), read from comment-stripped source.
 *
 * Scoping to the class body — rather than testing the whole file — is what
 * stops a declaration belonging to a NEIGHBOURING class in the same file from
 * vouching for this one. Returning ALL of them — rather than the first — is
 * what stops the verdict from depending on class order inside the file.
 *
 * Two spellings the first revision of this pattern did not accept, each of
 * which erased an owner rather than flagging it:
 *
 *   - a TYPE ANNOTATION on the property
 *     (`protected table: typeof gastronomies = gastronomies;`), which is
 *     ordinary TypeScript;
 *   - a NAMESPACE-qualified table (`import * as schema` +
 *     `protected table = schema.gastronomies;`).
 *
 * The visibility modifier is optional here for the same reason it is optional
 * on the declaration itself: recognising MORE owners can only add violations,
 * never remove them, so erring wide is the fail-closed direction.
 */
export function findOwningClassBodies(
    source: string,
    tableVar: string
): ReadonlyArray<{ readonly name: string; readonly body: string }> {
    const stripped = stripComments(source);
    const ownerRes = findTableAliases(stripped, tableVar).map(
        (name) =>
            new RegExp(
                '^\\s*(?:(?:public|protected|private)\\s+)?(?:override\\s+)?(?:readonly\\s+)?' +
                    `table\\s*(?::[^=;]*)?=\\s*(?:[A-Za-z_$][\\w$]*\\s*\\.\\s*)?${name}\\s*;`,
                'm'
            )
    );
    return findClassBodies(stripped).filter((cls) => ownerRes.some((re) => re.test(cls.body)));
}

/**
 * The FIRST class that owns `tableVar`, or `undefined`.
 *
 * Kept for callers that only need "is this file an owner at all". Anything
 * that renders a verdict must use {@link findOwningClassBodies}, because a
 * second owning class in the same file is exactly as dangerous as a second
 * owning file.
 */
export function findOwningClassBody(
    source: string,
    tableVar: string
): { readonly name: string; readonly body: string } | undefined {
    return findOwningClassBodies(source, tableVar)[0];
}

/**
 * Read the array literal assigned to a module-level `const <name> = [...]`.
 * Returns `undefined` when the constant is absent or is not an array literal
 * (e.g. it is imported from another module), which the caller must treat as
 * "cannot tell", never as "safe".
 */
export function resolveConstArrayLiteral(
    strippedModuleSource: string,
    name: string
): string | undefined {
    const re = new RegExp(`\\bconst\\s+${name}\\s*(?::[^=;]*)?=\\s*`);
    const match = re.exec(strippedModuleSource);
    if (!match) return undefined;

    const after = match.index + match[0].length;
    if (strippedModuleSource[after] !== '[') return undefined;
    const end = findMatchingDelimiter(strippedModuleSource, after, '[', ']');
    if (end < 0) return undefined;
    return strippedModuleSource.slice(after, end + 1);
}

/**
 * Whether the given (comment-stripped) class body declares `propertyName` as a
 * mergeable JSONB column.
 *
 * @param strippedClassBody - Class body with comments already removed.
 * @param strippedModuleSource - The whole file, comments removed, used to
 *   resolve a `[...CONSTANT]` spread. Defaults to the class body.
 * @param propertyName - The Drizzle property key to look for. Defaults to
 *   `contactInfo`, which is what every `contact_info` column in this repo is
 *   keyed under; discovery passes the key it actually read.
 */
export function declaresContactInfoMergeable(
    strippedClassBody: string,
    strippedModuleSource: string = strippedClassBody,
    propertyName = 'contactInfo'
): MergeableVerdict {
    const itemRe = new RegExp(`(['"])${propertyName}\\1`);
    const bodyStrings = findStringRanges(strippedClassBody);
    const heads = [...strippedClassBody.matchAll(MERGEABLE_DECL_HEAD_RE)].filter(
        (head) => head.index !== undefined && !isInsideString(bodyStrings, head.index)
    );
    if (heads.length === 0) {
        return { kind: 'absent' };
    }

    const unresolved: string[] = [];

    for (const head of heads) {
        if (head.index === undefined) continue;
        const valueStart = head.index + head[0].length;

        if (strippedClassBody[valueStart] !== '[') {
            unresolved.push('the assigned value is not an array literal');
            continue;
        }

        const end = findMatchingDelimiter(strippedClassBody, valueStart, '[', ']');
        if (end < 0) {
            unresolved.push('the array literal is unterminated');
            continue;
        }

        const literal = strippedClassBody.slice(valueStart, end + 1);
        if (itemRe.test(literal)) {
            return { kind: 'declared' };
        }

        for (const spread of literal.matchAll(SPREAD_RE)) {
            const constName = spread[1] as string;
            const resolved = resolveConstArrayLiteral(strippedModuleSource, constName);
            if (resolved === undefined) {
                unresolved.push(
                    `\`...${constName}\` is not a module-level array literal in this file, so its items cannot be read statically`
                );
                continue;
            }
            if (itemRe.test(resolved)) {
                return { kind: 'declared' };
            }
        }
    }

    if (unresolved.length > 0) {
        return { kind: 'unresolved', detail: unresolved.join('; ') };
    }
    return { kind: 'absent' };
}

// ---------------------------------------------------------------------------
// Repository walk
// ---------------------------------------------------------------------------

function collectFiles(root: string, dir: string, suffix: string): string[] {
    const abs = join(root, dir);
    const out: string[] = [];
    let entries: string[];
    try {
        entries = readdirSync(abs);
    } catch {
        return out;
    }
    for (const entry of entries) {
        const full = join(abs, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            out.push(...collectFiles(root, join(dir, entry), suffix));
        } else if (entry.endsWith(suffix) && extname(entry) === '.ts') {
            out.push(full);
        }
    }
    return out;
}

/** 1-based line number of `index` in `source`. */
function lineOf(source: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index && i < source.length; i++) {
        if (source[i] === '\n') line++;
    }
    return line;
}

interface TableSpan {
    readonly name?: string;
    readonly start: number;
    readonly end: number;
}

/**
 * Every `pgTable(...)` call in comment-stripped source, as a `[start, end]`
 * span over its argument list, with the const it is assigned to when there is
 * one.
 *
 * Bracket matching rather than "slice from one `export const` to the next":
 * the slice approach attributes anything written between two table exports to
 * the EARLIER table, which is how a `const x = pgTable(...); export { x };`
 * table was reported under its predecessor's name.
 */
function findTableSpans(strippedSource: string): readonly TableSpan[] {
    const spans: TableSpan[] = [];

    for (const match of strippedSource.matchAll(PG_TABLE_CALL_RE)) {
        if (match.index === undefined) continue;
        const openParen = match.index + match[0].length - 1;
        const end = findMatchingDelimiter(strippedSource, openParen, '(', ')');
        if (end < 0) continue;
        const head = TABLE_ASSIGNMENT_TAIL_RE.exec(strippedSource.slice(0, match.index));
        spans.push({ name: head?.[1], start: openParen, end });
    }

    return spans;
}

interface SchemaScan {
    readonly tables: readonly ContactInfoTable[];
    readonly unattributed: readonly UnattributedContactInfoColumn[];
}

/**
 * Finds every `contact_info` JSONB column across the schema tree and resolves
 * each to the Drizzle table it belongs to, reporting the ones it cannot
 * resolve instead of dropping them.
 */
export function scanContactInfoColumns(root: string): SchemaScan {
    const files = collectFiles(root, SCHEMA_DIR, '.ts');
    const tables = new Map<string, ContactInfoTable>();
    const unattributed: UnattributedContactInfoColumn[] = [];

    for (const file of files) {
        const content = stripComments(readFileSync(file, 'utf8'));
        const schemaFile = relative(root, file);
        const strings = findStringRanges(content);
        const spans = findTableSpans(content);

        for (const match of content.matchAll(CONTACT_INFO_JSONB_RE)) {
            const at = match.index;
            if (at === undefined) continue;

            const line = lineOf(content, at);

            if (isInsideString(strings, at)) {
                unattributed.push({
                    schemaFile,
                    line,
                    reason:
                        'it sits inside a string literal as this guard reads the file. Either it ' +
                        'really is quoted prose, or an unpaired quote earlier in the file (a regex ' +
                        "literal such as /^[a-z0-9'-]+$/ — this guard does not parse those) opened " +
                        'a string that never closes',
                    fix: FIX_INSIDE_STRING
                });
                continue;
            }

            const owning = spans.find((span) => at > span.start && at < span.end);

            if (!owning) {
                unattributed.push({
                    schemaFile,
                    line,
                    reason: 'it is not inside any `pgTable(...)` call in this file'
                });
                continue;
            }
            if (!owning.name) {
                unattributed.push({
                    schemaFile,
                    line,
                    reason: 'the `pgTable(...)` call holding it is not assigned to a named const'
                });
                continue;
            }

            const property = COLUMN_PROPERTY_TAIL_RE.exec(content.slice(0, at));
            const propertyName = property?.[1] ?? property?.[2];
            if (!propertyName) {
                unattributed.push({
                    schemaFile,
                    line,
                    reason: `it has no readable Drizzle property name, so there is no key to look for in \`${owning.name}\`'s model`
                });
                continue;
            }

            // Keyed by TABLE, never by file: ownership is resolved from the
            // table's variable NAME across every model file, so the same name
            // seen in two schema files yields the same verdict twice — while
            // inflating the count that MIN_KNOWN_CONTACT_INFO_TABLES floors,
            // which is how a duplicated definition could mask a table
            // discovery had genuinely lost.
            tables.set(`${owning.name}::${propertyName}`, {
                tableVar: owning.name,
                schemaFile,
                propertyName
            });
        }
    }

    return { tables: [...tables.values()], unattributed };
}

/** The resolvable `contact_info` tables. See {@link scanContactInfoColumns}. */
export function findContactInfoTables(root: string): ContactInfoTable[] {
    return [...scanContactInfoColumns(root).tables];
}

/**
 * EVERY `.ts` file under `packages/db/src/models/**` — not just `*.model.ts`.
 *
 * The schema side of this guard stopped filtering by `*.dbschema.ts` for
 * exactly this reason, and the models side kept the same bug one directory
 * over: `packages/db/src/models/gastronomy/gastronomy-catalog-filters.ts` is a
 * real file today, and 31 of the 148 `.ts` files under `models/` do not carry
 * the `.model.ts` suffix. A model class living in one of them owned its table
 * as far as the runtime was concerned and was invisible here, so its missing
 * declaration could not be reported.
 */
export function collectModelFiles(root: string): string[] {
    return collectFiles(root, MODELS_DIR, '.ts');
}

/**
 * EVERY model CLASS that assigns `protected table = <tableVar>;`, across every
 * model file — one entry per class, not per file.
 *
 * Deliberately not "the first one": stopping at the first match makes the
 * verdict depend on the order `readdirSync` returns and on the order classes
 * appear inside a file, so two models over the same table would be judged by
 * whichever sorted earlier.
 */
export function findOwningModels(
    root: string,
    modelFiles: readonly string[],
    tableVar: string
): ReadonlyArray<{
    readonly file: string;
    readonly className: string;
    readonly classBody: string;
    readonly module: string;
}> {
    const out: Array<{ file: string; className: string; classBody: string; module: string }> = [];
    for (const file of modelFiles) {
        const source = readFileSync(file, 'utf8');
        const module = stripComments(source);
        for (const owner of findOwningClassBodies(source, tableVar)) {
            out.push({
                file: relative(root, file),
                className: owner.name,
                classBody: owner.body,
                module
            });
        }
    }
    return out;
}

const FIX_ADD_DECLARATION =
    "Fix: add `protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;`\n" +
    '  (extending the array if the model already declares other mergeable columns)\n' +
    '  to the owning model, following packages/db/src/models/partner/partner.model.ts.';

const FIX_NO_OWNER =
    'Fix: this column is unreachable through any model, so nothing enforces its merge\n' +
    '  semantics. Either attach it to a model that assigns `protected table = <table>;`\n' +
    '  (and declare `contactInfo` mergeable there), or drop the column if the table is dead.';

const FIX_UNRESOLVED_SPREAD =
    'Fix: spell the mergeable columns as a literal array in the model itself, e.g.\n' +
    "  `= ['contactInfo'] as const;`. This guard reads the declaration statically and\n" +
    '  refuses to assume an unresolvable value contains the column.';

const FIX_UNATTRIBUTED =
    'Fix: define the column INSIDE the `pgTable(...)` call of a named exported const,\n' +
    "  under a plain property key (`contactInfo: jsonb('contact_info')`). This guard\n" +
    '  refuses to assume a column it cannot attribute to a table is protected.';

const FIX_INSIDE_STRING =
    'Fix: if this really is quoted prose, move it out of a `packages/db/src/schemas/**`\n' +
    '  file. If it is a real column, an earlier unpaired quote is what hid it — most\n' +
    '  often a regex literal containing an apostrophe. Rewrite that literal (escape the\n' +
    '  quote, or use `new RegExp("…")`). This guard reports the column rather than\n' +
    '  skipping it: a column it cannot read is not a column it may call safe.';

/**
 * The floor message, or `undefined`. Applied ONLY to a run over this
 * repository: the unit-test trees legitimately hold a single table.
 *
 * This catches a discovery regression that LOSES one of today's tables. It
 * cannot catch a table discovery never learned to see — that is what the
 * bracket-matching attribution above is for.
 */
export function tableFloorViolation(root: string, found: number): string | undefined {
    if (resolve(root) !== resolve(REPO_ROOT)) return undefined;
    if (found >= MIN_KNOWN_CONTACT_INFO_TABLES) return undefined;
    return (
        `ERROR: discovery found ${found} contact_info table(s); this repository has at least ` +
        `${MIN_KNOWN_CONTACT_INFO_TABLES}.\n` +
        '  A table went missing from the SCAN, which is a guard regression, not a green run.\n' +
        '  If a table was genuinely removed, lower MIN_KNOWN_CONTACT_INFO_TABLES in the same commit.'
    );
}

export function run(root: string): number {
    console.log('=== Checking contact_info columns declare mergeableJsonbColumns ===\n');

    const scan = scanContactInfoColumns(root);
    const tables = scan.tables;

    if (tables.length === 0 && scan.unattributed.length === 0) {
        console.log('ERROR: found zero contact_info columns across packages/db/src/schemas/**.');
        console.log(
            '  This almost certainly means the scan regex broke, not that the column disappeared.'
        );
        return 1;
    }

    const floor = tableFloorViolation(root, tables.length);
    if (floor) {
        console.log(floor);
        return 1;
    }

    console.log(`Found ${tables.length} table(s) with a contact_info JSONB column:`);
    for (const t of tables) console.log(`  - ${t.tableVar} (${t.schemaFile})`);
    console.log('');

    const modelFiles = collectModelFiles(root);
    const violations: Violation[] = [];

    for (const orphan of scan.unattributed) {
        violations.push({
            columnLocation: `${orphan.schemaFile}:${orphan.line}`,
            schemaFile: orphan.schemaFile,
            reason: `a contact_info column could not be attributed to a table: ${orphan.reason}`,
            fix: orphan.fix ?? FIX_UNATTRIBUTED
        });
    }

    for (const table of tables) {
        const owners = findOwningModels(root, modelFiles, table.tableVar);
        if (owners.length === 0) {
            violations.push({
                table: table.tableVar,
                schemaFile: table.schemaFile,
                reason: `no model file assigns \`protected table = ${table.tableVar};\``,
                fix: FIX_NO_OWNER
            });
            continue;
        }

        if (owners.length > 1) {
            const fileCount = new Set(owners.map((o) => o.file)).size;
            console.log(
                `  NOTE: ${table.tableVar} is claimed by ${fileCount} model files (${owners.length} owning class(es)) — all of them must declare the column:`
            );
            for (const owner of owners) console.log(`    - ${owner.file} :: ${owner.className}`);
            console.log('');
        }

        for (const owner of owners) {
            const verdict = declaresContactInfoMergeable(
                owner.classBody,
                owner.module,
                table.propertyName
            );
            if (verdict.kind === 'declared') continue;
            violations.push({
                table: table.tableVar,
                schemaFile: table.schemaFile,
                modelFile: owner.file,
                modelClass: owner.className,
                reason:
                    verdict.kind === 'absent'
                        ? `does not declare '${table.propertyName}' in mergeableJsonbColumns`
                        : `declares mergeableJsonbColumns but this guard cannot read it: ${verdict.detail}`,
                fix: verdict.kind === 'absent' ? FIX_ADD_DECLARATION : FIX_UNRESOLVED_SPREAD
            });
        }
    }

    if (violations.length > 0) {
        console.log('ERROR: the following contact_info columns are NOT protected:\n');
        for (const v of violations) {
            if (v.table) console.log(`  Table: ${v.table} (${v.schemaFile})`);
            else console.log(`  Column: contact_info at ${v.columnLocation}`);
            if (v.modelFile) console.log(`  Model: ${v.modelFile} :: ${v.modelClass}`);
            console.log(`  Reason: ${v.reason}`);
            console.log(`  ${v.fix}`);
            console.log('');
        }
        return 1;
    }

    console.log(
        `OK — all ${tables.length} contact_info column(s) are declared mergeable by their model.`
    );
    console.log('');
    console.log('All checks passed.');
    return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    process.exit(run(REPO_ROOT));
}
