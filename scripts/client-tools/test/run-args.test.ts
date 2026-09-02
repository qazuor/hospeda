import { describe, expect, it } from 'bun:test';
import { buildPnpmArgs, parseRunArgs } from '../src/commands/run/args.ts';
import type { RepoScript } from '../src/commands/run/scripts.ts';
import { splitPassthrough } from '../src/lib/passthrough.ts';

describe('splitPassthrough', () => {
    it('should return everything as ours when there is no separator', () => {
        const result = splitPassthrough({ argv: ['db:seed:migrate', '--list'] });

        expect(result).toEqual({ own: ['db:seed:migrate', '--list'], passthrough: [] });
    });

    it('should hand everything after the first -- to the inner program', () => {
        const result = splitPassthrough({
            argv: ['db:seed:migrate', '--', '--status', '--verbose']
        });

        expect(result).toEqual({
            own: ['db:seed:migrate'],
            passthrough: ['--status', '--verbose']
        });
    });

    it('should not treat a second -- as a second boundary', () => {
        // A nested command line (`hops run x -- pnpm foo -- --bar`) must arrive
        // at the script exactly as it was typed.
        const result = splitPassthrough({ argv: ['x', '--', 'pnpm', 'foo', '--', '--bar'] });

        expect(result.passthrough).toEqual(['pnpm', 'foo', '--', '--bar']);
    });

    it('should yield an empty passthrough for a trailing separator', () => {
        const result = splitPassthrough({ argv: ['x', '--'] });

        expect(result).toEqual({ own: ['x'], passthrough: [] });
    });
});

describe('parseRunArgs', () => {
    it('should read the first bare word as the query', () => {
        expect(parseRunArgs({ argv: ['db:seed:migrate'] })).toEqual({
            query: 'db:seed:migrate',
            list: false,
            unrecognized: []
        });
    });

    it('should understand --list on its own', () => {
        expect(parseRunArgs({ argv: ['--list'] })).toEqual({
            query: undefined,
            list: true,
            unrecognized: []
        });
    });

    /**
     * The regression this whole contract exists for. `--status` used to be
     * dropped and the command ran anyway: on 2026-08-15 that applied ten
     * pending data-migrations that were only meant to be listed.
     */
    it('should refuse an unknown flag instead of dropping it', () => {
        const result = parseRunArgs({ argv: ['db:seed:migrate', '--status'] });

        expect(result.unrecognized).toEqual(['--status']);
        expect(result.query).toBe('db:seed:migrate');
    });

    it('should collect every unknown flag, not just the first', () => {
        const result = parseRunArgs({ argv: ['test', '--watch', '--coverage'] });

        expect(result.unrecognized).toEqual(['--watch', '--coverage']);
    });

    it('should refuse a second positional rather than guess which one is the script', () => {
        const result = parseRunArgs({ argv: ['db:seed:migrate', 'prod'] });

        expect(result).toEqual({
            query: 'db:seed:migrate',
            list: false,
            unrecognized: ['prod']
        });
    });

    it('should refuse a flag even when it is the only argument', () => {
        expect(parseRunArgs({ argv: ['--status'] })).toEqual({
            query: undefined,
            list: false,
            unrecognized: ['--status']
        });
    });
});

/** Builds a script fixture. */
function script(overrides: Partial<RepoScript> = {}): RepoScript {
    return {
        id: 'db:seed:migrate',
        packageName: 'hospeda',
        dir: '.',
        script: 'db:seed:migrate',
        command: 'pnpm --filter @repo/seed seed --data-migrate',
        ...overrides
    };
}

describe('buildPnpmArgs', () => {
    it('should run a root script with nothing appended when there is no passthrough', () => {
        expect(buildPnpmArgs({ script: script(), passthrough: [] })).toEqual([
            'run',
            'db:seed:migrate'
        ]);
    });

    it('should separate forwarded arguments with -- so pnpm does not claim them', () => {
        expect(buildPnpmArgs({ script: script(), passthrough: ['--status'] })).toEqual([
            'run',
            'db:seed:migrate',
            '--',
            '--status'
        ]);
    });

    it('should forward through --filter for a script that lives in a package', () => {
        const result = buildPnpmArgs({
            script: script({ dir: 'packages/seed', packageName: '@repo/seed', script: 'seed' }),
            passthrough: ['--allow-destructive']
        });

        expect(result).toEqual([
            '--filter',
            '@repo/seed',
            'run',
            'seed',
            '--',
            '--allow-destructive'
        ]);
    });

    it('should keep the forwarded arguments in the order they were typed', () => {
        const result = buildPnpmArgs({
            script: script(),
            passthrough: ['--file', 'snapshot.json', '--dry-run']
        });

        expect(result.slice(-3)).toEqual(['--file', 'snapshot.json', '--dry-run']);
    });
});
