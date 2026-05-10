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
import { dockerPrefix } from './docker.ts';

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
