/**
 * @fileoverview
 * TEST:V1:4 (AC:V1:3): GUARD:G3 is green over the branch, and red on purpose
 * when production code uses a key that is not in the catalog: through the
 * catalog enums or the catalog accessors. Synthetic allowlist cases remain
 * covered while the production allowlist is empty.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ALLOWLIST, parseEnumMembers, run } from '../check-catalog-key-usage.js';

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes `files` (repo-relative path → content) into a fresh git tree. */
function makeTree({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g3-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return root;
}

const ENTITLEMENT_ENUM = `export enum EntitlementKeyEnum {
    /** Owner entitlements {@link X} */
    PUBLISH_ACCOMMODATIONS = 'publish_accommodations',
    READ_REVIEWS = 'read_reviews'
}
`;
const LIMIT_ENUM = `export enum LimitKeyEnum {
    MAX_ACCOMMODATIONS = 'max_accommodations'
}
`;

/** A green tree: catalog enums and a consumer that only uses catalog keys. */
const GREEN: Readonly<Record<string, string>> = {
    'packages/schemas/src/catalog/key-enums.ts': `${ENTITLEMENT_ENUM}${LIMIT_ENUM}`,
    'apps/api/src/gate.ts':
        "import { EntitlementKeyEnum, LimitKeyEnum } from '@repo/schemas';\nexport const keys = [EntitlementKeyEnum.PUBLISH_ACCOMMODATIONS, LimitKeyEnum.MAX_ACCOMMODATIONS];\n",
    // Tests and comments are not scanned.
    'apps/api/test/gate.test.ts': 'export const t = EntitlementKeyEnum.READ_REVIEWS;\n',
    'apps/api/src/note.ts':
        '// EntitlementKeyEnum.READ_REVIEWS used to live here\nexport const n = 1;\n'
};

const CATALOG = ['publish_accommodations', 'max_accommodations'];

function guardOver({
    overrides = {},
    allowlist = {}
}: {
    readonly overrides?: Readonly<Record<string, string>>;
    readonly allowlist?: Readonly<Record<string, Readonly<Record<string, string>>>>;
} = {}) {
    return run({
        root: makeTree({ files: { ...GREEN, ...overrides } }),
        minScannedFiles: 0,
        catalogKeys: CATALOG,
        allowlist
    });
}

describe('TEST:V1:4 TEST:1626:4 — GUARD:G3', () => {
    it('is green over the branch', () => {
        const result = run();

        expect(result.output).toContain('use only catalog keys');
        expect(result.exitCode).toBe(0);
    });

    it('is green over a tree that uses only catalog keys', () => {
        expect(guardOver().exitCode).toBe(0);
    });

    it.each([
        [
            'a member whose value is not in the catalog',
            'export const k = EntitlementKeyEnum.NOT_IN_CATALOG;\n',
            'NOT_IN_CATALOG'
        ],
        [
            'a member the enum does not declare',
            'export const k = LimitKeyEnum.MAX_UNICORNS;\n',
            'LimitKeyEnum.MAX_UNICORNS'
        ],
        [
            'the catalog asked for a key it lacks',
            "export const ok = isCatalogKey({ key: 'brand_new_key' });\n",
            'brand_new_key'
        ]
    ])('mutation: %s is red, naming the file and the line', (_label, source, key) => {
        const enumSource = `${ENTITLEMENT_ENUM.replace("    READ_REVIEWS = 'read_reviews'", "    READ_REVIEWS = 'read_reviews',\n    NOT_IN_CATALOG = 'not_in_catalog'")}${LIMIT_ENUM}`;
        const result = guardOver({
            overrides: {
                'packages/schemas/src/catalog/key-enums.ts': enumSource,
                'apps/web/src/new.ts': `\n${source}`
            }
        });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            'FAIL G3: production code uses a key that is not in the key catalog'
        );
        expect(result.output).toContain('apps/web/src/new.ts:2');
        expect(result.output).toContain(
            'Seen forms only: catalog enum members (EntitlementKeyEnum.X / LimitKeyEnum.X)'
        );
        expect(result.output).toContain(key);
    });

    it('keeps the allowlisted use green, but only in its exact file', () => {
        const allowlist = { 'apps/web/src/rows.ts': { read_reviews: 'HOS-1626' } };
        const use = 'export const k = EntitlementKeyEnum.READ_REVIEWS;\n';

        expect(guardOver({ overrides: { 'apps/web/src/rows.ts': use }, allowlist }).exitCode).toBe(
            0
        );

        const elsewhere = guardOver({
            overrides: { 'apps/web/src/rows.ts': use, 'apps/web/src/other.ts': use },
            allowlist
        });
        expect(elsewhere.exitCode).toBe(1);
        expect(elsewhere.output).toContain('apps/web/src/other.ts:1');
    });

    it('fails on a stale allowlist entry that no longer matches any use', () => {
        const result = guardOver({
            allowlist: { 'apps/web/src/rows.ts': { read_reviews: 'HOS-1626' } }
        });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('an allowlist entry no longer matches any use');
        expect(result.output).toContain("apps/web/src/rows.ts: 'read_reviews'");
    });

    it('keeps no exception now that read_reviews is in the catalog', () => {
        expect(ALLOWLIST).toEqual({});
    });

    it('refuses to run when it cannot read the catalog enums', () => {
        const result = run({
            root: makeTree({ files: { 'apps/api/src/a.ts': 'export const a = 1;\n' } }),
            minScannedFiles: 0,
            catalogKeys: CATALOG,
            allowlist: {}
        });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('could not read catalog enum EntitlementKeyEnum');
    });

    it('parses enum members past a JSDoc that contains braces', () => {
        expect([
            ...parseEnumMembers({
                source: ENTITLEMENT_ENUM,
                enumName: 'EntitlementKeyEnum'
            }).values()
        ]).toEqual(['publish_accommodations', 'read_reviews']);
    });
});

describe('G3 wiring', () => {
    it('runs as its own step of the guards job and inside check:guards', () => {
        const root = path.resolve(import.meta.dirname, '../..');
        const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
        const ci = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');

        expect(pkg.scripts['check:catalog-key-usage']).toBe(
            'tsx scripts/check-catalog-key-usage.ts'
        );
        expect(pkg.scripts['check:guards']).toContain('pnpm check:catalog-key-usage');
        expect(ci).toMatch(/run: pnpm check:catalog-key-usage/);
    });
});
