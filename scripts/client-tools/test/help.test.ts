import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { exportArgs, type RunHelpDeps, runHelp } from '../src/commands/help/help.ts';
import type { Job, Runner } from '../src/lib/runner.ts';

const BIN_DIR = join(import.meta.dir, '..', 'bin');
const SITE = 'https://example.test';

/** A runner that records the jobs it is given and answers a fixed code. */
function fakeRunner({ code = 0 }: { readonly code?: number } = {}) {
    const jobs: Job[] = [];
    const runner: Runner = {
        target: 'local',
        exec: async (job) => {
            jobs.push(job);
            return code;
        },
        execCapture: async () => ({ code: 0, stdout: '', stderr: '' })
    };
    return { runner, jobs };
}

/** Surroundings with a fixed repo root and user cwd. */
function deps({ runner }: { readonly runner: Runner }): RunHelpDeps {
    return { runner, resolveCwd: async () => '/repo', cwd: '/home/me/flyers' };
}

describe('hops help export', () => {
    it('spawns the @repo/help export script silently, from the repo, with the arguments as given', async () => {
        const { runner, jobs } = fakeRunner();

        const code = await runHelp({
            argv: ['export', '--audience', 'venue', '--site-url', SITE],
            deps: deps({ runner })
        });

        expect(code).toBe(0);
        expect(jobs).toEqual([
            {
                command: 'pnpm',
                args: [
                    '--silent',
                    '--filter',
                    '@repo/help',
                    'export',
                    '--audience',
                    'venue',
                    '--site-url',
                    SITE
                ],
                cwd: '/repo'
            }
        ]);
    });

    it("returns the script's exit code, so a bad audience fails hops too (AC-36)", async () => {
        const { runner } = fakeRunner({ code: 1 });

        const code = await runHelp({
            argv: ['export', '--audience', 'tourist', '--site-url', SITE],
            deps: deps({ runner })
        });

        expect(code).toBe(1);
    });

    it('refuses an unknown subcommand without spawning anything', async () => {
        const { runner, jobs } = fakeRunner();

        expect(await runHelp({ argv: ['import'], deps: deps({ runner }) })).toBe(1);
        expect(jobs).toEqual([]);
    });

    it('points at hops --help when run with no subcommand, and exits 1', async () => {
        const { runner, jobs } = fakeRunner();
        const written: string[] = [];
        const original = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((chunk: string) => {
            written.push(String(chunk));
            return true;
        }) as typeof process.stderr.write;
        try {
            expect(await runHelp({ argv: [], deps: deps({ runner }) })).toBe(1);
        } finally {
            process.stderr.write = original;
        }
        expect(written.join('')).toContain('hops --help');
        expect(jobs).toEqual([]);
    });

    it('prints its help for --help and spawns nothing', async () => {
        const { runner, jobs } = fakeRunner();

        expect(await runHelp({ argv: ['export', '--help'], deps: deps({ runner }) })).toBe(0);
        expect(jobs).toEqual([]);
    });
});

describe('exportArgs', () => {
    it('makes a relative --out absolute against the directory hops ran from', () => {
        expect(exportArgs({ argv: ['--out', 'venue.md'], cwd: '/home/me' })).toEqual([
            '--out',
            '/home/me/venue.md'
        ]);
        expect(exportArgs({ argv: ['--out=a/b.md'], cwd: '/home/me' })).toEqual([
            '--out=/home/me/a/b.md'
        ]);
    });

    it('leaves an absolute --out and every other argument untouched', () => {
        const argv = ['--audience', 'host', '--out', '/tmp/x.md', '--site-url', SITE];
        expect(exportArgs({ argv, cwd: '/home/me' })).toEqual(argv);
    });
});

/**
 * AC-35 end to end: the real binary, the real pnpm script and the committed
 * index. stdout must hold the Markdown document and nothing else (the status
 * bar goes to stderr).
 */
describe('bin/hops-help export (AC-35)', () => {
    it('prints the venue bundle on stdout and exits 0', async () => {
        const proc = Bun.spawn(
            [join(BIN_DIR, 'hops-help'), 'export', '--audience', 'venue', '--site-url', SITE],
            {
                stdout: 'pipe',
                stderr: 'pipe',
                stdin: 'ignore',
                env: { ...process.env, CI: 'true' }
            }
        );
        const [stdout] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text()
        ]);

        expect(await proc.exited).toBe(0);
        expect(stdout.startsWith('# Ayuda Hospeda — Comer y salir\n\n## ')).toBe(true);
        expect(stdout.match(/^# /gm)).toHaveLength(1);
        expect(stdout).toContain('### Relacionados');
        expect(stdout).toContain('según tu plan');
        expect(stdout).not.toContain('{{');
        for (const [, url] of stdout.matchAll(/\]\(([^)]+)\)/g)) {
            expect(url?.startsWith(`${SITE}/es/`)).toBe(true);
        }
    }, 60_000);

    it('exits 1 with the valid audiences for --audience tourist (AC-36)', async () => {
        const proc = Bun.spawn(
            [join(BIN_DIR, 'hops-help'), 'export', '--audience', 'tourist', '--site-url', SITE],
            {
                stdout: 'pipe',
                stderr: 'pipe',
                stdin: 'ignore',
                env: { ...process.env, CI: 'true' }
            }
        );
        const [stdout, stderr] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text()
        ]);

        expect(await proc.exited).toBe(1);
        expect(stdout).toBe('');
        expect(stderr).toContain('host, venue, experience, provider, partner, all');
    }, 60_000);
});
