/**
 * Unit tests for the `contact_info` merge guard (HOS-1190).
 *
 * These pin the guard's PREDICATE, not the repository's current state: each one
 * feeds a synthetic tree or source string to the matcher and asserts the
 * verdict. The repo-wide run is the CI step; this is what stops the predicate
 * from silently becoming unable to fail.
 *
 * The "evasion" cases below are not hypothetical. An earlier revision of this
 * guard matched raw file text with a lazy regex and returned exit code 0 —
 * "All checks passed" — on the first three, while the model's own unit tests
 * were red at the same time.
 *
 * The DISCOVERY cases (a table written in a shape the scan did not recognise)
 * are equally measured, and they were the more dangerous half: an unseen table
 * does not merely go unchecked, it is invisible in the report, so the guard
 * announces that every column it found is protected and says nothing about the
 * one it lost. Each of those fixtures pairs the exotic table with a healthy,
 * fully-declared `gastronomies` — otherwise the old guard would have exited 1
 * anyway via its "found zero contact_info columns" branch and the fixture
 * would prove nothing.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    collectModelFiles,
    declaresContactInfoMergeable,
    findClassBodies,
    findContactInfoTables,
    findMatchingDelimiter,
    findOwningClassBodies,
    findOwningClassBody,
    findOwningModels,
    findStringRanges,
    findTableAliases,
    isInsideString,
    MIN_KNOWN_CONTACT_INFO_TABLES,
    REPO_ROOT,
    resolveConstArrayLiteral,
    run,
    stripComments,
    tableFloorViolation
} from '../check-mergeable-contact-info.js';

// ---------------------------------------------------------------------------
// Throwaway trees, so the fixtures cannot be confused with the real repo
// ---------------------------------------------------------------------------

const dirs: string[] = [];

afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Writes `files` into a temp repo rooted where the guard expects to walk. */
function makeTree(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'mci-'));
    dirs.push(root);
    for (const [rel, content] of Object.entries(files)) {
        const full = join(root, rel);
        mkdirSync(join(full, '..'), { recursive: true });
        writeFileSync(full, content, 'utf8');
    }
    return root;
}

const SCHEMA_PATH = 'packages/db/src/schemas/gastronomy/gastronomy.dbschema.ts';

/** A schema file carrying one `contact_info` JSONB column. */
const SCHEMA_SOURCE = `import { jsonb, pgTable, uuid } from 'drizzle-orm/pg-core';

export const gastronomies = pgTable('gastronomies', {
    id: uuid('id').primaryKey(),
    contactInfo: jsonb('contact_info').$type<ContactInfo>(),
    socialNetworks: jsonb('social_networks')
});
`;

/** Wraps a class body into a plausible model file. */
function modelFile(body: string, extra = ''): string {
    return `import { gastronomies } from '../../schemas/gastronomy/gastronomy.dbschema';
${extra}
export class GastronomyModel extends BaseModelImpl<Gastronomy> {
    protected table = gastronomies;
    public entityName = 'gastronomies';
${body}
}
`;
}

/** Runs the guard silently and returns its exit code plus everything it printed. */
function runQuiet(root: string): { code: number; output: string } {
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        lines.push(args.map(String).join(' '));
    });
    try {
        return { code: run(root), output: lines.join('\n') };
    } finally {
        spy.mockRestore();
    }
}

/** The declaration a healthy model carries. */
const DECLARED =
    "    protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;";

/**
 * A tree holding the healthy, declared `gastronomies` table PLUS one extra
 * table written in `extra`, with no model of its own.
 *
 * The healthy table is what makes the fixture bite: with it present the scan is
 * never empty, so a guard blind to `extra` reports "All checks passed" instead
 * of failing on its own zero-columns branch. Exit code 1 therefore means "the
 * extra table was discovered", not "the scan broke".
 */
