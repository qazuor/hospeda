import { describe, expect, it } from 'bun:test';
import type { WorktreeEnv } from '../src/lib/worktree.ts';
import { extractWorktreeFlag, findWorktreeByName } from '../src/lib/wt-flag.ts';

/** Builds a worktree with sane defaults. */
function makeWorktree(overrides: Partial<WorktreeEnv> = {}): WorktreeEnv {
    return {
        name: 'hospeda-hos-1010-ventana-cortesia',
        path: '/home/dev/hospeda-hos-1010-ventana-cortesia',
        isMain: false,
        branch: 'fix/hos-1010',
        detached: false,
        database: 'worktree_hospeda_hos_1010',
        servers: [],
        ...overrides
    };
}

describe('extractWorktreeFlag', () => {
    it('should read both --wt=x and --wt x', () => {
        expect(extractWorktreeFlag({ argv: ['--wt=hos-1010'] }).name).toBe('hos-1010');
        expect(extractWorktreeFlag({ argv: ['--wt', 'hos-1010'] }).name).toBe('hos-1010');
    });

    it('should be absent when not given', () => {
        expect(extractWorktreeFlag({ argv: ['--refresh'] }).name).toBeNull();
    });

    it('should remove the flag and its value, passing the rest through', () => {
        // Everything else has to reach wt-up.sh untouched — it has its own flags.
        expect(extractWorktreeFlag({ argv: ['--wt', 'x', '--refresh'] }).rest).toEqual([
            '--refresh'
        ]);
        expect(extractWorktreeFlag({ argv: ['--wt=x', '--refresh'] }).rest).toEqual(['--refresh']);
    });
});

describe('findWorktreeByName', () => {
    const all = [
        makeWorktree({ name: 'hospeda2', path: '/main', isMain: true }),
        makeWorktree(),
        makeWorktree({ name: 'hospeda-hos-999-otra', path: '/otra' })
    ];

    it('should match the exact directory name', () => {
        expect(findWorktreeByName({ all, name: 'hospeda-hos-999-otra' })?.path).toBe('/otra');
    });

    it('should match the short form people actually type', () => {
        // Nobody types `hospeda-hos-1010-ventana-cortesia`.
        expect(findWorktreeByName({ all, name: 'hos-1010' })?.database).toBe(
            'worktree_hospeda_hos_1010'
        );
    });

    it('should be case-insensitive', () => {
        expect(findWorktreeByName({ all, name: 'HOS-1010' })).not.toBeNull();
    });

    it('should resolve "main" to the main clone', () => {
        expect(findWorktreeByName({ all, name: 'main' })?.path).toBe('/main');
    });

    it('should refuse an ambiguous prefix instead of picking one', () => {
        // `hos-` matches two. Guessing here operates on the wrong environment.
        expect(findWorktreeByName({ all, name: 'hos-' })).toBeNull();
    });

    it('should return null when nothing matches', () => {
        expect(findWorktreeByName({ all, name: 'no-existe' })).toBeNull();
    });
});
