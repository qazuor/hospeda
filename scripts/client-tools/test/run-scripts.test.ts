import { describe, expect, it } from 'bun:test';
import {
    dangerOf,
    findScripts,
    type RepoScript,
    searchScripts
} from '../src/commands/run/scripts.ts';
import { ownRepoRoot } from '../src/lib/repo.ts';

function makeScript(overrides: Partial<RepoScript> = {}): RepoScript {
    return {
        id: 'lint',
        packageName: 'hospeda',
        dir: '.',
        script: 'lint',
        command: 'turbo run lint',
        ...overrides
    };
}

describe('findScripts', () => {
    it('should find scripts in the ROOT package.json', async () => {
        // The previous CLI expanded the workspace globs and never opened the
        // root package.json, leaving 43 scripts — the twenty CI guards among
        // them — impossible to discover.
        const scripts = await findScripts({ repoRoot: ownRepoRoot() });
        const ids = scripts.map((script) => script.id);

        expect(ids).toContain('check:guards');
        expect(ids).toContain('env:doctor');
        expect(ids).toContain('db:apply-extras');
    }, 30_000);

    it('should prefix scripts of workspace packages', async () => {
        const scripts = await findScripts({ repoRoot: ownRepoRoot() });
        const ids = scripts.map((script) => script.id);

        expect(ids.some((id) => id.startsWith('web:'))).toBe(true);
        expect(ids.some((id) => id.startsWith('db:'))).toBe(true);
    }, 30_000);

    it('should hide npm lifecycle hooks', async () => {
        const scripts = await findScripts({ repoRoot: ownRepoRoot() });

        expect(scripts.map((script) => script.id)).not.toContain('prepare');
    }, 30_000);

    it('should carry the package name pnpm filters on', async () => {
        const scripts = await findScripts({ repoRoot: ownRepoRoot() });
        const webScript = scripts.find((script) => script.dir === 'apps/web');

        expect(webScript?.packageName).toBe('hospeda-web');
    }, 30_000);
});

describe('dangerOf', () => {
    it('should flag a volume wipe by what it DOES, not what it is called', () => {
        // `db:fresh-dev` is dangerous because it runs `compose down -v`, which
        // wipes every worktree database, not because of its name.
        const script = makeScript({
            id: 'db:fresh-dev',
            command: 'docker compose down -v && pnpm db:push && pnpm db:seed'
        });

        expect(dangerOf({ script })).toContain('volumen');
    });

    it('should flag a schema push', () => {
        const script = makeScript({ id: 'db:push', command: 'drizzle-kit push' });

        expect(dangerOf({ script })).not.toBeNull();
    });

    it('should leave an ordinary script alone', () => {
        expect(dangerOf({ script: makeScript() })).toBeNull();
    });

    it('should not flag a script merely because its name sounds scary', () => {
        // `clean` here only removes build output.
        const script = makeScript({ id: 'clean', command: 'turbo run clean' });

        expect(dangerOf({ script })).toBeNull();
    });
});

describe('searchScripts', () => {
    const scripts = [
        makeScript({ id: 'lint' }),
        makeScript({ id: 'lint:md' }),
        makeScript({ id: 'web:lint', command: 'astro check' }),
        makeScript({ id: 'test', command: 'vitest run --lint-nothing' })
    ];

    it('should rank an exact match first', () => {
        expect(searchScripts({ scripts, query: 'lint' })[0]?.id).toBe('lint');
    });

    it('should rank a prefix above a substring', () => {
        const ids = searchScripts({ scripts, query: 'lint' }).map((script) => script.id);

        expect(ids.indexOf('lint:md')).toBeLessThan(ids.indexOf('web:lint'));
    });

    it('should match on the command as a last resort', () => {
        const ids = searchScripts({ scripts, query: 'vitest' }).map((script) => script.id);

        expect(ids).toEqual(['test']);
    });

    it('should return everything for an empty query', () => {
        expect(searchScripts({ scripts, query: '' })).toHaveLength(scripts.length);
    });

    it('should return nothing when nothing matches', () => {
        expect(searchScripts({ scripts, query: 'zzzz' })).toEqual([]);
    });
});