function treeWithExtraTable(extra: string, extraPath: string = SCHEMA_PATH): string {
    const files: Record<string, string> = {
        'packages/db/src/models/gastronomy/gastronomy.model.ts': modelFile(DECLARED)
    };
    if (extraPath === SCHEMA_PATH) {
        files[SCHEMA_PATH] = `${SCHEMA_SOURCE}\n${extra}\n`;
    } else {
        files[SCHEMA_PATH] = SCHEMA_SOURCE;
        files[extraPath] = `import { jsonb, pgTable } from 'drizzle-orm/pg-core';\n\n${extra}\n`;
    }
    return makeTree(files);
}

// ---------------------------------------------------------------------------
// Source primitives
// ---------------------------------------------------------------------------

describe('findStringRanges / isInsideString', () => {
    it('covers the literal including its quotes, and nothing else', () => {
        const src = "const a = 'x'; const b = 2;";
        const ranges = findStringRanges(src);

        expect(ranges).toHaveLength(1);
        expect(isInsideString(ranges, src.indexOf('x'))).toBe(true);
        expect(isInsideString(ranges, src.indexOf('const b'))).toBe(false);
    });

    it('treats a template literal as a string too', () => {
        const src = 'const a = `mergeableJsonbColumns`;';
        expect(isInsideString(findStringRanges(src), src.indexOf('mergeable'))).toBe(true);
    });
});

describe('findTableAliases', () => {
    it('picks up an import alias and a module-level rebinding', () => {
        const src = `import { gastronomies as gastroTable } from './x';
const legacyTable = gastronomies;`;
        expect([...findTableAliases(src, 'gastronomies')].sort()).toEqual([
            'gastroTable',
            'gastronomies',
            'legacyTable'
        ]);
    });
});

describe('stripComments', () => {
    it('blanks a line comment but keeps the line and the offsets', () => {
        const src = "const a = 1; // 'contactInfo'\nconst b = 2;";
        const out = stripComments(src);

        expect(out).not.toContain('contactInfo');
        // Offsets are preserved, which is what keeps the `^\s*`-anchored
        // regexes meaning on the stripped copy what they meant on the file.
        expect(out).toHaveLength(src.length);
        expect(out.split('\n')[0]).toBe(
            'const a = 1;'.padEnd((src.split('\n')[0] as string).length, ' ')
        );
        expect(out.split('\n')[1]).toBe('const b = 2;');
    });

    it('blanks a block comment across lines, preserving the newlines', () => {
        const out = stripComments("/**\n * 'contactInfo'\n */\nconst a = 1;");
        expect(out).not.toContain('contactInfo');
        expect(out.split('\n')).toHaveLength(4);
        expect(out.split('\n')[3]).toBe('const a = 1;');
    });

    it('leaves string literals alone, including one that looks like a comment', () => {
        const src = "const url = 'https://example.com/*not a comment*/';";
        expect(stripComments(src)).toBe(src);
    });

    it('leaves the array items a declaration needs', () => {
        expect(stripComments("= ['contactInfo'] as const;")).toBe("= ['contactInfo'] as const;");
    });
});

describe('findMatchingDelimiter', () => {
    it('matches across a nested pair', () => {
        const src = 'x = [a, [b, c], d];';
        const open = src.indexOf('[');
        expect(findMatchingDelimiter(src, open, '[', ']')).toBe(src.lastIndexOf(']'));
    });

    it('is not unbalanced by a bracket inside a string', () => {
        const src = "x = ['a]b', 'c'];";
        const open = src.indexOf('[');
        expect(findMatchingDelimiter(src, open, '[', ']')).toBe(src.lastIndexOf(']'));
    });

    it('returns -1 when unterminated', () => {
        expect(findMatchingDelimiter('x = [a, b', 4, '[', ']')).toBe(-1);
    });
});

