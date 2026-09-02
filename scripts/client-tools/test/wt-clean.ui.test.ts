import { describe, expect, it } from 'bun:test';
import { parseArgs } from '../src/commands/wt-clean/args.ts';
import {
    formatInventoryNote,
    formatMarks,
    formatRiskWarning,
    formatSize,
    formatWorktreeDetail,
    formatWorktreeHeadline,
    formatWorktreeLabel
} from '../src/commands/wt-clean/format.ts';
import { buildRemoveArgs, orderForRemoval } from '../src/commands/wt-clean/remove.ts';
import {
    buildOptions,
    isConfirmed,
    partitionSelection
} from '../src/commands/wt-clean/selection.ts';
import type { WorktreeInfo } from '../src/commands/wt-clean/types.ts';

/** Strips ANSI colour codes so assertions read against plain text. */
function plain(text: string): string {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escapes is the point
    return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Builds a worktree with sane defaults, overridable per test. */
function makeWorktree(overrides: Partial<WorktreeInfo> = {}): WorktreeInfo {
    return {
        name: 'hospeda-hos-1-thing',
        path: '/home/dev/hospeda-hos-1-thing',
        isMain: false,
        isCurrent: false,
        branch: 'feat/HOS-1-thing',
        state: 'merged',
        ahead: 0,
        dirty: 0,
        unpushed: 0,
        mb: 500,
        lastRelative: '2 days ago',
        lastSubject: 'did a thing',
        ...overrides
    };
}

describe('parseArgs', () => {
    it('should fall back to the cwd when no path is given', () => {
        expect(parseArgs({ argv: [], cwd: '/here' }).repoPath).toBe('/here');
    });

    it('should take the first positional so an explicit path beats the wrapper', () => {
        // The fish wrapper appends the resolved repo AFTER the user's arguments,
        // so with two positionals the user's own path is the first one.
        expect(parseArgs({ argv: ['/explicit', '/from-wrapper'], cwd: '/here' }).repoPath).toBe(
            '/explicit'
        );
    });

    it('should still use the wrapper path when the user typed none', () => {
        expect(parseArgs({ argv: ['--no-disk', '/from-wrapper'], cwd: '/here' }).repoPath).toBe(
            '/from-wrapper'
        );
    });

    it('should measure disk usage unless --no-disk is passed', () => {
        expect(parseArgs({ argv: [], cwd: '/here' }).measureDisk).toBe(true);
        expect(parseArgs({ argv: ['--no-disk'], cwd: '/here' }).measureDisk).toBe(false);
    });

    it('should recognise both help flags', () => {
        expect(parseArgs({ argv: ['--help'], cwd: '/here' }).help).toBe(true);
        expect(parseArgs({ argv: ['-h'], cwd: '/here' }).help).toBe(true);
        expect(parseArgs({ argv: [], cwd: '/here' }).help).toBe(false);
    });

    it('should not mistake a flag for the repo path', () => {
        expect(parseArgs({ argv: ['--no-disk'], cwd: '/here' }).repoPath).toBe('/here');
    });
});

describe('formatSize', () => {
    it('should render an unmeasured size as a dash', () => {
        expect(formatSize({ mb: 0 })).toBe('—');
    });

    it('should render sub-gigabyte sizes in MB', () => {
        expect(formatSize({ mb: 820 })).toBe('820 MB');
    });

    it('should render a gigabyte or more in GB', () => {
        expect(formatSize({ mb: 1536 })).toBe('1.5 GB');
    });
});

describe('formatMarks', () => {
    it('should show no marks for a clean, fully pushed worktree', () => {
        expect(formatMarks({ worktree: makeWorktree() })).toEqual([]);
    });

    it('should distinguish "nunca pusheado" from "sin pushear"', () => {
        // Arrange — a null upstream means the branch was never pushed at all.
        const neverPushed = makeWorktree({ state: 'unmerged', ahead: 2, unpushed: null });
        const partiallyPushed = makeWorktree({ state: 'unmerged', ahead: 5, unpushed: 2 });

        // Act
        const never = formatMarks({ worktree: neverPushed }).map(plain);
        const partial = formatMarks({ worktree: partiallyPushed }).map(plain);

        // Assert
        expect(never).toContain('nunca pusheado');
        expect(partial).toContain('2 sin pushear');
        expect(partial).not.toContain('nunca pusheado');
    });

    it('should not claim unpushed commits when the branch is level with upstream', () => {
        // Arrange
        const worktree = makeWorktree({ state: 'unmerged', ahead: 3, unpushed: 0 });

        // Act
        const marks = formatMarks({ worktree }).map(plain);

        // Assert
        expect(marks).toEqual(['3 commits']);
    });

    it('should mark the worktree the tool is running from', () => {
        // Act
        const marks = formatMarks({ worktree: makeWorktree({ isCurrent: true }) }).map(plain);

        // Assert
        expect(marks).toContain('[estás acá]');
    });

    it('should mark the main clone so it is never mistaken for a worktree', () => {
        // Act
        const marks = formatMarks({ worktree: makeWorktree({ isMain: true }) }).map(plain);

        // Assert
        expect(marks).toContain('[clon principal]');
    });
});

describe('formatInventoryNote', () => {
    it('should not count the main clone as removable', () => {
        // Arrange
        const worktrees = [
            makeWorktree({ name: 'main', path: '/main', isMain: true, mb: 9000 }),
            makeWorktree({ name: 'other', mb: 1000 })
        ];

        // Act
        const text = plain(formatInventoryNote({ worktrees }));

        // Assert
        expect(text).toContain('1 borrables');
    });

    it('should not count a missing worktree as removable', () => {
        // Arrange — a stale registration cannot be torn down, only pruned.
        const worktrees = [
            makeWorktree({ name: 'gone', state: 'missing', mb: 0 }),
            makeWorktree({ name: 'other', mb: 1000 })
        ];

        // Act
        const text = plain(formatInventoryNote({ worktrees }));

        // Assert
        expect(text).toContain('1 borrables');
        expect(text).toContain('1 registro(s) fantasma');
    });

    it('should not count a protected worktree as removable', () => {
        // The inventory line and the picker have to agree: saying "2 borrables"
        // while offering one is the kind of small lie that erodes the whole
        // report.
        const worktrees = [
            makeWorktree({ name: 'hospeda-staging', branch: 'staging', mb: 254 }),
            makeWorktree({ name: 'otro', mb: 1000 })
        ];

        // Act
        const text = plain(formatInventoryNote({ worktrees }));

        // Assert
        expect(text).toContain('1 borrables');
    });

    it('should report only finished worktrees as reclaimable space', () => {
        // Arrange
        const worktrees = [
            makeWorktree({ name: 'done', state: 'merged', mb: 1024 }),
            makeWorktree({ name: 'busy', state: 'uncommitted', dirty: 1, mb: 4096 })
        ];

        // Act
        const text = plain(formatInventoryNote({ worktrees }));

        // Assert
        expect(text).toContain('1.0 GB en worktrees terminados');
        expect(text).toContain('5.0 GB ocupados');
    });
});

describe('formatRiskWarning', () => {
    it('should name every worktree at risk and what would be lost', () => {
        // Arrange
        const risky = [
            makeWorktree({ name: 'dirty-wt', state: 'uncommitted', dirty: 3 }),
            makeWorktree({ name: 'ahead-wt', state: 'unmerged', ahead: 2, unpushed: null })
        ];

        // Act
        const text = plain(formatRiskWarning({ risky }));

        // Assert
        expect(text).toContain('dirty-wt');
        expect(text).toContain('3 archivo(s) sin commitear');
        expect(text).toContain('ahead-wt');
        expect(text).toContain('2 commit(s) sobre la base');
        expect(text).toContain('nunca pusheados');
    });
});

describe('buildOptions', () => {
    it('should not offer the main clone', () => {
        // Arrange
        const worktrees = [
            makeWorktree({ name: 'main', path: '/main', isMain: true }),
            makeWorktree({ name: 'other', path: '/other' })
        ];

        // Act
        const options = buildOptions({ worktrees });

        // Assert
        expect(options.map((o) => o.value)).toEqual(['/other']);
    });

    it('should not offer a missing worktree, which prune handles instead', () => {
        // Arrange
        const worktrees = [
            makeWorktree({ name: 'gone', path: '/gone', state: 'missing' }),
            makeWorktree({ name: 'other', path: '/other' })
        ];

        // Act
        const options = buildOptions({ worktrees });

        // Assert
        expect(options.map((o) => o.value)).toEqual(['/other']);
    });

    it('should key each option by its absolute path', () => {
        // Act
        const [option] = buildOptions({ worktrees: [makeWorktree()] });

        // Assert
        expect(option?.value).toBe('/home/dev/hospeda-hos-1-thing');
    });

    it('should carry the branch and the age in the LABEL, not the hint', () => {
        // The hint is only drawn for the highlighted row, so anything you need
        // to compare across the list has to live in the label.
        const worktree = makeWorktree({ branch: 'fix/HOS-9-algo', lastRelative: '8 days ago' });

        // Act
        const [option] = buildOptions({ worktrees: [worktree] });

        // Assert
        expect(plain(option?.label ?? '')).toContain('fix/HOS-9-algo');
        expect(plain(option?.label ?? '')).toContain('8 days ago');
        expect(plain(option?.hint ?? '')).not.toContain('fix/HOS-9-algo');
    });

    it('should put the commit subject in the hint', () => {
        // Act
        const [option] = buildOptions({
            worktrees: [makeWorktree({ lastSubject: 'fix(web): algo puntual' })]
        });

        // Assert
        expect(option?.hint).toBe('fix(web): algo puntual');
    });

    it('should surface a name/branch mismatch in the label', () => {
        // Arrange — a recycled worktree keeps the directory name of its origin.
        const worktree = makeWorktree({
            name: 'hospeda-HOS-941-planes',
            branch: 'feat/HOS-985-otra-cosa'
        });

        // Act
        const [option] = buildOptions({ worktrees: [worktree] });

        // Assert
        expect(plain(option?.label ?? '')).toContain('el directorio dice HOS-941');
    });
});

describe('formatWorktreeLabel', () => {
    it('should render exactly two lines: headline and detail', () => {
        // Act
        const lines = formatWorktreeLabel({ worktree: makeWorktree() }).split('\n');

        // Assert
        expect(lines).toHaveLength(2);
        expect(plain(lines[0] ?? '')).toContain('hospeda-hos-1-thing');
        expect(plain(lines[1] ?? '')).toContain('feat/HOS-1-thing');
    });

    it('should indent the detail line under the name', () => {
        // Act
        const lines = formatWorktreeLabel({ worktree: makeWorktree() }).split('\n');

        // Assert
        expect(lines[1]?.startsWith('          ')).toBe(true);
    });

    it('should keep the headline free of the branch', () => {
        // The two lines carry different things; duplicating the branch on the
        // headline is what pushed it past a readable width.
        const headline = plain(formatWorktreeHeadline({ worktree: makeWorktree() }));

        // Assert
        expect(headline).not.toContain('feat/HOS-1-thing');
    });

    it('should show the age but not the commit subject in the detail line', () => {
        // Act
        const detail = plain(
            formatWorktreeDetail({
                worktree: makeWorktree({ lastRelative: '3 hours ago', lastSubject: 'un subject' })
            })
        );

        // Assert
        expect(detail).toContain('3 hours ago');
        expect(detail).not.toContain('un subject');
    });
});

describe('buildOptions · branches protegidas', () => {
    it('should never offer the staging checkout for deletion', () => {
        // It is where hops runs from and where the DB template is built, and it
        // classifies as "finished" by construction — so it would sort first.
        const worktrees = [
            makeWorktree({ name: 'hospeda-staging', path: '/staging', branch: 'staging' }),
            makeWorktree({ name: 'otro', path: '/otro' })
        ];

        // Act
        const options = buildOptions({ worktrees });

        // Assert
        expect(options.map((o) => o.value)).toEqual(['/otro']);
    });

    it('should never offer a worktree sitting on main', () => {
        const worktrees = [makeWorktree({ name: 'x', path: '/x', branch: 'main' })];

        expect(buildOptions({ worktrees })).toEqual([]);
    });

    it('should still offer a branch that merely mentions staging', () => {
        // `fix/staging-banner` is ordinary work, not the protected checkout.
        const worktrees = [makeWorktree({ path: '/x', branch: 'fix/staging-banner' })];

        expect(buildOptions({ worktrees }).map((o) => o.value)).toEqual(['/x']);
    });
});

describe('partitionSelection', () => {
    it('should separate the worktrees that need --force from the rest', () => {
        // Arrange
        const selected = [
            makeWorktree({ name: 'clean-1' }),
            makeWorktree({ name: 'dirty-1', state: 'uncommitted', dirty: 1 }),
            makeWorktree({ name: 'ahead-1', state: 'unmerged', ahead: 1 })
        ];

        // Act
        const { risky, safe } = partitionSelection({ selected });

        // Assert
        expect(risky.map((w) => w.name)).toEqual(['dirty-1', 'ahead-1']);
        expect(safe.map((w) => w.name)).toEqual(['clean-1']);
    });
});

describe('isConfirmed', () => {
    it('should accept the exact word regardless of case and padding', () => {
        expect(isConfirmed({ answer: 'borrar' })).toBe(true);
        expect(isConfirmed({ answer: '  BORRAR  ' })).toBe(true);
    });

    it('should reject an empty answer', () => {
        expect(isConfirmed({ answer: '' })).toBe(false);
        expect(isConfirmed({ answer: '   ' })).toBe(false);
    });

    it('should reject anything that is not the confirmation word', () => {
        expect(isConfirmed({ answer: 's' })).toBe(false);
        expect(isConfirmed({ answer: 'si' })).toBe(false);
        expect(isConfirmed({ answer: 'borra' })).toBe(false);
        expect(isConfirmed({ answer: 'borrar todo' })).toBe(false);
    });
});

describe('buildRemoveArgs', () => {
    it('should pass the worktree path to the teardown script', () => {
        // Act
        const { command, args } = buildRemoveArgs({
            scriptPath: '/home/dev/.claude/skills/worktree/scripts/wt-remove.sh',
            worktree: makeWorktree(),
            force: false
        });

        // Assert
        expect(command).toBe('bash');
        expect(args).toEqual([
            '/home/dev/.claude/skills/worktree/scripts/wt-remove.sh',
            '/home/dev/hospeda-hos-1-thing'
        ]);
    });

    it('should append --force only when asked', () => {
        // Act
        const { args } = buildRemoveArgs({
            scriptPath: '/script.sh',
            worktree: makeWorktree(),
            force: true
        });

        // Assert
        expect(args).toEqual(['/script.sh', '/home/dev/hospeda-hos-1-thing', '--force']);
    });
});

describe('orderForRemoval', () => {
    it('should remove the current worktree last so the shell survives the rest', () => {
        // Arrange
        const worktrees = [
            makeWorktree({ name: 'current', isCurrent: true }),
            makeWorktree({ name: 'other-a' }),
            makeWorktree({ name: 'other-b' })
        ];

        // Act
        const ordered = orderForRemoval({ worktrees });

        // Assert
        expect(ordered.at(-1)?.name).toBe('current');
    });

    it('should keep the relative order of the non-current worktrees', () => {
        // Arrange
        const worktrees = [
            makeWorktree({ name: 'first' }),
            makeWorktree({ name: 'current', isCurrent: true }),
            makeWorktree({ name: 'second' })
        ];

        // Act
        const ordered = orderForRemoval({ worktrees });

        // Assert
        expect(ordered.map((w) => w.name)).toEqual(['first', 'second', 'current']);
    });
});
