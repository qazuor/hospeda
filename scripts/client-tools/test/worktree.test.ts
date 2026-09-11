import { describe, expect, it } from 'bun:test';
import { isProtectedBranch } from '../src/commands/wt-clean/selection.ts';
import { worktreesWithServers } from '../src/lib/context.ts';
import {
    buildWorktrees,
    type DbConfig,
    databaseFor,
    parseWorktreePorcelain,
    type WorktreeEnv
} from '../src/lib/worktree.ts';

const DB_CONFIG: DbConfig = {
    devDb: 'hospeda_dev',
    templateDb: 'hospeda_template',
    container: 'hospeda-postgres',
    user: 'hospeda_user',
    connStringTemplate: 'postgresql://u:p@localhost:5436/{dbname}',
    connStringEnvVar: 'HOSPEDA_DATABASE_URL'
};

/** Builds a worktree with sane defaults. */
function makeWorktree(overrides: Partial<WorktreeEnv> = {}): WorktreeEnv {
    return {
        name: 'hospeda-hos-1-thing',
        path: '/home/dev/hospeda-hos-1-thing',
        isMain: false,
        branch: 'feat/HOS-1-thing',
        detached: false,
        database: 'worktree_hospeda_hos_1_thing',
        servers: [],
        ...overrides
    };
}

describe('parseWorktreePorcelain', () => {
    const PORCELAIN = [
        'worktree /home/dev/hospeda2',
        'HEAD abc123',
        'branch refs/heads/staging',
        '',
        'worktree /home/dev/hospeda-hos-1-thing',
        'HEAD def456',
        'branch refs/heads/feat/HOS-1-thing',
        '',
        'worktree /home/dev/hospeda-suelto',
        'HEAD 999aaa',
        'detached',
        ''
    ].join('\n');

    it('should read the branch git already prints, without the refs prefix', () => {
        // This is the fix for the real bug: the branch used to come from an
        // OPTIONAL state file, so a worktree created by hand had none and the
        // placeholder reached `gh pr list --head '(desconocida)'`.
        expect(parseWorktreePorcelain({ stdout: PORCELAIN }).map((w) => w.branch)).toEqual([
            'staging',
            'feat/HOS-1-thing',
            ''
        ]);
    });

    it('should mark a detached HEAD instead of naming a branch that is not one', () => {
        const parsed = parseWorktreePorcelain({ stdout: PORCELAIN });

        expect(parsed.map((w) => w.detached)).toEqual([false, false, true]);
    });

    it('should attribute each branch to its own record', () => {
        // Filtering lines instead of splitting records is how a branch ends up
        // credited to the wrong worktree.
        const parsed = parseWorktreePorcelain({ stdout: PORCELAIN });

        expect(parsed.map((w) => [w.path, w.branch])).toEqual([
            ['/home/dev/hospeda2', 'staging'],
            ['/home/dev/hospeda-hos-1-thing', 'feat/HOS-1-thing'],
            ['/home/dev/hospeda-suelto', '']
        ]);
    });

    it('should not carry a branch over into a record that has none', () => {
        const parsed = parseWorktreePorcelain({
            stdout: 'worktree /a\nbranch refs/heads/uno\n\nworktree /b\nHEAD zzz\n'
        });

        expect(parsed.map((w) => w.branch)).toEqual(['uno', '']);
    });

    it('should survive output with no trailing blank line', () => {
        expect(
            parseWorktreePorcelain({ stdout: 'worktree /a\nHEAD z\nbranch refs/heads/solo' })
        ).toEqual([{ path: '/a', branch: 'solo', detached: false }]);
    });

    it('should return nothing for empty output rather than a phantom worktree', () => {
        expect(parseWorktreePorcelain({ stdout: '' })).toEqual([]);
    });

});

