/**
 * `hops logs <kind> [-f] [-n N] [-g REGEX] [--since DURATION]` — tail
 * docker logs for a Hospeda app with sensible defaults and optional
 * grep filtering. One command for api / web / admin so the surface
 * area stays small.
 */

import { spawn } from 'node:child_process';
import * as readline from 'node:readline';
import { type ContainerKind, findContainer } from '../lib/container-lookup.ts';
import { dockerLogs, dockerPrefix } from '../lib/docker.ts';
import { die } from '../lib/log.ts';

const KINDS: ReadonlyArray<ContainerKind> = ['api', 'web', 'admin'];

const HELP = `
hops logs <kind> [-n <N>] [-f] [-g <REGEX>] [--since <DURATION>]

Kinds:
  api      long-running Hono API container
  web      Astro Node SSR container
  admin    TanStack Start admin container

Flags:
  -n <N>          Last N lines (default 200; ignored when --since is set).
  -f              Follow new lines (Ctrl+C to exit).
  -g <REGEX>      Pipe through grep -iE <REGEX> (case-insensitive ERE).
  --since <D>     Only lines newer than <D> — Docker syntax (5m, 30s, 1h).
  --help, -h      Show this help.

Examples:
  hops logs api
  hops logs api -n 1000
  hops logs api -f -g 'billing|qzpay|mercadopago'
  hops logs web --since 5m
`.trim();

function isKind(value: string): value is ContainerKind {
    return (KINDS as ReadonlyArray<string>).includes(value);
}

export async function logs(argv: ReadonlyArray<string>): Promise<void> {
    const args = [...argv];

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
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
        // Normalise to CRLF per line for the same reason the streaming
        // path does — bun's pipe stdout is not always a TTY, so the
        // terminal driver may not translate bare LF into "carriage
        // return + line feed". Writing CRLF ourselves makes the output
        // render consistently regardless.
        process.stdout.write(normaliseLines(result.stdout));
        if (result.stderr) process.stderr.write(normaliseLines(result.stderr));
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

    // Match in Node directly. The earlier implementation spawned a
    // grep child and piped stdout/stderr into it, but that pipeline
    // produced cascading line offsets in the operator's terminal —
    // most likely because (a) bytewise piping interleaved chunks
    // across the two source streams, and (b) bun's pipe-mode stdout
    // may not be a TTY so terminal driver \\n→\\r\\n translation
    // doesn't kick in, leaving the cursor mid-line on each linefeed.
    // Doing the regex test in Node and writing CRLF terminated lines
    // sidesteps both problems and removes the grep dependency.
    const matcher = pattern !== undefined ? new RegExp(pattern, 'i') : null;
    const writeOutLine = (line: string, target: NodeJS.WriteStream): void => {
        // Trim trailing whitespace defensively even though docker logs
        // do not appear to add any — keeps output predictable across
        // future log-format changes.
        const cleaned = line.replace(/\s+$/, '');
        if (matcher && !matcher.test(cleaned)) return;
        // CRLF rather than bare LF so the terminal returns to column 1
        // even when stdout is not a TTY (e.g. when bun runs the script
        // and onlcr translation is disabled by the parent stdio).
        target.write(`${cleaned}\r\n`);
    };

    const rlOut = readline.createInterface({
        input: dockerProc.stdout,
        crlfDelay: Number.POSITIVE_INFINITY
    });
    const rlErr = readline.createInterface({
        input: dockerProc.stderr,
        crlfDelay: Number.POSITIVE_INFINITY
    });

    rlOut.on('line', (line) => writeOutLine(line, process.stdout));
    rlErr.on('line', (line) => writeOutLine(line, process.stderr));

    // Forward Ctrl+C to the docker process so the follow stream terminates
    // cleanly when the operator hits ^C. The handler must be installed
    // before the await below so the SIGINT lands on the child rather
    // than the bun runtime.
    process.on('SIGINT', () => {
        dockerProc.kill('SIGINT');
    });

    // Block until docker exits so the script keeps the process alive
    // through the entire stream. Without this await, bun's main returns
    // as soon as the synchronous setup completes (the open spawn + open
    // readline handles are not enough to keep bun's event loop pinned),
    // causing follow mode to terminate immediately on its own.
    await new Promise<void>((resolve) => {
        dockerProc.on('exit', (code) => {
            if (code !== null && code !== 0) process.exitCode = code;
            resolve();
        });
    });
}

/**
 * Trim trailing whitespace and ensure every line ends with CRLF.
 * Used by the captured-output path to keep terminal rendering
 * consistent regardless of whether stdout is a TTY (which controls
 * whether the kernel's onlcr translation kicks in for bare LF).
 */
function normaliseLines(text: string): string {
    return text
        .split('\n')
        .map((line) => line.replace(/\s+$/, ''))
        .join('\r\n');
}
