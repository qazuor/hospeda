/**
 * @file email-components-scanner.ts
 * @description Source scanner behind the email components guard (HOS-2565 D6).
 *
 * It parses a `.ts` / `.tsx` file with the TypeScript compiler API (not a regex, so
 * comments, strings and JSX do not fool it) and reports:
 *
 *   - `border-left`   a `borderLeft`, `borderLeftWidth`, `borderLeftColor` or
 *     `borderLeftStyle` style property, or the kebab-case spelling (rule 1);
 *   - `react-email-button`  anything that brings `Button` in from
 *     `@react-email/components` (or `@react-email/button`) (rule 2): a named import,
 *     `<ns>.Button` on a namespace import, `export { Button } from`, `export * from`,
 *     `export * as ns from`, `require(...)` and `import(...)` calls (the last three
 *     fail on ANY occurrence, since they cannot be narrowed to `Button`);
 *   - `hex-background`  a `backgroundColor` whose value is a hex literal (rule 3).
 *
 * Besides the violations it returns every style declaration of `borderLeft` and
 * `backgroundColor` whatever its value, so the guard can tell a stale allowlist
 * entry (no such style left) from a live one (rule 4).
 *
 * Each finding carries the `owner` of the style: the nearest enclosing property,
 * variable, function or method name (for example `warningBox` in
 * `styles = { warningBox: { ... } }`, or `severityStyle` for a style built inside
 * that function). The allowlist is keyed by `<file>#<owner>`.
 */

import ts from 'typescript';

/** Style property an allowlist entry exempts (the `border-left*` keys all count as `borderLeft`). */
export type EmailStyleProperty = 'borderLeft' | 'backgroundColor';

/** Kinds of violation the scanner reports. */
export type EmailComponentsRule = 'border-left' | 'react-email-button' | 'hex-background';

/** One violation, with its position so the guard can name the file and line. */
export interface EmailComponentsFinding {
    readonly rule: EmailComponentsRule;
    readonly line: number;
    readonly owner: string;
    /** The offending value, for the failure message. */
    readonly detail: string;
}

/** A `borderLeft` or `backgroundColor` declaration, whatever its value. */
export interface EmailStyleDeclaration {
    readonly property: EmailStyleProperty;
    readonly line: number;
    readonly owner: string;
}

/** What {@link scanEmailSource} returns for one file. */
export interface EmailSourceScan {
    readonly findings: readonly EmailComponentsFinding[];
    readonly declarations: readonly EmailStyleDeclaration[];
}

const REACT_EMAIL_MODULES: ReadonlySet<string> = new Set([
    '@react-email/components',
    '@react-email/button'
]);

/** Every longhand and shorthand that draws the left edge. */
const BORDER_LEFT_KEYS: ReadonlySet<string> = new Set([
    'borderLeft',
    'borderLeftWidth',
    'borderLeftColor',
    'borderLeftStyle'
]);

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Name of a property key when it is an identifier or a string literal, else `null`. */
function propertyName({ name }: { readonly name: ts.PropertyName }): string | null {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
        return name.text;
    }
    return null;
}

/** Normalizes `border-left` / `background-color` keys to their camelCase spelling. */
function normalizeStyleKey({ key }: { readonly key: string }): string {
    return key.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/** Nearest enclosing named construct, or `<top-level>` when there is none. */
function ownerOf({ node }: { readonly node: ts.Node }): string {
    let current: ts.Node | undefined = node.parent;
    while (current) {
        if (ts.isPropertyAssignment(current)) {
            const name = propertyName({ name: current.name });
            if (name) return name;
        }
        if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
            return current.name.text;
        }
        if (
            (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current)) &&
            current.name
        ) {
            return current.name.getText();
        }
        current = current.parent;
    }
    return '<top-level>';
}

/** String value of a literal initializer, or `null` for anything computed. */
function literalValue({ node }: { readonly node: ts.Expression }): string | null {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return node.text;
    }
    return null;
}

