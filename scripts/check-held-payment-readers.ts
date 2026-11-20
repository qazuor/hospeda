/**
 * @file check-held-payment-readers.ts
 * @description GUARD:HELD-ROWS (HOS-2179 D1). A one-time page charge that only a
 * reconciliation mark holds (COBRO_DUPLICADO, mark 23, DIVERGENCIA_DE_MONTO) has its own
 * `payment` row hung from the instance. That row is money pending a person's decision, never
 * the purchase's payment: a reader that takes "the payment of this instance" without telling
 * the two apart activates, refunds or credits the wrong row.
 *
 * ## What the predicate checks
 *
 * Every production read of `payments.addonInstanceId` must sit in a function that calls
 * `notHeldByPageChargeMark(...)` or `heldByPageChargeMark(...)` (the two predicates of
 * `one-time-page-charge-marks.ts`), or that function must be on the allowlist
 * (`scripts/guards/held-payment-readers.json`) with a reason. The enclosing function is the
 * nearest NAMED one (declaration, method, or a variable holding a function), so a reader inside
 * an anonymous transaction callback counts against the function that owns it. An allowlist
 * entry that no longer matches a reader, or that carries no reason, is an error too, so the
 * list cannot rot into a blanket exemption.
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * - Relational queries (`db.query.payments...`) and raw SQL naming `addon_instance_id`.
 * - An alias of the table (`const p = payments; p.addonInstanceId`).
 * - A predicate that is called but neutralised (`or(notHeldByPageChargeMark(), sql\`true\`)`),
 *   or called in the function for another query than the one that reads the column.
 * - Test files, which are out of scope by design.
 *
 * Exit codes: 0 = clean; 1 = an unfiltered reader, or a stale or reasonless allowlist entry.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Where the allowlist lives, relative to the repo root. */
export const ALLOWLIST_PATH = 'scripts/guards/held-payment-readers.json';

/** The production roots the guard scans. */
export const SCAN_ROOTS = ['packages', 'apps'] as const;

/** The predicate calls that make a reader aware of held rows. */
const PREDICATES = new Set(['notHeldByPageChargeMark', 'heldByPageChargeMark']);

/** One allowlisted reader. */
export interface HeldReaderAllowance {
    readonly file: string;
    readonly function: string;
    readonly reason: string;
}

/** One reader found in production code. */
export interface HeldReader {
    readonly file: string;
    readonly function: string;
    readonly line: number;
    readonly filtered: boolean;
}

/** What the guard reports. */
export interface HeldReaderFindings {
    readonly readers: readonly HeldReader[];
    readonly unfiltered: readonly HeldReader[];
    readonly stale: readonly HeldReaderAllowance[];
    readonly reasonless: readonly HeldReaderAllowance[];
}

