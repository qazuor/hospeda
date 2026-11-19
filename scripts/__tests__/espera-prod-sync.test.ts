/**
 * @fileoverview
 * Drives `espera-prod-sync.sh` against a REAL throwaway git history (the
 * predicate is ancestry, which a mock cannot express) and a fake Linear GraphQL
 * server that records every request, so each test asserts both the exit code
 * and exactly which mutations reached Linear.
 */
import { execFile, execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(__dirname, '../espera-prod-sync.sh');

const TODO_ID = 'state-todo';
const LABEL_ID = 'label-espera';

interface FakeIssue {
    readonly identifier: string;
    readonly description: string;
    readonly stateType?: string;
}

interface GqlRequest {
    readonly query: string;
    readonly variables: Record<string, unknown>;
}

interface FakeLinear {
    readonly url: string;
    readonly requests: GqlRequest[];
    readonly close: () => Promise<void>;
}

interface FakeLinearOptions {
    readonly issues: readonly FakeIssue[];
    readonly listBody?: string;
    readonly commentSucceeds?: boolean;
    readonly hasNextPage?: boolean;
    readonly teamHasTodo?: boolean;
}

interface RunResult {
    readonly exitCode: number;
    readonly output: string;
}

/**
 * `process.env` without inherited `GIT_*` variables, so a run under a git hook
 * (GIT_DIR, GIT_INDEX_FILE) can never point the sandbox at the real repository.
 */
function cleanEnv(): NodeJS.ProcessEnv {
    return Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
    );
}

/** Runs git in `cwd` with a fixed identity, returning trimmed stdout. */
function git({ cwd, args }: { readonly cwd: string; readonly args: readonly string[] }): string {
    return execFileSync('git', [...args], {
        cwd,
        encoding: 'utf8',
        env: {
            ...cleanEnv(),
            GIT_AUTHOR_NAME: 'test',
            GIT_AUTHOR_EMAIL: 'test@example.com',
            GIT_COMMITTER_NAME: 'test',
            GIT_COMMITTER_EMAIL: 'test@example.com'
        }
    }).trim();
}

/** Commits a new file on the current branch and returns the commit SHA. */
function commit({ cwd, file }: { readonly cwd: string; readonly file: string }): string {
    writeFileSync(path.join(cwd, file), `${file}\n`);
    git({ cwd, args: ['add', file] });
    git({ cwd, args: ['commit', '-q', '-m', `add ${file}`] });
    return git({ cwd, args: ['rev-parse', 'HEAD'] });
}

/** Serialises one fake issue the way Linear's `issues` query returns it. */
function toNode(issue: FakeIssue): Record<string, unknown> {
    return {
        id: `uuid-${issue.identifier}`,
        identifier: issue.identifier,
        description: issue.description,
        state: { type: issue.stateType ?? 'backlog' },
        labels: {
            nodes: [
                { id: 'label-other', name: 'area-api' },
                { id: LABEL_ID, name: 'espera-prod' }
            ]
        },
        team: { id: 'team-1' }
    };
}

/** Starts a fake Linear GraphQL endpoint that records every request. */
async function startFakeLinear({
    issues,
    listBody,
    commentSucceeds = true,
    hasNextPage = false,
    teamHasTodo = true
}: FakeLinearOptions): Promise<FakeLinear> {
    const requests: GqlRequest[] = [];
    const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
        let raw = '';
        req.on('data', (chunk: Buffer) => {
            raw += chunk.toString();
        });
        req.on('end', () => {
            const body = JSON.parse(raw) as GqlRequest;
            requests.push(body);
            res.setHeader('Content-Type', 'application/json');
            if (body.query.includes('issues(')) {
                res.end(
                    listBody ??
                        JSON.stringify({
                            data: {
                                issues: {
                                    pageInfo: { hasNextPage },
                                    nodes: issues.map(toNode)
                                }
                            }
                        })
                );
            } else if (body.query.includes('team(id')) {
                res.end(
                    JSON.stringify({
                        data: { team: { states: { nodes: teamHasTodo ? [{ id: TODO_ID }] : [] } } }
                    })
                );
            } else if (body.query.includes('commentCreate')) {
                res.end(JSON.stringify({ data: { commentCreate: { success: commentSucceeds } } }));
            } else {
                res.end(JSON.stringify({ data: { issueUpdate: { success: true } } }));
            }
        });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return {
        url: `http://127.0.0.1:${port}/graphql`,
        requests,
        close: () => new Promise<void>((resolve) => server.close(() => resolve()))
    };
}

