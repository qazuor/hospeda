/**
 * Unit tests for the `contact_info` merge guard (HOS-1190).
 *
 * These pin the guard's PREDICATE, not the repository's current state: each one
 * feeds a synthetic tree or source string to the matcher and asserts the
 * verdict. The repo-wide run is the CI step; this is what stops the predicate
 * from silently becoming unable to fail.
 *
 * The three "evasion" cases below are not hypothetical. An earlier revision of
 * this guard matched raw file text with a lazy regex and returned exit code 0
 * — "All checks passed" — on all three, while the model's own unit tests were
 * red at the same time.
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
    findOwningClassBody,
    findOwningModels,
    REPO_ROOT,
    resolveConstArrayLiteral,
    run,
    stripComments
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

// ---------------------------------------------------------------------------
// Source primitives
// ---------------------------------------------------------------------------

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
