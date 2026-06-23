import { type ChildProcess, spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

/**
 * Build and preview helper for SPEC-092 E2E suite.
 *
 * Builds api/admin/web concurrently via Turbo, then starts each app in
 * preview mode pointing to the E2E Postgres instance. Polls health endpoints
 * until all three are reachable, then returns a handle whose `teardown()`
 * gracefully kills the spawned processes.
 *
 * Spawned processes inherit the parent env plus a strict E2E override:
 *   - `HOSPEDA_DATABASE_URL` -> postgres on :15433 (hospeda_e2e)
 *   - `NODE_ENV` -> 'test'
 *   - `HOSPEDA_*` URLs -> e2e-local triplet
 *
 * Use ONLY in test setup. Never invoke from production code paths.
 */

export interface PreviewOptions {
    readonly apiPort?: number;
    readonly webPort?: number;
    readonly adminPort?: number;
    readonly databaseUrl?: string;
    readonly redisUrl?: string;
    readonly mailpitSmtpHost?: string;
    readonly mailpitSmtpPort?: number;
    /** Extra env overrides (merged after defaults). */
    readonly extraEnv?: Record<string, string>;
    /** Whether to run the build step. Default true; set false to reuse last build. */
    readonly build?: boolean;
    /** Health polling timeout in ms. */
    readonly readyTimeoutMs?: number;
}

export interface PreviewHandle {
    readonly apiUrl: string;
    readonly webUrl: string;
    readonly adminUrl: string;
    readonly teardown: () => Promise<void>;
}

// Defaults match apps/e2e/.env.e2e (SSOT for E2E ports).
const DEFAULT_API_PORT = 18001;
const DEFAULT_WEB_PORT = 18321;
const DEFAULT_ADMIN_PORT = 18000;
const DEFAULT_DB_URL = 'postgresql://hospeda_user:hospeda_pass@localhost:15433/hospeda_e2e';
const DEFAULT_REDIS_URL = 'redis://localhost:16380';
const DEFAULT_READY_TIMEOUT_MS = 60_000;
const HEALTH_POLL_INTERVAL_MS = 1_000;

const REPO_ROOT = process.env.HOSPEDA_REPO_ROOT ?? process.cwd();

/**
 * Builds the 3 apps via Turbo and spawns them in preview mode.
 *
 * Returns once every health endpoint responds 200 (or throws on timeout).
 *
 * @example
 * ```ts
 * const preview = await buildAndPreview();
 * try {
 *     // run tests against preview.webUrl etc.
 * } finally {
 *     await preview.teardown();
 * }
 * ```
 */
export async function buildAndPreview(options: PreviewOptions = {}): Promise<PreviewHandle> {
    const apiPort = options.apiPort ?? DEFAULT_API_PORT;
    const webPort = options.webPort ?? DEFAULT_WEB_PORT;
    const adminPort = options.adminPort ?? DEFAULT_ADMIN_PORT;
    const databaseUrl = options.databaseUrl ?? DEFAULT_DB_URL;
    const redisUrl = options.redisUrl ?? DEFAULT_REDIS_URL;
    const apiUrl = `http://localhost:${apiPort}`;
    const webUrl = `http://localhost:${webPort}`;
    const adminUrl = `http://localhost:${adminPort}`;
    const readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;

    if (options.build !== false) {
        await runTurboBuild();
    }

    const e2eEnv: NodeJS.ProcessEnv = {
        ...process.env,
        NODE_ENV: 'test',
        HOSPEDA_DATABASE_URL: databaseUrl,
        HOSPEDA_REDIS_URL: redisUrl,
        HOSPEDA_API_URL: apiUrl,
        HOSPEDA_SITE_URL: webUrl,
        HOSPEDA_ADMIN_URL: adminUrl,
        HOSPEDA_BETTER_AUTH_URL: `${apiUrl}/api/auth`,
        HOSPEDA_MAILER_HOST: options.mailpitSmtpHost ?? 'localhost',
        HOSPEDA_MAILER_PORT: String(options.mailpitSmtpPort ?? 1025),
        API_PORT: String(apiPort),
        ...(options.extraEnv ?? {})
    };

    const processes: ChildProcess[] = [];

    const start = (cwd: string, command: string, args: string[]): ChildProcess => {
        const child = spawn(command, args, {
            cwd,
            env: e2eEnv,
            stdio: ['ignore', 'inherit', 'inherit'],
            shell: false
        });
        processes.push(child);
        return child;
    };

    start(`${REPO_ROOT}/apps/api`, 'node', ['dist/index.js']);
    start(`${REPO_ROOT}/apps/admin`, 'node', ['.output/server/index.mjs']);
    start(`${REPO_ROOT}/apps/web`, 'pnpm', ['exec', 'astro', 'preview', '--port', String(webPort)]);

    try {
        await Promise.all([
            waitForHealthy(`${apiUrl}/health`, readyTimeoutMs),
            waitForHealthy(`${webUrl}/api/health`, readyTimeoutMs),
            waitForHealthy(`${adminUrl}/api/health`, readyTimeoutMs)
        ]);
    } catch (error) {
        await teardown(processes);
        throw error;
    }

    return {
        apiUrl,
        webUrl,
        adminUrl,
        teardown: () => teardown(processes)
    };
}

async function runTurboBuild(): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(
            'pnpm',
            [
                'exec',
                'turbo',
                'run',
                'build',
                '--filter=hospeda-api',
                '--filter=hospeda-admin',
                '--filter=hospeda-web'
            ],
            { cwd: REPO_ROOT, stdio: 'inherit', shell: false }
        );
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`turbo build failed with exit code ${code}`));
        });
        child.on('error', reject);
    });
}

async function waitForHealthy(url: string, timeoutMs: number): Promise<void> {
    const start = Date.now();
    let lastError: unknown;
    while (Date.now() - start < timeoutMs) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
            lastError = new Error(`Health check ${url} returned status ${response.status}`);
        } catch (error) {
            lastError = error;
        }
        await sleep(HEALTH_POLL_INTERVAL_MS);
    }
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Timed out waiting for ${url} after ${timeoutMs}ms (last error: ${message})`);
}

async function teardown(processes: ChildProcess[]): Promise<void> {
    await Promise.all(
        processes.map(
            (child) =>
                new Promise<void>((resolve) => {
                    if (child.exitCode !== null || child.killed) {
                        resolve();
                        return;
                    }
                    const onClose = () => resolve();
                    child.once('close', onClose);
                    child.kill('SIGTERM');
                    setTimeout(() => {
                        if (child.exitCode === null && !child.killed) {
                            child.kill('SIGKILL');
                        }
                    }, 5_000);
                })
        )
    );
}
