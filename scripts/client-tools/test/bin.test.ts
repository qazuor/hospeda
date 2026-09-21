import { describe, expect, it } from 'bun:test';
import { execFileSync } from 'node:child_process';
import {
    chmodSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COMMANDS } from '../src/registry.ts';

const BIN_DIR = join(import.meta.dir, '..', 'bin');

describe('standalone distribution manifest', () => {
    it('declares every hops-* wrapper in package.json', () => {
        const packageJson = JSON.parse(
            readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf8')
        ) as {
            readonly bin: Record<string, string>;
        };
        const declared = Object.keys(packageJson.bin)
            .filter((name) => name.startsWith('hops-'))
            .sort();
        const files = readdirSync(BIN_DIR)
            .filter((name) => name.startsWith('hops-'))
            .sort();
        expect(declared).toEqual(files);
    });
});

/** Runs a binary to completion, capturing what it wrote. */
async function runBin({
    name,
    args,
    env,
    cwd
}: {
    readonly name: string;
    readonly args: readonly string[];
    readonly env?: Record<string, string>;
    readonly cwd?: string;
}): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> {
    const proc = Bun.spawn([join(BIN_DIR, name), ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
        stdin: 'ignore',
        cwd,
        env: env === undefined ? undefined : { ...process.env, ...env }
    });
    const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text()
    ]);
    return { code: await proc.exited, stdout, stderr };
}

/**
 * These run the real binaries, and they exist because of a real bug: `bin/hops`
 * used to only `import` the module, while the module's entry point was guarded
 * by `import.meta.main` — false when the shim is the entry point. Every unit
 * test passed, `hops --help` printed nothing, and an unknown command exited 0.
 * Nothing short of executing the binary could see it.
 */
describe('bin/hops', () => {
    it('should print the help page and exit 0', async () => {
        const result = await runBin({ name: 'hops', args: ['--help'] });

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('herramientas de desarrollo');
    });

    it('should list every registered command in the help page', async () => {
        const result = await runBin({ name: 'hops', args: ['--help'] });

        for (const command of COMMANDS) {
            expect(result.stdout).toContain(`hops ${command.name}`);
        }
    });

    it('should exit 1 on an unknown command instead of doing nothing', async () => {
        const result = await runBin({ name: 'hops', args: ['definitely-not-a-command'] });

        expect(result.code).toBe(1);
        expect(result.stderr).toContain('Comando desconocido');
    });
});

describe('ci · integración del binario con GitHub', () => {
    it('debe distinguir verde, rojo, pendiente, conflicto, sin checks y error de consulta', async () => {
        const fakeDir = mkdtempSync(join(tmpdir(), 'hops-fake-gh-'));
        const fakeRepo = mkdtempSync(join(tmpdir(), 'hops-fake-repo-'));
        const fakeGh = join(fakeDir, 'gh');
        mkdirSync(join(fakeRepo, '.claude'));
        writeFileSync(join(fakeRepo, '.claude', 'project.config.json'), '{}');
        execFileSync('git', ['init', '-q', '-b', 'test-ci'], { cwd: fakeRepo });
        writeFileSync(
            fakeGh,
            `#!/usr/bin/env bash
case "\${HOPS_FAKE_GH_SCENARIO}" in
green) echo '[{"number":1,"state":"OPEN","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","isDraft":false,"baseRefName":"staging","title":"ok","statusCheckRollup":[{"name":"CI","conclusion":"SUCCESS"}]}]' ;;
red) echo '[{"number":1,"state":"OPEN","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","isDraft":false,"baseRefName":"staging","title":"ok","statusCheckRollup":[{"name":"CI","conclusion":"FAILURE"}]}]' ;;
pending) echo '[{"number":1,"state":"OPEN","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","isDraft":false,"baseRefName":"staging","title":"ok","statusCheckRollup":[{"name":"CI","status":"IN_PROGRESS","conclusion":""}]}]' ;;
conflict) echo '[{"number":1,"state":"OPEN","mergeable":"CONFLICTING","mergeStateStatus":"DIRTY","isDraft":false,"baseRefName":"staging","title":"ok","statusCheckRollup":[{"name":"CI","conclusion":"SUCCESS"}]}]' ;;
no-checks) echo '[{"number":1,"state":"OPEN","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","isDraft":false,"baseRefName":"staging","title":"ok","statusCheckRollup":[]}]' ;;
none) echo '[]' ;;
error) echo 'credentials rejected' >&2; exit 1 ;;
esac
`,
            'utf8'
        );
        chmodSync(fakeGh, 0o755);
        const scenarios = [
            ['green', 0, 'VERDE'],
            ['red', 1, 'ROJO'],
            ['pending', 2, 'TODAVÍA CORRIENDO'],
            ['conflict', 1, 'EN CONFLICTO'],
            ['no-checks', 1, 'SIN CHECKS'],
            ['none', 1, 'No hay PR'],
            ['error', 1, 'No pude consultar GitHub']
        ] as const;
        try {
            for (const [scenario, code, expected] of scenarios) {
                const result = await runBin({
                    name: 'hops-ci',
                    args: [],
                    env: {
                        PATH: `${fakeDir}:${process.env.PATH ?? ''}`,
                        HOPS_FAKE_GH_SCENARIO: scenario
                    },
                    cwd: fakeRepo
                });
                expect({ scenario, code: result.code }).toEqual({ scenario, code });
                expect(`${result.stdout}\n${result.stderr}`).toContain(expected);
            }
        } finally {
            rmSync(fakeDir, { recursive: true, force: true });
            rmSync(fakeRepo, { recursive: true, force: true });
        }
    }, 60_000);
});