/** Runs the script asynchronously (the fake server lives in this process). */
function runScript({
    cwd,
    url,
    extraEnv = {}
}: {
    readonly cwd: string;
    readonly url: string;
    readonly extraEnv?: Record<string, string>;
}): Promise<RunResult> {
    return new Promise((resolve) => {
        execFile(
            'bash',
            [SCRIPT_PATH],
            {
                cwd,
                encoding: 'utf8',
                env: {
                    ...cleanEnv(),
                    LINEAR_API_KEY: 'test-key',
                    LINEAR_API_URL: url,
                    TARGET_REF: 'main',
                    ...extraEnv
                }
            },
            (error, stdout, stderr) => {
                const exitCode = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
                resolve({ exitCode, output: `${stdout}${stderr}` });
            }
        );
    });
}

/** Returns the recorded mutations of one kind. */
function mutations({
    requests,
    kind
}: {
    readonly requests: readonly GqlRequest[];
    readonly kind: 'commentCreate' | 'issueUpdate';
}): GqlRequest[] {
    return requests.filter((r) => r.query.includes(kind));
}

describe('espera-prod-sync.sh', () => {
    let root: string;
    let repo: string;
    let mergedSha: string;
    let pendingSha: string;
    let fake: FakeLinear | undefined;

    beforeEach(() => {
        root = mkdtempSync(path.join(tmpdir(), 'espera-prod-'));
        repo = path.join(root, 'repo');
        git({ cwd: root, args: ['init', '-q', '-b', 'main', repo] });
        commit({ cwd: repo, file: 'base.txt' });
        mergedSha = commit({ cwd: repo, file: 'fix.txt' });
        git({ cwd: repo, args: ['checkout', '-q', '-b', 'staging'] });
        pendingSha = commit({ cwd: repo, file: 'staging-only.txt' });
        git({ cwd: repo, args: ['checkout', '-q', 'main'] });
    });

    afterEach(async () => {
        await fake?.close();
        fake = undefined;
        rmSync(root, { recursive: true, force: true });
    });

    it('fires once every declared SHA is in main: comments, drops the label, moves Backlog to Todo', async () => {
        // Arrange
        fake = await startFakeLinear({
            issues: [
                {
                    identifier: 'HOS-1',
                    description: `## Qué hacer\n\n**Espera en prod:** \`${mergedSha.slice(0, 10)}\`\n`
                }
            ]
        });

        // Act
        const result = await runScript({ cwd: repo, url: fake.url });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('HOS-1: fired');
        const comments = mutations({ requests: fake.requests, kind: 'commentCreate' });
        expect(comments).toHaveLength(1);
        expect(comments[0]?.variables).toMatchObject({ issueId: 'uuid-HOS-1' });
        expect(String(comments[0]?.variables.body)).toContain(mergedSha.slice(0, 10));
        const updates = mutations({ requests: fake.requests, kind: 'issueUpdate' });
        expect(updates).toHaveLength(1);
        expect(updates[0]?.variables).toEqual({
            id: 'uuid-HOS-1',
            input: { removedLabelIds: [LABEL_ID], stateId: TODO_ID }
        });
    });

    it('does not move the state when the issue is already past Backlog', async () => {
        // Arrange
        fake = await startFakeLinear({
            issues: [
                {
                    identifier: 'HOS-2',
                    description: `Espera en prod: ${mergedSha}`,
                    stateType: 'started'
                }
            ]
        });

        // Act
        const result = await runScript({ cwd: repo, url: fake.url });

        // Assert
        expect(result.exitCode).toBe(0);
        const updates = mutations({ requests: fake.requests, kind: 'issueUpdate' });
        expect(updates[0]?.variables).toEqual({
            id: 'uuid-HOS-2',
            input: { removedLabelIds: [LABEL_ID] }
        });
    });

    it('lists every declared SHA in the comment, comma-separated', async () => {
        // Arrange
        const numericSha = '4615593593';
        const fakeBin = path.join(root, 'fake-bin');
        mkdirSync(fakeBin);
        const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
        const gitWrapper = path.join(fakeBin, 'git');
        writeFileSync(
            gitWrapper,
            `#!/bin/sh
if [ "$1" = "rev-parse" ] && [ "$2" = "--verify" ] && [ "$3" = "-q" ] && [ "$4" = "${numericSha}^{commit}" ]; then
    exit 0
fi
if [ "$1" = "merge-base" ] && [ "$2" = "--is-ancestor" ] && [ "$3" = "${numericSha}" ]; then
    exit 0
fi
exec "${realGit}" "$@"
`
        );
        chmodSync(gitWrapper, 0o755);
        fake = await startFakeLinear({
            issues: [
                {
                    identifier: 'HOS-10',
                    description: `Espera en prod: ${numericSha} ${mergedSha.slice(0, 10)} (20261117, defaced)`
                }
            ]
        });

        // Act
        const result = await runScript({
            cwd: repo,
            url: fake.url,
            extraEnv: { PATH: `${fakeBin}:${process.env.PATH ?? ''}` }
        });

        // Assert
        expect(result.exitCode).toBe(0);
        const body = String(
            mutations({ requests: fake.requests, kind: 'commentCreate' })[0]?.variables.body
        );
        const expected = [numericSha, mergedSha.slice(0, 10)]
            .sort()
            .map((s) => `\`${s}\``)
            .join(', ');
        expect(body).toContain(`(${expected})`);
    });

    it('keeps waiting, and writes nothing, while a declared SHA is only on staging', async () => {
        // Arrange
        fake = await startFakeLinear({
            issues: [
                {
                    identifier: 'HOS-3',
                    description: `Espera en prod: ${mergedSha.slice(0, 10)}, ${pendingSha.slice(0, 10)}`
                }
            ]
        });

        // Act
        const result = await runScript({ cwd: repo, url: fake.url });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain(`HOS-3: still waiting for ${pendingSha.slice(0, 10)}`);
        expect(mutations({ requests: fake.requests, kind: 'commentCreate' })).toHaveLength(0);
        expect(mutations({ requests: fake.requests, kind: 'issueUpdate' })).toHaveLength(0);
    });

    it('fails and names the issue when it carries the label but declares no SHA', async () => {
        // Arrange
        fake = await startFakeLinear({
            issues: [
                { identifier: 'HOS-4', description: 'Cuando llegue a prod, cambiar el setting.' }
            ]
        });

        // Act
        const result = await runScript({ cwd: repo, url: fake.url });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('HOS-4 has the');
        expect(mutations({ requests: fake.requests, kind: 'commentCreate' })).toHaveLength(0);
    });

    it('fails when a declared SHA does not exist in the repository', async () => {
        // Arrange
        fake = await startFakeLinear({
            issues: [{ identifier: 'HOS-5', description: 'Espera en prod: deadbeef00' }]
        });

        // Act
        const result = await runScript({ cwd: repo, url: fake.url });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('HOS-5 declares SHA(s) that do not exist');
        expect(mutations({ requests: fake.requests, kind: 'commentCreate' })).toHaveLength(0);
    });

    it('leaves the label alone when the comment fails, so the next push retries', async () => {
        // Arrange
        fake = await startFakeLinear({
            issues: [{ identifier: 'HOS-6', description: `Espera en prod: ${mergedSha}` }],
            commentSucceeds: false
        });

        // Act
        const result = await runScript({ cwd: repo, url: fake.url });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('HOS-6: could not comment');
        expect(mutations({ requests: fake.requests, kind: 'issueUpdate' })).toHaveLength(0);
    });

    it('fails when Linear answers something that is not JSON', async () => {
        // Arrange
        fake = await startFakeLinear({ issues: [], listBody: '<html>502 Bad Gateway</html>' });

        // Act
        const result = await runScript({ cwd: repo, url: fake.url });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('Could not list');
    });

    it('reports without writing under DRY_RUN', async () => {
        // Arrange
        fake = await startFakeLinear({
            issues: [{ identifier: 'HOS-7', description: `Espera en prod: ${mergedSha}` }]
        });

        // Act
        const result = await runScript({ cwd: repo, url: fake.url, extraEnv: { DRY_RUN: '1' } });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('HOS-7: would fire');
        expect(mutations({ requests: fake.requests, kind: 'commentCreate' })).toHaveLength(0);
        expect(mutations({ requests: fake.requests, kind: 'issueUpdate' })).toHaveLength(0);
    });

    it('reads every declaration line and accepts the colon outside the bold', async () => {
        // Arrange
        fake = await startFakeLinear({
            issues: [
                {
                    identifier: 'HOS-11',
                    description: `**Espera en prod**: \`${mergedSha.slice(0, 10)}\`\n\nTexto.\n\nEspera en prod: ${pendingSha.slice(0, 10)}`
                }
            ]
        });

        // Act
        const result = await runScript({ cwd: repo, url: fake.url });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain(`HOS-11: still waiting for ${pendingSha.slice(0, 10)}`);
        expect(mutations({ requests: fake.requests, kind: 'commentCreate' })).toHaveLength(0);
    });

    it('ignores dates and hex-looking words written on the declaration line', async () => {
        // Arrange
        fake = await startFakeLinear({
            issues: [
                {
                    identifier: 'HOS-12',
                    description: `Espera en prod: ${mergedSha.slice(0, 10)} (mergeado el 20261117, defaced)`
                }
            ]
        });

        // Act
        const result = await runScript({ cwd: repo, url: fake.url });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('HOS-12: fired');
    });

    it('treats a JSON answer without the issues list as a failure, never as zero issues', async () => {
        // Arrange
        fake = await startFakeLinear({ issues: [], listBody: '{"message":"rate limited"}' });

        // Act
        const result = await runScript({ cwd: repo, url: fake.url });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('Could not list');
    });

    it('passes quietly when no issue carries the label', async () => {
        // Arrange
        fake = await startFakeLinear({ issues: [] });

        // Act
        const result = await runScript({ cwd: repo, url: fake.url });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain("Open issues labelled 'espera-prod': 0");
    });

    it('fails when there is a second page it did not check', async () => {
        // Arrange
        fake = await startFakeLinear({
            issues: [{ identifier: 'HOS-13', description: `Espera en prod: ${pendingSha}` }],
            hasNextPage: true
        });

        // Act
        const result = await runScript({ cwd: repo, url: fake.url });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('only the first page was checked');
    });

    it('removes only the label, with a warning, when the team has no Todo state', async () => {
        // Arrange
        fake = await startFakeLinear({
            issues: [{ identifier: 'HOS-14', description: `Espera en prod: ${mergedSha}` }],
            teamHasTodo: false
        });

        // Act
        const result = await runScript({ cwd: repo, url: fake.url });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain("HOS-14: its team has no 'Todo' state");
        expect(mutations({ requests: fake.requests, kind: 'issueUpdate' })[0]?.variables).toEqual({
            id: 'uuid-HOS-14',
            input: { removedLabelIds: [LABEL_ID] }
        });
    });

    it('still processes the other issues after one fails', async () => {
        // Arrange
        fake = await startFakeLinear({
            issues: [
                { identifier: 'HOS-8', description: 'sin declaración' },
                { identifier: 'HOS-9', description: `Espera en prod: ${mergedSha}` }
            ]
        });

        // Act
        const result = await runScript({ cwd: repo, url: fake.url });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('HOS-9: fired');
        expect(result.output).toContain('failed for: HOS-8');
    });
});
