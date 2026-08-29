/**
 * Unit tests for `buildDockerLogsInvocation` in `src/lib/docker.ts`.
 *
 * Regression coverage for HOS-916: `hops logs api --since 24h > file`
 * discarded every WARN/ERROR line because docker's stdout and stderr
 * were captured and written to two separate destinations. The fix
 * merges stderr into stdout INSIDE the child shell (`sh -c 'exec docker
 * "$@" 2>&1'`) so the kernel preserves chronological interleaving —
 * concatenating captured stdout + stderr afterwards would not, since it
 * would put all of stderr after all of stdout.
 *
 * These tests cover the pure argv-building function only, per the
 * package convention (see logs-clear.test.ts) — side effects (spawning
 * docker, resolving the sudo prefix) are not covered here.
 */

import { describe, expect, it } from 'bun:test';
import { buildDockerLogsInvocation } from '../src/lib/docker.ts';

describe('buildDockerLogsInvocation(params)', () => {
    it('wraps docker in `sh -c` and merges stderr into stdout via 2>&1', () => {
        const argv = buildDockerLogsInvocation({ prefix: [], container: 'hospeda-api' });

        expect(argv[0]).toBe('sh');
        expect(argv[1]).toBe('-c');
        expect(argv[2]).toBe('exec docker "$@" 2>&1');
        // The $0 sentinel immediately follows the -c script.
        expect(argv[3]).toBe('sh');
    });

    it('never interpolates user-controlled args into the -c script string (no shell injection)', () => {
        const maliciousSince = '5m; rm -rf /';
        const argv = buildDockerLogsInvocation({
            prefix: [],
            container: 'hospeda-api',
            since: maliciousSince
        });

        const scriptArg = argv[2];
        expect(scriptArg).toBe('exec docker "$@" 2>&1');
        expect(scriptArg).not.toContain(maliciousSince);

        // The malicious value must appear as its own array element,
        // positioned after the `sh` sentinel, never embedded in the -c
        // string that sh parses as source.
        const sentinelIndex = argv.indexOf('sh', 3);
        expect(sentinelIndex).toBeGreaterThanOrEqual(3);
        const positional = argv.slice(sentinelIndex + 1);
        expect(positional).toContain(maliciousSince);
        expect(positional.some((arg) => arg === maliciousSince)).toBe(true);
    });

    it('passes container, --since, and --tail as positional args after the sh sentinel', () => {
        const argv = buildDockerLogsInvocation({
            prefix: [],
            container: 'hospeda-api',
            since: '24h'
        });

        const sentinelIndex = argv.indexOf('sh', 3);
        const dockerArgs = argv.slice(sentinelIndex + 1);
        expect(dockerArgs).toEqual(['logs', '--since', '24h', 'hospeda-api']);
    });

    it('respects the sudo prefix', () => {
        const argv = buildDockerLogsInvocation({
            prefix: ['sudo'],
            container: 'hospeda-api'
        });

        expect(argv[0]).toBe('sudo');
        expect(argv[1]).toBe('sh');
        expect(argv[2]).toBe('-c');
        expect(argv[3]).toBe('exec docker "$@" 2>&1');
        expect(argv[4]).toBe('sh');
    });

    it('adds -f when follow is set', () => {
        const argv = buildDockerLogsInvocation({
            prefix: [],
            container: 'hospeda-api',
            follow: true
        });

        const sentinelIndex = argv.indexOf('sh', 3);
        const dockerArgs = argv.slice(sentinelIndex + 1);
        expect(dockerArgs).toEqual(['logs', '-f', 'hospeda-api']);
    });

    it('prefers --since over --tail when both are given (current behaviour)', () => {
        const argv = buildDockerLogsInvocation({
            prefix: [],
            container: 'hospeda-api',
            since: '5m',
            tail: 500
        });

        const sentinelIndex = argv.indexOf('sh', 3);
        const dockerArgs = argv.slice(sentinelIndex + 1);
        expect(dockerArgs).toEqual(['logs', '--since', '5m', 'hospeda-api']);
        expect(dockerArgs).not.toContain('--tail');
    });

    it('falls back to --tail when since is not given', () => {
        const argv = buildDockerLogsInvocation({
            prefix: [],
            container: 'hospeda-api',
            tail: 200
        });

        const sentinelIndex = argv.indexOf('sh', 3);
        const dockerArgs = argv.slice(sentinelIndex + 1);
        expect(dockerArgs).toEqual(['logs', '--tail', '200', 'hospeda-api']);
    });
});
