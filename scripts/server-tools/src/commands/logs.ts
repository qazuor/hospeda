/**
 * `hctl logs <kind> [-f] [-n N] [-g REGEX] [--since DURATION]` — tail
 * docker logs for a Hospeda app with sensible defaults and optional
 * grep filtering. One command for api / web / admin so the surface
 * area stays small.
 */

import { spawn } from 'node:child_process';
import { type ContainerKind, findContainer } from '../lib/container-lookup.ts';
import { dockerLogs, dockerPrefix } from '../lib/docker.ts';
import { die, log } from '../lib/log.ts';

const KINDS: ReadonlyArray<ContainerKind> = ['api', 'web', 'admin'];

const HELP = `
hctl logs <kind> [-n <N>] [-f] [-g <REGEX>] [--since <DURATION>]

Kinds:
  api      long-running Hono API container
  web      Astro Node SSR container
  admin    TanStack Start admin container

Flags:
  -n <N>          Last N lines (default 200; ignored when --since is set).
  -f              Follow new lines (Ctrl+C to exit).
  -g <REGEX>      Pipe through grep -iE <REGEX> (case-insensitive ERE).
  --since <D>     Only lines newer than <D> — Docker syntax (5m, 30s, 1h).
  --help          Show this help.

Examples:
  hctl logs api
  hctl logs api -n 1000
  hctl logs api -f -g 'billing|qzpay|mercadopago'
  hctl logs web --since 5m
`.trim();

function isKind(value: string): value is ContainerKind {
    return (KINDS as ReadonlyArray<string>).includes(value);
}

export async function logs(argv: ReadonlyArray<string>): Promise<void> {
    const args = [...argv];

    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const kindRaw = args[0];
    if (!kindRaw || !isKind(kindRaw)) {
        die(`Unknown kind '${kindRaw ?? ''}'. Known: ${KINDS.join(', ')}.`);
    }

    let tail = 200;
    let follow = false;
    let pattern: string | undefined;
    let since: string | undefined;

    for (let i = 1; i < args.length; i++) {
        const a = args[i];
        switch (a) {
            case '-n': {
                const value = args[++i];
                if (!value) die('-n requires a number.');
                const parsed = Number.parseInt(value, 10);
                if (!Number.isFinite(parsed) || parsed < 0) die(`-n: invalid number '${value}'.`);
                tail = parsed;
                break;
            }
            case '-f':
                follow = true;
                break;
            case '-g': {
                const value = args[++i];
                if (!value) die('-g requires a regex pattern.');
                pattern = value;
                break;
            }
            case '--since': {
                const value = args[++i];
                if (!value) die('--since requires a duration (e.g. 5m).');
                since = value;
                break;
            }
            default:
                die(`Unknown argument: ${a} (try --help)`);
        }
    }

    const container = await findContainer(kindRaw);

    // Without -g and without -f, simple capture is enough — print and
    // exit. With -g or -f, we need a streaming pipeline (otherwise we'd
    // buffer the entire log into memory before the user sees anything).
    const useStream = follow || pattern !== undefined;

    if (!useStream) {
        const result = await dockerLogs({ container, tail, since });
        process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
        if (result.exitCode !== 0) process.exit(result.exitCode);
        return;
    }

    // Streaming mode — spawn `docker logs` directly so we can pipe its
    // stdout/stderr into grep without loading them into memory.
    //
    // Resolve the same sudo prefix the rest of the toolkit uses so we
    // don't silently fail when the operator is not in the docker group.
    const prefix = await dockerPrefix();
    const dockerArgs: string[] = ['logs'];
    if (follow) dockerArgs.push('-f');
    if (since) dockerArgs.push('--since', since);
    else dockerArgs.push('--tail', String(tail));
    dockerArgs.push(container);

    const [program, ...programArgs] =
        prefix.length > 0 ? [...prefix, 'docker', ...dockerArgs] : ['docker', ...dockerArgs];
    if (!program) {
        die('Could not resolve a docker invocation prefix.');
    }
    const dockerProc = spawn(program, programArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

    if (pattern !== undefined) {
        const grep = spawn('grep', ['--line-buffered', '-iE', pattern], {
            stdio: ['pipe', 'inherit', 'inherit']
        });
        // Merge docker stdout + stderr so timestamped error lines also
        // get filtered.
        dockerProc.stdout.pipe(grep.stdin);
        dockerProc.stderr.pipe(grep.stdin);
        dockerProc.on('exit', (code) => {
            grep.stdin.end();
            if (code !== null && code !== 0) process.exitCode = code;
        });
        grep.on('exit', (code) => {
            // grep exit 1 means "no matches" which is fine for follow mode.
            if (code === 0 || code === 1) return;
            log.warn(`grep exited with status ${code}`);
        });
    } else {
        dockerProc.stdout.pipe(process.stdout);
        dockerProc.stderr.pipe(process.stderr);
        dockerProc.on('exit', (code) => {
            if (code !== null && code !== 0) process.exitCode = code;
        });
    }

    // Forward Ctrl+C to the docker process so the follow stream terminates
    // cleanly when the operator hits ^C.
    process.on('SIGINT', () => {
        dockerProc.kill('SIGINT');
    });
}