describe('findClassBodies', () => {
    it('separates two classes in the same file', () => {
        const src = stripComments(
            'class A { protected table = users; }\nclass B { protected table = gastronomies; }'
        );
        const bodies = findClassBodies(src);
        expect(bodies.map((c) => c.name)).toEqual(['A', 'B']);
        expect(bodies[1]?.body).toContain('gastronomies');
        expect(bodies[1]?.body).not.toContain('users');
    });
});

describe('findOwningClassBody', () => {
    it('returns the class that assigns the table, not a sibling', () => {
        const src = `class Other {
    protected table = users;
    protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;
}
class GastronomyModel {
    protected table = gastronomies;
}`;
        const owner = findOwningClassBody(src, 'gastronomies');
        expect(owner?.name).toBe('GastronomyModel');
        expect(declaresContactInfoMergeable(owner?.body ?? '')).toEqual({ kind: 'absent' });
    });
});

describe('resolveConstArrayLiteral', () => {
    it('reads a module-level array literal', () => {
        const src = "const SHARED = ['contactInfo', 'media'] as const;";
        expect(resolveConstArrayLiteral(src, 'SHARED')).toBe("['contactInfo', 'media']");
    });

    it('returns undefined when the constant is not an array literal here', () => {
        expect(resolveConstArrayLiteral("import { SHARED } from './shared';", 'SHARED')).toBe(
            undefined
        );
    });
});

// ---------------------------------------------------------------------------
// The verdict itself
// ---------------------------------------------------------------------------

describe('declaresContactInfoMergeable', () => {
    it('accepts the plain declaration', () => {
        const body = stripComments(
            "protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;"
        );
        expect(declaresContactInfoMergeable(body)).toEqual({ kind: 'declared' });
    });

    it('accepts the explicitly typed form', () => {
        const body = stripComments(
            "protected readonly mergeableJsonbColumns: readonly string[] = ['media', 'contactInfo'];"
        );
        expect(declaresContactInfoMergeable(body)).toEqual({ kind: 'declared' });
    });

    it('is NOT fooled by a JSDoc example sitting above the real declaration', () => {
        // `base.model.ts` ships exactly this example, ready to be copied. A lazy
        // `[\\s\\S]*?\\]` tail would read the EXAMPLE as the declaration and
        // report a healthy model as broken.
        const source = `/**
 * @example
 * protected override readonly mergeableJsonbColumns = ['media'] as const;
 */
protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;`;
        expect(declaresContactInfoMergeable(stripComments(source))).toEqual({ kind: 'declared' });
    });

    it('resolves a spread against a constant declared in the same module', () => {
        const module = stripComments(`const SHARED_CONTACT_MERGE = ['contactInfo'] as const;
class M {
    protected override readonly mergeableJsonbColumns = [...SHARED_CONTACT_MERGE] as const;
}`);
        const body = findClassBodies(module)[0]?.body ?? '';
        expect(declaresContactInfoMergeable(body, module)).toEqual({ kind: 'declared' });
    });

    it('reports a spread it cannot resolve as UNRESOLVED, never as declared', () => {
        const module = stripComments(`import { SHARED } from './shared';
class M {
    protected override readonly mergeableJsonbColumns = [...SHARED] as const;
}`);
        const body = findClassBodies(module)[0]?.body ?? '';
        const verdict = declaresContactInfoMergeable(body, module);
        expect(verdict.kind).toBe('unresolved');
    });

    it('reports a missing declaration as absent', () => {
        expect(declaresContactInfoMergeable('protected table = gastronomies;')).toEqual({
            kind: 'absent'
        });
    });
});

// ---------------------------------------------------------------------------
// End-to-end: the three evasions that used to return exit code 0
// ---------------------------------------------------------------------------