/**
 * Scans one source file for the email component rules.
 *
 * @param input - `fileName` (decides TS vs TSX parsing) and the file `source`.
 * @returns The violations and every `borderLeft` / `backgroundColor` declaration.
 *
 * @example
 * ```ts
 * scanEmailSource({ fileName: 'x.tsx', source: "const s = { box: { borderLeft: '4px solid red' } };" });
 * // findings: [{ rule: 'border-left', line: 1, owner: 'box', detail: '4px solid red' }]
 * ```
 */
export function scanEmailSource({
    fileName,
    source
}: {
    readonly fileName: string;
    readonly source: string;
}): EmailSourceScan {
    const sourceFile = ts.createSourceFile(
        fileName,
        source,
        ts.ScriptTarget.Latest,
        true,
        fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const findings: EmailComponentsFinding[] = [];
    const declarations: EmailStyleDeclaration[] = [];
    const reactEmailNamespaces = new Set<string>();

    const lineOf = (node: ts.Node): number =>
        sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

    const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            if (REACT_EMAIL_MODULES.has(node.moduleSpecifier.text)) {
                const bindings = node.importClause?.namedBindings;
                if (bindings && ts.isNamedImports(bindings)) {
                    for (const element of bindings.elements) {
                        const imported = (element.propertyName ?? element.name).text;
                        if (imported === 'Button') {
                            findings.push({
                                rule: 'react-email-button',
                                line: lineOf(element),
                                owner: '<import>',
                                detail: element.getText(sourceFile)
                            });
                        }
                    }
                }
                if (bindings && ts.isNamespaceImport(bindings)) {
                    reactEmailNamespaces.add(bindings.name.text);
                }
            }
        }

        if (
            ts.isExportDeclaration(node) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier) &&
            REACT_EMAIL_MODULES.has(node.moduleSpecifier.text)
        ) {
            const clause = node.exportClause;
            if (!clause || ts.isNamespaceExport(clause)) {
                findings.push({
                    rule: 'react-email-button',
                    line: lineOf(node),
                    owner: '<export>',
                    detail: node.getText(sourceFile)
                });
            } else {
                for (const element of clause.elements) {
                    if ((element.propertyName ?? element.name).text === 'Button') {
                        findings.push({
                            rule: 'react-email-button',
                            line: lineOf(element),
                            owner: '<export>',
                            detail: node.getText(sourceFile)
                        });
                    }
                }
            }
        }

        if (ts.isCallExpression(node)) {
            const [argument] = node.arguments;
            const isRequire =
                ts.isIdentifier(node.expression) && node.expression.text === 'require';
            const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
            if (
                (isRequire || isDynamicImport) &&
                argument &&
                (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) &&
                REACT_EMAIL_MODULES.has(argument.text)
            ) {
                findings.push({
                    rule: 'react-email-button',
                    line: lineOf(node),
                    owner: '<call>',
                    detail: node.getText(sourceFile)
                });
            }
        }

        if (
            ts.isPropertyAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            reactEmailNamespaces.has(node.expression.text) &&
            node.name.text === 'Button'
        ) {
            findings.push({
                rule: 'react-email-button',
                line: lineOf(node),
                owner: '<namespace>',
                detail: node.getText(sourceFile)
            });
        }

        if (ts.isPropertyAssignment(node)) {
            const rawKey = propertyName({ name: node.name });
            const key = rawKey === null ? null : normalizeStyleKey({ key: rawKey });
            if (key !== null && BORDER_LEFT_KEYS.has(key)) {
                const owner = ownerOf({ node });
                declarations.push({ property: 'borderLeft', line: lineOf(node), owner });
                findings.push({
                    rule: 'border-left',
                    line: lineOf(node),
                    owner,
                    detail:
                        literalValue({ node: node.initializer }) ??
                        node.initializer.getText(sourceFile)
                });
            }
            if (key === 'backgroundColor') {
                const owner = ownerOf({ node });
                declarations.push({ property: 'backgroundColor', line: lineOf(node), owner });
                const value = literalValue({ node: node.initializer });
                if (value !== null && HEX_COLOR.test(value.trim())) {
                    findings.push({
                        rule: 'hex-background',
                        line: lineOf(node),
                        owner,
                        detail: value
                    });
                }
            }
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return { findings, declarations };
}

