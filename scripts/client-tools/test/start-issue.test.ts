import { describe, expect, it } from 'bun:test';
import {
    buildSlug,
    deriveBranchType,
    extractWorktreePath,
    normalizeIssueId,
    slugifyTitle
} from '../src/commands/start-issue/derive.ts';
import { parseStartIssueArgs } from '../src/commands/start-issue/start-issue.ts';

describe('normalizeIssueId', () => {
    it('should accept the forms people actually paste', () => {
        expect(normalizeIssueId({ raw: '273' })).toBe('HOS-273');
        expect(normalizeIssueId({ raw: 'hos-273' })).toBe('HOS-273');
        expect(normalizeIssueId({ raw: 'HOS-273' })).toBe('HOS-273');
        expect(normalizeIssueId({ raw: '#273' })).toBe('HOS-273');
        expect(normalizeIssueId({ raw: '  273  ' })).toBe('HOS-273');
    });

    it('should keep a team prefix that is not HOS', () => {
        // BETA-96 is a real team in this workspace, not a typo to be corrected.
        expect(normalizeIssueId({ raw: 'beta-96' })).toBe('BETA-96');
    });

    it('should reject anything without a number', () => {
        expect(normalizeIssueId({ raw: 'HOS-' })).toBeNull();
        expect(normalizeIssueId({ raw: 'improve search' })).toBeNull();
        expect(normalizeIssueId({ raw: '' })).toBeNull();
    });
});

describe('deriveBranchType', () => {
    it('should default to feat when no label says otherwise', () => {
        expect(deriveBranchType({ labels: [] })).toBe('feat');
        expect(deriveBranchType({ labels: ['area-web', 'source-owner'] })).toBe('feat');
    });

    it('should map a bug label to fix', () => {
        expect(deriveBranchType({ labels: ['Bug'] })).toBe('fix');
        expect(deriveBranchType({ labels: ['type-bug'] })).toBe('fix');
    });

    it('should map an improvement label to refactor', () => {
        expect(deriveBranchType({ labels: ['Improvement'] })).toBe('refactor');
        expect(deriveBranchType({ labels: ['type-improvement'] })).toBe('refactor');
    });

    it('should not be fooled by a label that merely contains the word', () => {
        // `debug-tooling` contains "bug" but is not a bug label.
        expect(deriveBranchType({ labels: ['debug-tooling'] })).toBe('feat');
    });
});

describe('slugifyTitle', () => {
    it('should kebab-case a plain title', () => {
        expect(slugifyTitle({ title: 'Improve search filters' })).toBe('improve-search-filters');
    });

    it('should fold accents instead of dropping the letters', () => {
        // Dropping them would turn "café" into "caf" and lose Spanish words.
        expect(slugifyTitle({ title: 'Página de cortesía' })).toBe('pagina-de-cortesia');
    });

    it('should collapse punctuation and trim the edges', () => {
        expect(slugifyTitle({ title: '  ¡Arreglar el checkout (MP)!  ' })).toBe(
            'arreglar-el-checkout-mp'
        );
    });

    it('should truncate at a word boundary, not mid-word', () => {
        // A real case: HOS-1008's title used to yield `...no-tiene-pantall`.
        const slug = slugifyTitle({
            title: 'El checkout de commerce no tiene pantalla de confirmacion del email'
        });

        expect(slug).toBe('el-checkout-de-commerce-no-tiene');
        expect(slug.split('-').at(-1)).not.toBe('pantall');
    });

    it('should keep a single over-long word truncated rather than drop it', () => {
        const slug = slugifyTitle({
            title: 'Supercalifragilisticoexpialidosoyalgomasparapasarellimite'
        });

        expect(slug.length).toBe(40);
    });

    it('should never end in a dash after truncation', () => {
        const slug = slugifyTitle({
            title: 'Una descripcion larguisima que seguro se corta justo en un espacio aca'
        });
        expect(slug.endsWith('-')).toBe(false);
        expect(slug.length).toBeLessThanOrEqual(40);
    });

    it('should return empty when nothing survives', () => {
        expect(slugifyTitle({ title: '???' })).toBe('');
    });
});

describe('buildSlug', () => {
    it('should lead with the issue number so worktrees stay greppable', () => {
        expect(buildSlug({ issueId: 'HOS-273', title: 'Improve search filters' })).toBe(
            'hos-273-improve-search-filters'
        );
    });

    it('should fall back to the bare issue id when the title yields nothing', () => {
        expect(buildSlug({ issueId: 'HOS-273', title: '???' })).toBe('hos-273');
    });
});

describe('extractWorktreePath', () => {
    it('should read the path from a fresh create', () => {
        const output =
            'Creating worktree at: /x\ninstalling…\nDONE → /home/dev/hospeda-hos-273-algo\n';
        expect(extractWorktreePath({ output })).toBe('/home/dev/hospeda-hos-273-algo');
    });

    it('should read the path from a reused worktree', () => {
        const output = [
            "EXISTS: worktree for branch 'feat/hos-273-algo' already present — use it:",
            '/home/dev/hospeda-hos-273-algo  abc1234 [feat/hos-273-algo]'
        ].join('\n');
        expect(extractWorktreePath({ output })).toBe('/home/dev/hospeda-hos-273-algo');
    });

    it('should accept an ASCII arrow as well as the unicode one', () => {
        expect(extractWorktreePath({ output: 'DONE -> /home/dev/wt\n' })).toBe('/home/dev/wt');
    });

    it('should return null when the script said neither', () => {
        expect(extractWorktreePath({ output: 'Not in a git repo\n' })).toBeNull();
    });

    it('should not mistake a relative-looking token for a path', () => {
        const output = 'EXISTS: worktree for branch already present — use it:\nnot-a-path here\n';
        expect(extractWorktreePath({ output })).toBeNull();
    });
});

describe('parseStartIssueArgs', () => {
    it('should take the issue and an explicit branch type', () => {
        const opts = parseStartIssueArgs({ argv: ['273', 'fix'] });
        expect(opts.issueArg).toBe('273');
        expect(opts.type).toBe('fix');
    });

    it('should ignore a second positional that is not a branch type', () => {
        // Otherwise a typo silently becomes the branch prefix.
        expect(parseStartIssueArgs({ argv: ['273', 'fixx'] }).type).toBeNull();
    });

    it('should launch Claude with /startIssue by default', () => {
        const opts = parseStartIssueArgs({ argv: ['273'] });
        expect(opts.launchClaude).toBe(true);
        expect(opts.withStartIssue).toBe(true);
    });

    it('should honour --bare and --no-claude', () => {
        expect(parseStartIssueArgs({ argv: ['273', '--bare'] }).withStartIssue).toBe(false);
        expect(parseStartIssueArgs({ argv: ['273', '--no-claude'] }).launchClaude).toBe(false);
    });

    it('should default dryRun to false so a normal run actually creates', () => {
        expect(parseStartIssueArgs({ argv: ['273'] }).dryRun).toBe(false);
        expect(parseStartIssueArgs({ argv: ['273', '--dry-run'] }).dryRun).toBe(true);
    });

    it('should report a missing issue argument rather than inventing one', () => {
        expect(parseStartIssueArgs({ argv: [] }).issueArg).toBeNull();
        expect(parseStartIssueArgs({ argv: ['--bare'] }).issueArg).toBeNull();
    });
});
