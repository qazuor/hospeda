/**
 * Container resolution by Coolify label, image name, or exposed port.
 * Never relies on the Coolify-generated UUID prefix because those
 * change on every redeploy.
 *
 * The lookup chain for each "kind" of container tries strategies in
 * order, returning the first single match:
 *
 *   1. Coolify application label (most reliable for app containers).
 *   2. Image ancestor (reliable for postgres/redis where the image is
 *      pinned and rarely changes).
 *   3. Exposed-port filter (last resort — depends on the docker-compose
 *      shape Coolify generates).
 *
 * If a kind matches MORE than one container, the resolver fails loud:
 * we never want to pick "the first one" by accident in production.
 */

import { dockerInspectLabels, dockerPs } from './docker.ts';

/**
 * The set of container roles the toolkit knows about. Add new entries
 * here when introducing tools for additional services.
 */
export type ContainerKind = 'api' | 'web' | 'admin' | 'postgres' | 'redis' | 'coolify';

/**
 * One lookup strategy. Returns a list of container names that matched.
 * Empty array means "this strategy didn't find anything; try the next".
 */
type Strategy = () => Promise<ReadonlyArray<string>>;

/**
 * Per-kind configuration. The label-based strategies need the actual
 * `coolify.resourceName` value used in the Coolify UI; those are pulled
 * from env vars so an operator can override per environment (staging,
 * preview, etc.) without code changes.
 *
 * The label key set was confirmed against a real Coolify v4.0.0 deploy
 * (Hospeda VPS, 2026-05-08): each application container carries
 * `coolify.resourceName` (the human-readable name visible in the UI) and
 * `coolify.serviceName` (same value in this version). `coolify.name`
 * holds the application UUID, NOT the human name — do not use it for
 * label-based lookup.
 *
 * `excludeNamePrefixes` is a fail-safe used by the image / port
 * strategies: Coolify deploys its own Postgres + Redis for its metadata
 * store (`coolify-db`, `coolify-redis`, …) on the same Docker daemon,
 * which would otherwise collide with the user-managed services. Every
 * Coolify infrastructure container is named with the literal `coolify-`
 * prefix, so excluding it cleanly separates infra from workload.
 */
const KIND_CONFIG: Readonly<
    Record<
        ContainerKind,
        {
            readonly resourceNameEnv?: string;
            readonly resourceNameDefault?: string;
            readonly imagePatterns?: ReadonlyArray<string>;
            readonly exposedPort?: number;
            readonly nameFallback?: string;
            readonly excludeNamePrefixes?: ReadonlyArray<string>;
        }
    >
> = {
    api: {
        resourceNameEnv: 'HCTL_APP_RESOURCE_API',
        resourceNameDefault: 'hospeda-api-prod',
        exposedPort: 3001
    },
    web: {
        resourceNameEnv: 'HCTL_APP_RESOURCE_WEB',
        resourceNameDefault: 'hospeda-web-prod',
        exposedPort: 4321
    },
    admin: {
        resourceNameEnv: 'HCTL_APP_RESOURCE_ADMIN',
        resourceNameDefault: 'hospeda-admin-prod',
        exposedPort: 3000
    },
    postgres: {
        // Coolify-managed Postgres services do not always carry an
        // application-style resourceName label — fall back to the image
        // pin first, then the standard exposed port. Exclude `coolify-*`
        // so we never accidentally pick Coolify's internal metadata DB.
        imagePatterns: ['postgres:17', 'postgres:16', 'postgres:15'],
        exposedPort: 5432,
        excludeNamePrefixes: ['coolify-', 'coolify']
    },
    redis: {
        imagePatterns: ['redis:7'],
        exposedPort: 6379,
        excludeNamePrefixes: ['coolify-', 'coolify']
    },
    coolify: {
        nameFallback: 'coolify'
    }
};

/**
 * The Coolify label keys we look up, in the order Coolify v4 publishes
 * them on application containers. `resourceName` is the primary key
 * (matches the UI), `serviceName` is the secondary fallback (same value
 * in v4.0.0 but kept separate so older / newer versions still work).
 */
const COOLIFY_NAME_LABEL_KEYS: ReadonlyArray<string> = [
    'coolify.resourceName',
    'coolify.serviceName'
];

async function strategyByLabel(resourceName: string): Promise<ReadonlyArray<string>> {
    // Try each known label key — at least one will hit on Coolify v4+.
    const matches = new Set<string>();
    for (const key of COOLIFY_NAME_LABEL_KEYS) {
        const rows = await dockerPs({
            format: '{{.Names}}',
            filters: [`label=${key}=${resourceName}`]
        });
        for (const row of rows) {
            matches.add(row);
        }
    }
    return [...matches];
}

async function strategyByImage(
    patterns: ReadonlyArray<string>,
    excludeNamePrefixes: ReadonlyArray<string> = []
): Promise<ReadonlyArray<string>> {
    const rows = await dockerPs({ format: '{{.Names}}\t{{.Image}}' });
    return rows
        .map((line) => line.split('\t'))
        .filter((parts): parts is [string, string] => parts.length === 2)
        .filter(([, image]) => patterns.some((p) => image.startsWith(p)))
        .filter(([name]) => !excludeNamePrefixes.some((p) => name.startsWith(p)))
        .map(([name]) => name);
}