describe('run() — the healthy tree', () => {
    it('passes when the owning model declares the column', () => {
        const root = makeTree({
            [SCHEMA_PATH]: SCHEMA_SOURCE,
            'packages/db/src/models/gastronomy/gastronomy.model.ts': modelFile(
                "    protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;"
            )
        });

        const { code, output } = runQuiet(root);

        expect(code).toBe(0);
        expect(output).toContain('All checks passed');
    });

    it('passes when a JSDoc example precedes the real declaration', () => {
        const root = makeTree({
            [SCHEMA_PATH]: SCHEMA_SOURCE,
            'packages/db/src/models/gastronomy/gastronomy.model.ts': modelFile(
                `    /**
     * @example
     * protected override readonly mergeableJsonbColumns = ['media'] as const;
     */
    protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;`
            )
        });

        expect(runQuiet(root).code).toBe(0);
    });

    it('passes when the declaration spreads a constant from the same file', () => {
        const root = makeTree({
            [SCHEMA_PATH]: SCHEMA_SOURCE,
            'packages/db/src/models/gastronomy/gastronomy.model.ts': modelFile(
                '    protected override readonly mergeableJsonbColumns = [...SHARED_CONTACT_MERGE] as const;',
                "const SHARED_CONTACT_MERGE = ['contactInfo'] as const;"
            )
        });

        expect(runQuiet(root).code).toBe(0);
    });
});

describe('run() — evasion (a): the entry commented out inside the array', () => {
    it('fails, instead of reporting all checks passed', () => {
        const root = makeTree({
            [SCHEMA_PATH]: SCHEMA_SOURCE,
            'packages/db/src/models/gastronomy/gastronomy.model.ts': modelFile(
                `    protected override readonly mergeableJsonbColumns = [
        // 'contactInfo' — disabled while HOS-9999 is investigated
    ] as const;`
            )
        });

        const { code, output } = runQuiet(root);

        expect(code).toBe(1);
        expect(output).toContain("does not declare 'contactInfo'");
        expect(output).not.toContain('All checks passed');
    });

    it('fails for the block-comment spelling too', () => {
        const root = makeTree({
            [SCHEMA_PATH]: SCHEMA_SOURCE,
            'packages/db/src/models/gastronomy/gastronomy.model.ts': modelFile(
                "    protected override readonly mergeableJsonbColumns = [/* 'contactInfo' */] as const;"
            )
        });

        expect(runQuiet(root).code).toBe(1);
    });
});

describe('run() — evasion (b): the declaration exists only inside a JSDoc block', () => {
    it('fails, instead of accepting the prose as the declaration', () => {
        const root = makeTree({
            [SCHEMA_PATH]: SCHEMA_SOURCE,
            'packages/db/src/models/gastronomy/gastronomy.model.ts': modelFile(
                `    /**
     * This model used to carry
     * \`protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;\`
     * but the declaration itself is gone.
     */
    protected override readonly validRelationKeys = ['faqs'] as const;`
            )
        });

        const { code, output } = runQuiet(root);

        expect(code).toBe(1);
        expect(output).toContain("does not declare 'contactInfo'");
    });
});

describe('run() — evasion (c): two models over the same table', () => {
    it('fails when ANY of them is missing the declaration, whatever the filename order', () => {
        const declared =
            "    protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;";

        for (const missingFile of ['aGastronomyPublic.model.ts', 'zGastronomyPublic.model.ts']) {
            const otherFile =
                missingFile === 'aGastronomyPublic.model.ts'
                    ? 'zGastronomy.model.ts'
                    : 'aGastronomy.model.ts';
            const root = makeTree({
                [SCHEMA_PATH]: SCHEMA_SOURCE,
                [`packages/db/src/models/gastronomy/${missingFile}`]: modelFile(''),
                [`packages/db/src/models/gastronomy/${otherFile}`]: modelFile(declared)
            });

            const { code, output } = runQuiet(root);

            expect(code).toBe(1);
            expect(output).toContain(missingFile);
            expect(output).toContain('claimed by 2 model files');
        }
    });

    it('passes only when BOTH declare it', () => {
        const declared =
            "    protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;";
        const root = makeTree({
            [SCHEMA_PATH]: SCHEMA_SOURCE,
            'packages/db/src/models/gastronomy/aGastronomy.model.ts': modelFile(declared),
            'packages/db/src/models/gastronomy/zGastronomy.model.ts': modelFile(declared)
        });

        expect(runQuiet(root).code).toBe(0);
    });
});

