import { describe, expect, it } from 'bun:test';
import {
    classifyWorktree,
    isRisky,
    parseWorktreePaths,
    sortForCleanup,
    splitLastCommit
} from '../src/commands/wt-clean/inventory.ts';
import type { WorktreeInfo } from '../src/commands/wt-clean/types.ts';

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

describe('parseWorktreePaths', () => {
    it('should extract only the worktree paths from porcelain output', () => {
        // Arrange
        const porcelain = [
            'worktree /home/dev/hospeda',
            'HEAD abc123',
            'branch refs/heads/staging',
            '',
            'worktree /home/dev/hospeda-hos-1-thing',
            'HEAD def456',
            'branch refs/heads/feat/HOS-1-thing',
            ''
        ].join('\n');

        // Act
        const paths = parseWorktreePaths({ porcelain });

        // Assert
        expect(paths).toEqual(['/home/dev/hospeda', '/home/dev/hospeda-hos-1-thing']);
    });

    it('should preserve git order so the first entry is the main clone', () => {
        // Arrange
        const porcelain = 'worktree /main\nworktree /other\n';

        // Act
        const paths = parseWorktreePaths({ porcelain });

        // Assert
        expect(paths[0]).toBe('/main');
    });

    it('should not treat a branch line mentioning "worktree" as a path', () => {
        // Arrange — a branch literally named with the word does not start the line.
        const porcelain = 'worktree /main\nbranch refs/heads/feat/worktree-cleanup\n';

        // Act
        const paths = parseWorktreePaths({ porcelain });

        // Assert
        expect(paths).toEqual(['/main']);
    });

    it('should return an empty list for empty output', () => {
        // Arrange / Act
        const paths = parseWorktreePaths({ porcelain: '' });

        // Assert
        expect(paths).toEqual([]);
    });
});

describe('classifyWorktree', () => {
    it('should classify a clean worktree with no own commits as merged', () => {
        expect(classifyWorktree({ dirty: 0, ahead: 0 })).toBe('merged');
    });

    it('should classify own commits over the base as unmerged', () => {
        expect(classifyWorktree({ dirty: 0, ahead: 3 })).toBe('unmerged');
    });

    it('should let uncommitted changes outrank unmerged commits', () => {
        // Uncommitted work exists nowhere else, so it must win the classification.
        expect(classifyWorktree({ dirty: 2, ahead: 5 })).toBe('uncommitted');
    });
});

describe('isRisky', () => {
    it('should not flag a finished worktree', () => {
        expect(isRisky({ worktree: makeWorktree({ state: 'merged' }) })).toBe(false);
    });

    it('should flag a worktree with unmerged commits', () => {
        expect(isRisky({ worktree: makeWorktree({ state: 'unmerged', ahead: 2 }) })).toBe(true);
    });

    it('should flag a worktree with uncommitted changes', () => {
        expect(isRisky({ worktree: makeWorktree({ state: 'uncommitted', dirty: 4 }) })).toBe(true);
    });

    it('should not flag a missing worktree (there is nothing left to lose)', () => {
        expect(isRisky({ worktree: makeWorktree({ state: 'missing' }) })).toBe(false);
    });
});

describe('sortForCleanup', () => {
    it('should put the safest-to-delete state first', () => {
        // Arrange
        const worktrees = [
            makeWorktree({ name: 'dirty-one', state: 'uncommitted', dirty: 1 }),
            makeWorktree({ name: 'ahead-one', state: 'unmerged', ahead: 1 }),
            makeWorktree({ name: 'done-one', state: 'merged' })
        ];

        // Act
        const sorted = sortForCleanup({ worktrees });

        // Assert
        expect(sorted.map((w) => w.name)).toEqual(['done-one', 'ahead-one', 'dirty-one']);
    });

    it('should sink the main clone below other worktrees in the same state', () => {
        // Arrange — the main clone is bigger, so only the isMain rule can sink it.
        const worktrees = [
            makeWorktree({ name: 'main', isMain: true, mb: 9000 }),
            makeWorktree({ name: 'other', mb: 100 })
        ];

        // Act
        const sorted = sortForCleanup({ worktrees });

        // Assert
        expect(sorted.map((w) => w.name)).toEqual(['other', 'main']);
    });

    it('should order same-state worktrees by size, largest first', () => {
        // Arrange
        const worktrees = [
            makeWorktree({ name: 'small', mb: 100 }),
            makeWorktree({ name: 'huge', mb: 4000 }),
            makeWorktree({ name: 'medium', mb: 900 })
        ];

        // Act
        const sorted = sortForCleanup({ worktrees });

        // Assert
        expect(sorted.map((w) => w.name)).toEqual(['huge', 'medium', 'small']);
    });

    it('should not mutate the input array', () => {
        // Arrange
        const worktrees = [
            makeWorktree({ name: 'dirty-one', state: 'uncommitted' }),
            makeWorktree({ name: 'done-one', state: 'merged' })
        ];

        // Act
        sortForCleanup({ worktrees });

        // Assert
        expect(worktrees.map((w) => w.name)).toEqual(['dirty-one', 'done-one']);
    });
});

describe('splitLastCommit', () => {
    it('should split the relative date from the subject on the NUL byte', () => {
        // Act
        const parsed = splitLastCommit({ raw: '2 days ago\u0000fix(web): algo\n' });

        // Assert
        expect(parsed).toEqual({ lastRelative: '2 days ago', lastSubject: 'fix(web): algo' });
    });

    it('should not truncate a subject that contains an em dash', () => {
        // An em dash used to be the separator, which cut subjects at the
        // author's punctuation.
        const parsed = splitLastCommit({ raw: '3 hours ago\u0000fix: uno — y dos' });

        // Assert
        expect(parsed.lastSubject).toBe('fix: uno — y dos');
    });

    it('should dash out both fields when the log produced nothing', () => {
        expect(splitLastCommit({ raw: '' })).toEqual({ lastRelative: '—', lastSubject: '—' });
    });
});