describe('buildWorktrees', () => {
    const NO_STATE_FILE = () => ({});

    it('should keep a state-file-less staging worktree protected from wt-clean', () => {
        // The real one: /home/qazuor/projects/WEBS/hospeda-staging sits on
        // `staging` and has no state file, because it was not made by the
        // creation script. While the branch came from that file it resolved to
        // '(desconocida)', which is not in PROTECTED_BRANCHES — so wt-clean
        // OFFERED it for deletion, and deleting it tears down servers, the
        // database, the worktree and the branch. It is also the clone `hops
        // update` moves the hops home into.
        const [staging] = buildWorktrees({
            entries: [{ path: '/home/dev/hospeda-staging', branch: 'staging', detached: false }],
            readStateFor: NO_STATE_FILE
        });

        expect(staging?.branch).toBe('staging');
        expect(isProtectedBranch({ branch: staging?.branch ?? '' })).toBe(true);
    });

    it('should prefer git over a state file that disagrees', () => {
        // The state file records the branch at CREATION time. A worktree
        // switched since would otherwise report the old name with full
        // confidence.
        const [worktree] = buildWorktrees({
            entries: [{ path: '/home/dev/w', branch: 'fix/lo-nuevo', detached: false }],
            readStateFor: () => ({ branch: 'fix/lo-viejo' })
        });

        expect(worktree?.branch).toBe('fix/lo-nuevo');
    });

    it('should fall back to the state file only when git names no branch', () => {
        const [worktree] = buildWorktrees({
            entries: [{ path: '/home/dev/w', branch: '', detached: true }],
            readStateFor: () => ({ branch: 'fix/lo-viejo' })
        });

        expect({ branch: worktree?.branch, detached: worktree?.detached }).toEqual({
            branch: 'fix/lo-viejo',
            detached: true
        });
    });

    it('should leave the branch empty when neither source knows it', () => {
        // Empty, never a placeholder: '(desconocida)' is a string that travels
        // into `gh pr list --head` and comes back as "no hay PR".
        const [worktree] = buildWorktrees({
            entries: [{ path: '/home/dev/w', branch: '', detached: true }],
            readStateFor: NO_STATE_FILE
        });

        expect(worktree?.branch).toBe('');
    });

    it('should mark only git’s first entry as the main clone', () => {
        const built = buildWorktrees({
            entries: [
                { path: '/home/dev/hospeda2', branch: 'staging', detached: false },
                { path: '/home/dev/hospeda-uno', branch: 'fix/uno', detached: false }
            ],
            readStateFor: NO_STATE_FILE
        });

        expect(built.map((w) => w.isMain)).toEqual([true, false]);
    });
});

describe('databaseFor', () => {
    it('should give the main clone the shared development database', () => {
        const worktree = makeWorktree({ name: 'hospeda2', isMain: true, database: null });

        expect(databaseFor({ worktree, dbConfig: DB_CONFIG })).toBe('hospeda_dev');
    });

    it('should ignore a stale db recorded on the main clone', () => {
        // The main clone has no per-worktree database. If one ever got written
        // into its state file, using it would point migrations somewhere else.
        const worktree = makeWorktree({ isMain: true, database: 'worktree_bogus' });

        expect(databaseFor({ worktree, dbConfig: DB_CONFIG })).toBe('hospeda_dev');
    });

    it('should give a worktree the database recorded in its state', () => {
        expect(databaseFor({ worktree: makeWorktree(), dbConfig: DB_CONFIG })).toBe(
            'worktree_hospeda_hos_1_thing'
        );
    });

    it('should return null for a worktree with no database yet', () => {
        const worktree = makeWorktree({ database: null });

        expect(databaseFor({ worktree, dbConfig: DB_CONFIG })).toBeNull();
    });

    it('should not invent a database when the project config is missing', () => {
        const worktree = makeWorktree({ isMain: true, database: null });

        expect(databaseFor({ worktree, dbConfig: null })).toBeNull();
    });
});

describe('worktreesWithServers', () => {
    it('should list only the worktrees actually running something', () => {
        // This is what stops `db-stop` from silently killing six environments.
        const all = [
            makeWorktree({ name: 'idle' }),
            makeWorktree({
                name: 'busy',
                servers: [{ name: 'api', port: 3101, pid: 10 }]
            })
        ];

        const found = worktreesWithServers({
            context: {
                target: 'local',
                repoRoot: '/repo',
                worktree: null,
                all,
                dbConfig: DB_CONFIG,
                database: null,
                requestedWorktree: null
            }
        });

        expect(found.map((worktree) => worktree.name)).toEqual(['busy']);
    });

    it('should return nothing when every worktree is stopped', () => {
        const found = worktreesWithServers({
            context: {
                target: 'local',
                repoRoot: '/repo',
                worktree: null,
                all: [makeWorktree(), makeWorktree({ name: 'otro' })],
                dbConfig: DB_CONFIG,
                database: null,
                requestedWorktree: null
            }
        });

        expect(found).toEqual([]);
    });
});