async function strategyByExposedPort(
    port: number,
    excludeNamePrefixes: ReadonlyArray<string> = []
): Promise<ReadonlyArray<string>> {
    const matches = await dockerPs({
        format: '{{.Names}}',
        filters: [`expose=${port}`]
    });
    if (excludeNamePrefixes.length === 0) return matches;
    return matches.filter((name) => !excludeNamePrefixes.some((p) => name.startsWith(p)));
}

async function strategyByNamePrefix(prefix: string): Promise<ReadonlyArray<string>> {
    const rows = await dockerPs({ format: '{{.Names}}' });
    return rows.filter((name) => name.startsWith(prefix));
}

/**
 * Run a single strategy and reject ambiguity. Returns:
 *   - undefined when the strategy found 0 matches (caller falls through).
 *   - the single matching name when there is exactly 1.
 *   - throws when there are 2+ matches (we refuse to guess).
 */
async function tryStrategy(label: string, strategy: Strategy): Promise<string | undefined> {
    const matches = await strategy();
    if (matches.length === 0) return undefined;
    if (matches.length === 1) return matches[0];
    throw new Error(
        `Lookup '${label}' found ${matches.length} matching containers, refusing to pick one:\n${matches.map((m) => `  - ${m}`).join('\n')}`
    );
}

/**
 * Resolve a container kind to a single running container name.
 *
 * Throws when no strategy matches, or when a strategy finds multiple
 * containers (we never silently pick).
 */
export async function findContainer(kind: ContainerKind): Promise<string> {
    const config = KIND_CONFIG[kind];

    // Strategy 1: Coolify resource-name label, when applicable.
    if (config.resourceNameEnv && config.resourceNameDefault) {
        const labelValue = process.env[config.resourceNameEnv] ?? config.resourceNameDefault;
        const found = await tryStrategy(`label=${labelValue}`, () => strategyByLabel(labelValue));
        if (found) return found;
    }

    // Strategy 2: image ancestor.
    if (config.imagePatterns) {
        const patterns = config.imagePatterns;
        const exclude = config.excludeNamePrefixes ?? [];
        const found = await tryStrategy(`image~=${patterns[0]}`, () =>
            strategyByImage(patterns, exclude)
        );
        if (found) return found;
    }

    // Strategy 3: exposed port.
    if (config.exposedPort !== undefined) {
        const port = config.exposedPort;
        const exclude = config.excludeNamePrefixes ?? [];
        const found = await tryStrategy(`expose=${port}`, () =>
            strategyByExposedPort(port, exclude)
        );
        if (found) return found;
    }

    // Strategy 4: name prefix (used by 'coolify' since the orchestrator
    // doesn't carry the same labels as the apps it deploys).
    if (config.nameFallback) {
        const nameFallback = config.nameFallback;
        const found = await tryStrategy(`name~=${nameFallback}`, () =>
            strategyByNamePrefix(nameFallback)
        );
        if (found) return found;
    }

    throw new Error(
        `No running container resolves to kind '${kind}'. Strategies tried in order:\n${
            config.resourceNameDefault
                ? `  - Coolify resourceName label '${config.resourceNameDefault}'\n`
                : ''
        }${
            config.imagePatterns
                ? `  - image starts-with ${config.imagePatterns.join(' / ')}\n`
                : ''
        }${config.exposedPort ? `  - exposed port ${config.exposedPort}\n` : ''}${config.nameFallback ? `  - name starts-with '${config.nameFallback}'\n` : ''}Run \`hctl docker-by-name <prefix>\` to inspect what is running and adjust KIND_CONFIG in scripts/server-tools/src/lib/container-lookup.ts.`
    );
}

/**
 * Read the application UUID from a container's labels. Coolify's REST
 * API addresses applications by UUID (the `coolify.name` label). Use
 * this when you've already resolved a container and need to call
 * Coolify endpoints that take a `?uuid=...` parameter (deploy, env, …).
 */
export async function getApplicationUuid(container: string): Promise<string> {
    const labels = await dockerInspectLabels(container);
    const uuid = labels['coolify.name'];
    if (!uuid) {
        throw new Error(
            `Container '${container}' does not carry a 'coolify.name' label — cannot resolve to a Coolify application UUID.`
        );
    }
    return uuid;
}

/**
 * Verbose variant that reports which strategy hit. Useful for debugging
 * misconfigured environments (`hctl find api --verbose`).
 */
export async function findContainerVerbose(kind: ContainerKind): Promise<{
    readonly name: string;
    readonly strategy: string;
    readonly labels: Readonly<Record<string, string>>;
}> {
    const name = await findContainer(kind);
    const labels = await dockerInspectLabels(name);
    const labelHit = COOLIFY_NAME_LABEL_KEYS.find((key) => labels[key]);
    const strategy = labelHit
        ? `label:${labelHit}=${labels[labelHit]}`
        : 'fallback (image/port/name)';
    return { name, strategy, labels };
}