/** The name of a function-like node, or undefined when it is anonymous. */
function nameOf(node: ts.Node): string | undefined {
    if (
        (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
        node.name &&
        (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
    )
        return node.name.text;
    if (
        (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
        ts.isVariableDeclaration(node.parent) &&
        ts.isIdentifier(node.parent.name)
    )
        return node.parent.name.text;
    return undefined;
}

/** Whether a function body calls one of the held-row predicates. */
function callsPredicate(node: ts.Node): boolean {
    let found = false;
    const visit = (child: ts.Node): void => {
        if (found) return;
        if (
            ts.isCallExpression(child) &&
            ts.isIdentifier(child.expression) &&
            PREDICATES.has(child.expression.text)
        ) {
            found = true;
            return;
        }
        ts.forEachChild(child, visit);
    };
    visit(node);
    return found;
}

/**
 * Finds every read of `payments.addonInstanceId` in one source file.
 *
 * @param input.file - The path to report, relative to the repo root
 * @param input.source - The file's text
 * @returns One reader per occurrence, with its nearest named function
 */
export function readersIn(input: { readonly file: string; readonly source: string }): HeldReader[] {
    const sf = ts.createSourceFile(input.file, input.source, ts.ScriptTarget.Latest, true);
    const found: HeldReader[] = [];
    const visit = (node: ts.Node): void => {
        if (
            ts.isPropertyAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'payments' &&
            node.name.text === 'addonInstanceId'
        ) {
            let owner: ts.Node | undefined = node.parent;
            let name = owner ? nameOf(owner) : undefined;
            while (owner && !name) {
                owner = owner.parent;
                name = owner ? nameOf(owner) : undefined;
            }
            found.push({
                file: input.file,
                function: name ?? '<module>',
                line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
                filtered: owner ? callsPredicate(owner) : false
            });
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return found;
}

/**
 * Compares the readers against the allowlist.
 *
 * @param input.readers - Every reader found
 * @param input.allowlist - The allowlisted readers
 * @returns The unfiltered readers not allowlisted, and the stale or reasonless entries
 */
export function findHeldReaderProblems(input: {
    readonly readers: readonly HeldReader[];
    readonly allowlist: readonly HeldReaderAllowance[];
}): HeldReaderFindings {
    const allowed = (reader: HeldReader) =>
        input.allowlist.some(
            (entry) => entry.file === reader.file && entry.function === reader.function
        );
    return {
        readers: input.readers,
        unfiltered: input.readers.filter((reader) => !reader.filtered && !allowed(reader)),
        stale: input.allowlist.filter(
            (entry) =>
                !input.readers.some(
                    (reader) => reader.file === entry.file && reader.function === entry.function
                )
        ),
        reasonless: input.allowlist.filter((entry) => entry.reason.trim().length === 0)
    };
}

/** Every production `.ts` file under a directory, skipping tests, builds and dependencies. */
function productionFiles(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        if (['node_modules', 'dist', 'build', 'test', '__tests__', '.turbo'].includes(name))
            continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) out.push(...productionFiles(full));
        else if (
            /\.tsx?$/.test(name) &&
            !/\.(test|spec)\.tsx?$/.test(name) &&
            !name.endsWith('.d.ts')
        )
            out.push(full);
    }
    return out;
}

/**
 * Runs the guard over a repo root.
 *
 * @param args.root - The repo root (defaults to this script's repo)
 * @returns The findings and whether they pass
 */
export function run(args: { readonly root?: string } = {}): {
    readonly ok: boolean;
    readonly findings: HeldReaderFindings;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const readers: HeldReader[] = [];
    for (const scanRoot of SCAN_ROOTS) {
        const base = join(root, scanRoot);
        let packages: string[] = [];
        try {
            packages = readdirSync(base);
        } catch {
            continue;
        }
        for (const pkg of packages) {
            const src = join(base, pkg, 'src');
            try {
                if (!statSync(src).isDirectory()) continue;
            } catch {
                continue;
            }
            for (const file of productionFiles(src)) {
                const source = readFileSync(file, 'utf8');
                if (!source.includes('addonInstanceId')) continue;
                readers.push(...readersIn({ file: relative(root, file), source }));
            }
        }
    }
    const allowlist = (
        JSON.parse(readFileSync(join(root, ALLOWLIST_PATH), 'utf8')) as {
            readonly readers: readonly HeldReaderAllowance[];
        }
    ).readers;
    const findings = findHeldReaderProblems({ readers, allowlist });
    return {
        ok:
            findings.unfiltered.length === 0 &&
            findings.stale.length === 0 &&
            findings.reasonless.length === 0,
        findings
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { ok, findings } = run();
    for (const reader of findings.unfiltered)
        console.error(
            `HELD-ROWS: ${reader.file}:${reader.line} (${reader.function}) reads payments.addonInstanceId without notHeldByPageChargeMark/heldByPageChargeMark and is not on ${ALLOWLIST_PATH}. A held page-charge row would pass as the purchase's payment.`
        );
    for (const entry of findings.stale)
        console.error(
            `HELD-ROWS: allowlist entry ${entry.file} (${entry.function}) matches no reader; remove it.`
        );
    for (const entry of findings.reasonless)
        console.error(
            `HELD-ROWS: allowlist entry ${entry.file} (${entry.function}) has no reason.`
        );
    if (ok)
        console.log(
            `HELD-ROWS: OK; ${findings.readers.length} reader(s) of payments.addonInstanceId, ${findings.readers.filter((r) => r.filtered).length} filtered, the rest allowlisted with a reason.`
        );
    process.exit(ok ? 0 : 1);
}
