import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    CUTOFF_DERIVATION_REFS,
    CUTOFF_FILE_PATH,
    type CutoffDeps,
    deriveCutoffSha,
    GATE_WORKFLOW_PATH,
    parseCutoffFile,
    pickIntroducingCommit,
    readCutoffOverrideSha,
    resolveCutoff
} from '../src/commands/whats-new/cutoff.ts';

const REPO_ROOT = join(import.meta.dir, '..', '..', '..');
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

/** Deps where the derivation answers and no override is pinned. */
function makeDeps(overrides: Partial<CutoffDeps> = {}): CutoffDeps {
    return {
        readOverride: () => null,
        derive: async () => SHA_A,
        ...overrides
    };
}

describe('parseCutoffFile', () => {
    it('should return null for a file with only comments', () => {
        expect(parseCutoffFile({ content: '# a comment\n# another\n' })).toBeNull();
    });

    it('should return null for an empty file', () => {
        expect(parseCutoffFile({ content: '' })).toBeNull();
    });

    it('should return the first non-comment, non-blank line', () => {
        expect(parseCutoffFile({ content: '# header\n\nabc123def456\n# trailing\n' })).toBe(
            'abc123def456'
        );
    });

    it('should trim surrounding whitespace on the SHA line', () => {
        expect(parseCutoffFile({ content: '  abc123  \n' })).toBe('abc123');
    });

    it('should ignore blank lines between comments and the value', () => {
        expect(parseCutoffFile({ content: '\n\n# c\n\nsha-value\n' })).toBe('sha-value');
    });
});

describe('readCutoffOverrideSha', () => {
    it('should return null when the file does not exist at the given root', () => {
        expect(readCutoffOverrideSha({ repoRoot: '/definitely/not/a/real/path/xyz' })).toBeNull();
    });

    it('should read null (no override pinned) from the real repo file today', () => {
        // The committed state is deliberately empty: the cutoff is derived
        // (D-6), and this file only exists as an escape hatch.
        const path = join(REPO_ROOT, CUTOFF_FILE_PATH);
        expect(existsSync(path)).toBe(true);
        expect(readCutoffOverrideSha({ repoRoot: REPO_ROOT })).toBeNull();
    });

    it('should have the real file readable as UTF-8 text (sanity check on the fixture path)', () => {
        const path = join(REPO_ROOT, CUTOFF_FILE_PATH);
        const content = readFileSync(path, 'utf8');
        expect(content.length).toBeGreaterThan(0);
    });
});

describe('pickIntroducingCommit', () => {
    it('should return null for empty output', () => {
        expect(pickIntroducingCommit({ stdout: '' })).toBeNull();
        expect(pickIntroducingCommit({ stdout: '\n  \n' })).toBeNull();
    });

    it('should return the only SHA when there is one', () => {
        expect(pickIntroducingCommit({ stdout: `${SHA_A}\n` })).toBe(SHA_A);
    });

    it('should return the LAST line — git log reports newest-first, and the cutoff is the FIRST add', () => {
        // A path deleted and re-added has two `A` commits. "Since the rule
        // exists" means the first time it existed, not the latest re-add.
        expect(pickIntroducingCommit({ stdout: `${SHA_B}\n${SHA_A}\n` })).toBe(SHA_A);
    });
});

describe('deriveCutoffSha', () => {
    it("should derive this repo's own gate workflow from real git history", async () => {
        const sha = await deriveCutoffSha({ cwd: REPO_ROOT });

        // This is the guard against the derivation quietly answering nothing:
        // the workflow IS in this repo's history, so a null here means either
        // the git invocation is wrong or the path moved without this test
        // being updated.
        expect(sha).not.toBeNull();
        expect(sha).toMatch(/^[0-9a-f]{40}$/);
    });

    it('should return null for a path no commit ever added (the renamed-workflow case)', async () => {
        const sha = await deriveCutoffSha({
            cwd: REPO_ROOT,
            path: '.github/workflows/this-workflow-never-existed-xyz.yml'
        });

        expect(sha).toBeNull();
    });

    it('should try every configured ref before giving up', async () => {
        expect(CUTOFF_DERIVATION_REFS.length).toBeGreaterThan(1);
        expect(CUTOFF_DERIVATION_REFS[0]).toBe('HEAD');
    });
});

describe('resolveCutoff', () => {
    it('should prefer a pinned override over the derivation', async () => {
        const resolution = await resolveCutoff({
            repoRoot: '/repo',
            cwd: '/repo',
            deps: makeDeps({ readOverride: () => SHA_B })
        });

        expect(resolution).toEqual({ kind: 'override', sha: SHA_B });
    });

    it('should derive when no override is pinned', async () => {
        const resolution = await resolveCutoff({
            repoRoot: '/repo',
            cwd: '/repo',
            deps: makeDeps()
        });

        expect(resolution).toEqual({ kind: 'derived', sha: SHA_A });
    });

    it('should NOT derive at all when an override is pinned', async () => {
        let derived = 0;
        await resolveCutoff({
            repoRoot: '/repo',
            cwd: '/repo',
            deps: makeDeps({
                readOverride: () => SHA_B,
                derive: async () => {
                    derived += 1;
                    return SHA_A;
                }
            })
        });

        expect(derived).toBe(0);
    });

    // --- The fail-open guard: a silent empty derivation must NOT read as "no cutoff" ---
    it('should return an explicit underivable state, never a silent null, when nothing derives', async () => {
        const resolution = await resolveCutoff({
            repoRoot: '/repo',
            cwd: '/repo',
            deps: makeDeps({ derive: async () => null })
        });

        expect(resolution.kind).toBe('underivable');
        if (resolution.kind === 'underivable') {
            // The message must name the path it looked for and both remedies —
            // "no cutoff configured" alone sends nobody anywhere.
            expect(resolution.reason).toContain(GATE_WORKFLOW_PATH);
            expect(resolution.reason).toContain(CUTOFF_FILE_PATH);
        }
        expect('sha' in resolution).toBe(false);
    });
});