describe('run() — the remaining failure modes', () => {
    it('fails when no model owns the table, with a fix that matches THAT reason', () => {
        const root = makeTree({ [SCHEMA_PATH]: SCHEMA_SOURCE });

        const { code, output } = runQuiet(root);

        expect(code).toBe(1);
        expect(output).toContain('no model file assigns');
        // The remediation must not tell the reader to edit a model that does
        // not exist — the message may not claim more than its predicate.
        expect(output).toContain('unreachable through any model');
        expect(output).not.toContain('following packages/db/src/models/partner/partner.model.ts');
    });

    it('fails when a sibling class in the same file holds the declaration', () => {
        const root = makeTree({
            [SCHEMA_PATH]: SCHEMA_SOURCE,
            'packages/db/src/models/gastronomy/gastronomy.model.ts': `import { gastronomies, users } from '../../schemas';

export class UserModel extends BaseModelImpl<User> {
    protected table = users;
    protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;
}

export class GastronomyModel extends BaseModelImpl<Gastronomy> {
    protected table = gastronomies;
}
`
        });

        expect(runQuiet(root).code).toBe(1);
    });

    it('fails when the declaration spreads something it cannot read', () => {
        const root = makeTree({
            [SCHEMA_PATH]: SCHEMA_SOURCE,
            'packages/db/src/models/gastronomy/gastronomy.model.ts': modelFile(
                '    protected override readonly mergeableJsonbColumns = [...SHARED_CONTACT_MERGE] as const;',
                "import { SHARED_CONTACT_MERGE } from './shared';"
            )
        });

        const { code, output } = runQuiet(root);

        expect(code).toBe(1);
        expect(output).toContain('cannot read it');
    });

    it('fails loudly when the schema scan finds nothing at all', () => {
        const root = makeTree({ 'packages/db/src/schemas/.keep': '' });

        const { code, output } = runQuiet(root);

        expect(code).toBe(1);
        expect(output).toContain('found zero contact_info columns');
    });

    it('does not discover a column that is itself commented out', () => {
        const root = makeTree({
            [SCHEMA_PATH]: `export const gastronomies = pgTable('gastronomies', {
    // contactInfo: jsonb('contact_info'),
    id: uuid('id')
});
`
        });

        expect(findContactInfoTables(root)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Discovery: the table shapes the `^export const X = pgTable(` scan lost
// ---------------------------------------------------------------------------

describe('run() — discovery of tables written in unusual shapes', () => {
    const shapes: ReadonlyArray<readonly [string, string, string]> = [
        [
            'written on ONE line',
            "export const venues = pgTable('venues', { contactInfo: jsonb('contact_info') });",
            SCHEMA_PATH
        ],
        [
            'declared with an explicit type annotation',
            `export const venues: PgTableWithColumns<VenuesShape> = pgTable('venues', {
    contactInfo: jsonb('contact_info')
});`,
            SCHEMA_PATH
        ],
        [
            'with the `pgTable(` call spread over several lines',
            `export const venues = pgTable(
    'venues',
    {
        contactInfo: jsonb('contact_info')
    }
);`,
            SCHEMA_PATH
        ],
        [
            'with the assignment itself split across lines before `pgTable(`',
            `export const venues =
    pgTable('venues', {
        contactInfo: jsonb('contact_info')
    });`,
            SCHEMA_PATH
        ],
        [
            'using double quotes for the column name',
            `export const venues = pgTable("venues", {
    contactInfo: jsonb("contact_info")
});`,
            SCHEMA_PATH
        ],
        [
            'declared and exported in two separate statements',
            `const venues = pgTable('venues', {
    contactInfo: jsonb('contact_info')
});
export { venues };`,
            SCHEMA_PATH
        ],
        [
            'living in a file NOT named `*.dbschema.ts`',
            `export const venues = pgTable('venues', {
    contactInfo: jsonb('contact_info')
});`,
            'packages/db/src/schemas/venue/venue.schema.ts'
        ]
    ];

    for (const [label, extra, path] of shapes) {
        it(`sees a table ${label}`, () => {
            const root = treeWithExtraTable(extra, path);

            const { code, output } = runQuiet(root);

            // The table has no model at all, so being SEEN is exactly what
            // makes this fail. A guard blind to the shape prints the healthy
            // `gastronomies` and calls it a day.
            expect(code).toBe(1);
            expect(output).toContain('venues');
            expect(output).not.toContain('All checks passed');
        });
    }

    it('attributes a separately-exported table to ITSELF, not to the table above it', () => {
        // Worse than invisible: the slice-between-`export const`s scan handed
        // this table's column to its predecessor, so the report showed
        // `gastronomies` twice and `venues` never.
        const root = treeWithExtraTable(`const venues = pgTable('venues', {
    contactInfo: jsonb('contact_info')
});
export { venues };`);

        expect(
            findContactInfoTables(root)
                .map((t) => t.tableVar)
                .sort()
        ).toEqual(['gastronomies', 'venues']);
    });

    it('reports a column it cannot attribute to a table as a VIOLATION, not a skip', () => {
        // Columns hoisted into a shared object and spread into `pgTable` sit
        // outside every table span. "I cannot tell" is not "safe".
        const root = treeWithExtraTable(`const venueColumns = {
    contactInfo: jsonb('contact_info')
};

export const venues = pgTable('venues', { ...venueColumns });`);

        const { code, output } = runQuiet(root);

        expect(code).toBe(1);
        expect(output).toContain('could not be attributed');
        expect(output).not.toContain('All checks passed');
    });

    it('reports a column with no readable property key rather than looking away', () => {
        const root = treeWithExtraTable(`export const venues = pgTable('venues', {
    ...{ [dynamicKey]: jsonb('contact_info') }
});`);

        const { code, output } = runQuiet(root);

        expect(code).toBe(1);
        expect(output).toContain('could not be attributed');
    });
});

describe('tableFloorViolation', () => {
    it('flags a repo-root scan that lost one of the known tables', () => {
        expect(tableFloorViolation(REPO_ROOT, 3)).toContain('guard regression');
    });

    it('is silent at the known count', () => {
        expect(tableFloorViolation(REPO_ROOT, MIN_KNOWN_CONTACT_INFO_TABLES)).toBe(undefined);
    });

    it('does not apply to a synthetic tree, which legitimately holds one table', () => {
        expect(tableFloorViolation(makeTree({}), 1)).toBe(undefined);
    });
});

// ---------------------------------------------------------------------------
// Declaration side: the evasions left after round 1
// ---------------------------------------------------------------------------

describe('run() — evasion (d): the declaration exists only inside a STRING literal', () => {
    it('fails, instead of accepting quoted prose as the declaration', () => {
        // Round 1 taught `stripComments` to blank comments while PRESERVING
        // strings — it has to, the guard reads `'contactInfo'`. That moved the
        // "it only lives in prose" evasion from a comment into a string.
        const root = makeTree({
            [SCHEMA_PATH]: SCHEMA_SOURCE,
            'packages/db/src/models/gastronomy/gastronomy.model.ts': modelFile(
                `    private readonly legacyNote =
        "protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;";`
            )
        });

        const { code, output } = runQuiet(root);

        expect(code).toBe(1);
        expect(output).toContain("does not declare 'contactInfo'");
    });
});

describe('run() — evasion (e): an owning model that imports the table under an ALIAS', () => {
    it('recognises it as an owner, so its missing declaration is not invisible', () => {
        // One declaring owner is enough for the table to pass, so an
        // unrecognised second owner does not merely go unchecked — it vanishes
        // from the report while the run goes green.
        const root = makeTree({
            [SCHEMA_PATH]: SCHEMA_SOURCE,
            'packages/db/src/models/gastronomy/gastronomy.model.ts': modelFile(DECLARED),
            'packages/db/src/models/gastronomy/gastronomyRead.model.ts': `import { gastronomies as gastroTable } from '../../schemas/gastronomy/gastronomy.dbschema';

export class GastronomyReadModel extends BaseModelImpl<Gastronomy> {
    protected table = gastroTable;
    public entityName = 'gastronomies';
}
`
        });

        const { code, output } = runQuiet(root);

        expect(code).toBe(1);
        expect(output).toContain('GastronomyReadModel');
    });
});

describe('run() — evasion (f): two owning CLASSES in the same file', () => {
    const declaredClass = `export class GastronomyModel extends BaseModelImpl<Gastronomy> {
    protected table = gastronomies;
${DECLARED}
}`;
    const undeclaredClass = `export class GastronomyPublicModel extends BaseModelImpl<Gastronomy> {
    protected table = gastronomies;
}`;

    // Round 1 fixed the order dependence BETWEEN files; `findOwningClassBody`
    // still used `.find()`, so the same bug survived one granularity down.
    it.each([
        ['declared first', `${declaredClass}\n\n${undeclaredClass}\n`],
        ['undeclared first', `${undeclaredClass}\n\n${declaredClass}\n`]
    ])('fails with the %s, so class order cannot decide the verdict', (_label, body) => {
        const root = makeTree({
            [SCHEMA_PATH]: SCHEMA_SOURCE,
            'packages/db/src/models/gastronomy/gastronomy.model.ts': `import { gastronomies } from '../../schemas/gastronomy/gastronomy.dbschema';

${body}`
        });

        const { code, output } = runQuiet(root);

        expect(code).toBe(1);
        expect(output).toContain('GastronomyPublicModel');
    });

    it('passes when both classes declare it', () => {
        const root = makeTree({
            [SCHEMA_PATH]: SCHEMA_SOURCE,
            'packages/db/src/models/gastronomy/gastronomy.model.ts': `import { gastronomies } from '../../schemas/gastronomy/gastronomy.dbschema';

${declaredClass}

export class GastronomyPublicModel extends BaseModelImpl<Gastronomy> {
    protected table = gastronomies;
${DECLARED}
}
`
        });

        expect(runQuiet(root).code).toBe(0);
    });

    it('findOwningClassBodies returns BOTH, where findOwningClassBody returns one', () => {
        const source = `${declaredClass}\n\n${undeclaredClass}\n`;

        expect(findOwningClassBodies(source, 'gastronomies').map((c) => c.name)).toEqual([
            'GastronomyModel',
            'GastronomyPublicModel'
        ]);
        expect(findOwningClassBody(source, 'gastronomies')?.name).toBe('GastronomyModel');
    });
});

// ---------------------------------------------------------------------------
// The repository itself
// ---------------------------------------------------------------------------

describe('the repository itself', () => {
    it('has every contact_info column declared mergeable by its model', () => {
        expect(runQuiet(REPO_ROOT).code).toBe(0);
    });

    it('finds the seven known contact_info tables', () => {
        expect(
            findContactInfoTables(REPO_ROOT)
                .map((t) => t.tableVar)
                .sort()
        ).toEqual([
            'accommodations',
            'eventOrganizers',
            'experiences',
            'gastronomies',
            'partners',
            'postSponsors',
            'users'
        ]);
    });

    it('resolves exactly one owning model per table today', () => {
        const modelFiles = collectModelFiles(REPO_ROOT);
        for (const table of findContactInfoTables(REPO_ROOT)) {
            expect(findOwningModels(REPO_ROOT, modelFiles, table.tableVar)).toHaveLength(1);
        }
    });
});
