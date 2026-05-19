/**
 * Postgres helpers shared by `db-backup-now` and `db-restore`.
 *
 * The two commands need the same `pg_dump -Fc` invocation (the second
 * uses it for the optional pre-restore snapshot), so the call is
 * extracted here. Routing it through `node:child_process.spawn` rather
 * than the shared runner is deliberate: pg_dump's custom format produces
 * binary output and execa's default string capture would corrupt it.
 */

import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { docker, dockerPrefix } from './docker.ts';

/** Result of a pg_dump invocation captured into memory. */
export interface PgDumpResult {
    /** The dump bytes (custom format, zlib-compressed). */
    readonly stdout: Buffer;
    /** Anything pg_dump printed to stderr (warnings or errors). */
    readonly stderr: string;
    /** Process exit code. 0 on success. */
    readonly exitCode: number;
}

/**
 * Run `pg_dump -Fc --no-owner --no-privileges` inside the named
 * container and capture its binary stdout.
 *
 * The dump is held in RAM until the caller decides what to do with it.
 * Hospeda's database is a few MB today — fine. If we cross ~100 MB,
 * switch to streaming directly into a multipart R2 upload.
 */
export async function pgDumpToBuffer(params: {
    readonly container: string;
    readonly user: string;
    readonly db: string;
}): Promise<PgDumpResult> {
    const prefix = await dockerPrefix();
    const argv = [
        ...prefix,
        'docker',
        'exec',
        params.container,
        'pg_dump',
        '-U',
        params.user,
        '-d',
        params.db,
        '-Fc',
        '--no-owner',
        '--no-privileges'
    ];
    const [command, ...args] = argv;
    if (!command) {
        throw new Error('pgDumpToBuffer: argv is empty (unreachable)');
    }

    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        const stdoutChunks: Array<Buffer> = [];
        const stderrChunks: Array<Buffer> = [];

        child.stdout.on('data', (chunk: Buffer) => {
            stdoutChunks.push(chunk);
        });
        child.stderr.on('data', (chunk: Buffer) => {
            stderrChunks.push(chunk);
        });

        child.on('error', reject);
        child.on('exit', (code) => {
            resolve({
                stdout: Buffer.concat(stdoutChunks),
                stderr: Buffer.concat(stderrChunks).toString('utf-8'),
                exitCode: code ?? 1
            });
        });
    });
}

/**
 * Read POSTGRES_PASSWORD from the container's `Config.Env`.
 *
 * Postgres images set the password as a container env var at create time
 * (Coolify provisions it from its own secret store). Inspecting the env
 * is the lowest-friction way to recover it without storing yet another
 * secret in `.env.local`. The same trick lets `hops psql` work without
 * any password configuration — psql goes through `docker exec` and
 * connects via the Unix socket inside the container, so it never
 * needs the password; this helper exists for callers that DO need the
 * password (notably building a `postgresql://` URL for clients running
 * outside the container, like `pnpm seed` on the VPS host).
 *
 * @throws when the container exposes no POSTGRES_PASSWORD env var.
 */
export async function getPostgresPassword(container: string): Promise<string> {
    const result = await docker([
        'inspect',
        container,
        '--format',
        '{{range .Config.Env}}{{println .}}{{end}}'
    ]);
    if (result.exitCode !== 0) {
        throw new Error(`docker inspect ${container} failed: ${result.stderr.trim()}`);
    }
    for (const line of result.stdout.split('\n')) {
        if (line.startsWith('POSTGRES_PASSWORD=')) {
            return line.slice('POSTGRES_PASSWORD='.length);
        }
    }
    throw new Error(
        `Container '${container}' does not expose POSTGRES_PASSWORD in its env. Cannot derive a Postgres URL automatically.`
    );
}

/**
 * Read the host port mapped to the container's `5432/tcp` via the docker
 * port table (the equivalent of `docker port <name> 5432`).
 *
 * Returns the host's listening address as `host:port` so it can be
 * spliced directly into a `postgresql://` URL. When Coolify exposes the
 * service publicly Docker prints multiple lines (one for IPv4 + one for
 * IPv6); we take the first IPv4 line and rewrite `0.0.0.0` to
 * `127.0.0.1` so the URL works when pasted into a client.
 *
 * @returns null when the port is NOT published to the host (callers
 * decide whether that is an error or a signal to fall back to in-container
 * execution).
 */
export async function getPostgresHostPort(container: string): Promise<string | null> {
    const result = await docker(['port', container, '5432']);
    if (result.exitCode !== 0) {
        // `docker port` exits 0 with empty stdout when the port is not
        // published — but older docker versions exit 6 with stderr. Treat
        // both shapes as "not published" rather than crashing.
        if (result.stdout.trim().length === 0) return null;
        throw new Error(`docker port ${container} 5432 failed: ${result.stderr.trim()}`);
    }
    const firstIpv4 = result.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .find((line) => !line.includes(':::'));
    if (!firstIpv4) return null;
    // Normalise 0.0.0.0 to 127.0.0.1 so clients on the host loopback can
    // actually connect (some PG clients refuse 0.0.0.0 as a target).
    return firstIpv4.replace(/^0\.0\.0\.0:/, '127.0.0.1:');
}

/**
 * Build a `postgresql://USER:PASS@HOST:PORT/DB` URL for the given
 * container by inspecting its env (password) and port mapping (host:port).
 * USER and DB come from the caller — the toolkit derives them from
 * {@link getDbCredentials} per target.
 *
 * Special characters in PASSWORD are URL-encoded so the resulting URL
 * is safe to splice into a connection string verbatim.
 *
 * @throws with an actionable message when the port is not published to
 * the host — in that case the seed cannot reach Postgres from outside
 * the docker network and the operator has to expose it via Coolify
 * (or change the workflow to run inside a container).
 */
export async function buildPostgresUrl(params: {
    readonly container: string;
    readonly user: string;
    readonly db: string;
}): Promise<string> {
    const [password, hostPort] = await Promise.all([
        getPostgresPassword(params.container),
        getPostgresHostPort(params.container)
    ]);
    if (!hostPort) {
        throw new Error(
            `Postgres container '${params.container}' does not publish port 5432 to the host. The seed runs from the VPS host and needs a reachable address. Publish the port in Coolify (Service → Network → expose 5432) and retry, or run the seed inside a container instead.`
        );
    }
    const encodedPassword = encodeURIComponent(password);
    const encodedUser = encodeURIComponent(params.user);
    return `postgresql://${encodedUser}:${encodedPassword}@${hostPort}/${params.db}`;
}