/**
 * A style that is deliberately NOT a callout (HOS-2565 D6).
 */
export interface CardAllowlistEntry {
    /** Path relative to `packages/`. */
    readonly file: string;
    /** Owner of the style: the style object key, or the function that builds it. */
    readonly style: string;
    /** The one property this entry exempts. A second property on the same owner is NOT covered. */
    readonly property: EmailStyleProperty;
    /** Why this is a card or staff chrome and not a callout. */
    readonly reason: string;
}

/** Input of {@link evaluateEmailComponents}. */
export interface EvaluateEmailComponentsInput {
    /** Scan result per `packages/`-relative file. */
    readonly scans: ReadonlyMap<string, EmailSourceScan>;
    /** Frozen card allowlist. */
    readonly allowlist: readonly CardAllowlistEntry[];
    /** The one file allowed to import `Button` from react-email. */
    readonly sharedButtonFile: string;
    /** The one file allowed to draw the callout border. */
    readonly sharedCalloutFile: string;
    /** Whether an allowlisted file still exists on disk. */
    readonly fileExists: (file: string) => boolean;
}

/** Violations per rule, each message naming the file and line. */
export interface EmailComponentsVerdict {
    readonly borderLeft: readonly string[];
    readonly reactEmailButton: readonly string[];
    readonly hexBackground: readonly string[];
    readonly staleAllowlist: readonly string[];
}

/**
 * Applies guard rules 1 to 4 to a set of scans. Pure, so the fixtures test can run it
 * on fabricated files and prove each rule fails (AC-2.4) before the real tree is trusted.
 *
 * @param input - Scans, allowlist and the two shared-component file names.
 * @returns The violations of each rule.
 */
export function evaluateEmailComponents(
    input: EvaluateEmailComponentsInput
): EmailComponentsVerdict {
    const { scans, allowlist, sharedButtonFile, sharedCalloutFile, fileExists } = input;
    const isAllowlisted = (file: string, owner: string, property: EmailStyleProperty): boolean =>
        allowlist.some(
            (entry) => entry.file === file && entry.style === owner && entry.property === property
        );

    const borderLeft: string[] = [];
    const reactEmailButton: string[] = [];
    const hexBackground: string[] = [];
    for (const [file, scan] of scans) {
        for (const finding of scan.findings) {
            if (finding.rule === 'border-left' && file !== sharedCalloutFile) {
                if (!isAllowlisted(file, finding.owner, 'borderLeft')) {
                    borderLeft.push(
                        `${file}:${finding.line} borderLeft in "${finding.owner}" (${finding.detail})`
                    );
                }
            }
            if (finding.rule === 'react-email-button' && file !== sharedButtonFile) {
                reactEmailButton.push(`${file}:${finding.line} ${finding.detail}`);
            }
            if (
                finding.rule === 'hex-background' &&
                !isAllowlisted(file, finding.owner, 'backgroundColor')
            ) {
                hexBackground.push(
                    `${file}:${finding.line} backgroundColor ${finding.detail} in "${finding.owner}"`
                );
            }
        }
    }
    const staleAllowlist = allowlist
        .filter(
            (entry) =>
                !fileExists(entry.file) ||
                !scans
                    .get(entry.file)
                    ?.declarations.some(
                        (declaration) =>
                            declaration.owner === entry.style &&
                            declaration.property === entry.property
                    )
        )
        .map((entry) => `${entry.file}#${entry.style}.${entry.property}`);

    return { borderLeft, reactEmailButton, hexBackground, staleAllowlist };
}