describe('standalone binaries', () => {
    it('should answer --help with output and a zero exit, one per command', async () => {
        // Spawned in parallel, and the command name travels with every
        // assertion. Sequentially this is 18 cold `bun` starts, which run past
        // 30s on a transpile cache CI never has warm: the test then fails on
        // timing, names no command, and reads like a broken binary.
        const results = await Promise.all(
            COMMANDS.map(async (command) => ({
                name: command.name,
                ...(await runBin({ name: `hops-${command.name}`, args: ['--help'] }))
            }))
        );

        for (const result of results) {
            expect({ command: result.name, code: result.code }).toEqual({
                command: result.name,
                code: 0
            });
            expect({ command: result.name, wroteHelp: result.stdout.trim().length > 0 }).toEqual({
                command: result.name,
                wroteHelp: true
            });
        }
    }, 60_000);

    it('should route a standalone binary through the same command as the sub-command', async () => {
        // `hops stats --help` and `hops-stats --help` must be the same program.
        const viaDispatcher = await runBin({ name: 'hops', args: ['stats', '--help'] });
        const viaAlias = await runBin({ name: 'hops-stats', args: ['--help'] });

        expect(viaAlias.stdout).toBe(viaDispatcher.stdout);
        expect(viaAlias.code).toBe(viaDispatcher.code);
    }, 60_000);
});

/**
 * The bar is drawn by the dispatcher, not by each command. These lock that in:
 * it shipped the other way first, and three of six commands had no bar at all
 * while the menu used a different header entirely.
 */
describe('status bar · dibujada por el dispatcher', () => {
    it('should frame every command, even ones that never draw it themselves', async () => {
        // `--help` and NOT an unknown flag: an unrecognised argument makes a
        // command run for real. This test used to pass `--definitely-not-a-flag`
        // and `hops-db-update-template` took it as an ordinary run — it dropped
        // the shared template database mid-suite. A test must never be able to
        // execute the destructive path of the thing it is testing.
        const results = await Promise.all(
            COMMANDS.map(async (command) => ({
                name: command.name,
                ...(await runBin({ name: `hops-${command.name}`, args: ['--help'] }))
            }))
        );

        for (const result of results) {
            const bars = (result.stderr.match(/hops ·/g) ?? []).length;

            // Two: one opening, one closing. Four would mean a command is
            // drawing its own on top of the dispatcher's.
            expect({ command: result.name, bars }).toEqual({ command: result.name, bars: 2 });
        }
    }, 60_000);

    it('should frame a help page too — no exceptions', async () => {
        // A bar that is sometimes there is a bar you stop reading.
        const result = await runBin({ name: 'hops-db-start', args: ['--help'] });
        const bars = (result.stderr.match(/hops ·/g) ?? []).length;

        expect(bars).toBe(2);
    });

    it('should keep the help text itself on stdout, unframed', async () => {
        // The bar goes to stderr so `hops db-start --help | less` still pipes
        // clean text.
        const result = await runBin({ name: 'hops-db-start', args: ['--help'] });

        expect(result.stdout).toContain('levanta Postgres y Redis');
        expect(result.stdout).not.toContain('hops ·');
    });

    it('should resolve --wt in the dispatcher, before drawing the bar', async () => {
        // With an unknown name the run must stop. If `--wt` were ignored, the
        // context would quietly fall back to the current directory and the
        // command would proceed against the wrong worktree — with the bar
        // naming that wrong one, which is the whole failure this prevents.
        const result = await runBin({
            name: 'hops-db-start',
            args: ['--wt', 'no-existe-este-worktree-xyz', '--help']
        });

        expect(result.code).toBe(1);
        expect(result.stderr).toContain('No encontré un worktree');
    });

    it('should refuse a remote target on a local-only command', async () => {
        const result = await runBin({ name: 'hops-wt-clean', args: ['--target=prod'] });

        expect(result.code).toBe(1);
        expect(result.stderr).toContain('sólo corre en local');
    });
});

/**
 * The end-to-end half of the HOS-510 contract. The unit tests prove the parser;
 * this proves the parser is actually wired to the binary.
 *
 * `env:check:rules` is deliberate: it is a read-only checker, so if this guard
 * ever regresses the test runs something harmless instead of the data-migration
 * that made the rule necessary.
 */
describe('hops run · flags desconocidos', () => {
    it('should refuse an unknown flag instead of running the script without it', async () => {
        const result = await runBin({
            name: 'hops-run',
            args: ['env:check:rules', '--definitely-not-a-flag']
        });

        expect(result.code).toBe(1);
        expect(result.stderr).toContain('No entiendo: --definitely-not-a-flag');
        // The arrow is written immediately before the script is spawned, so its
        // absence is what says nothing ran.
        expect(result.stderr).not.toContain('\u2192 ');
    });

    it('should point at the -- separator so the flag has somewhere to go', async () => {
        const result = await runBin({
            name: 'hops-run',
            args: ['env:check:rules', '--definitely-not-a-flag']
        });

        expect(result.stderr).toContain('hops run env:check:rules -- --definitely-not-a-flag');
    });
});
