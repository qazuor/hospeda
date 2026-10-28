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
 * The fallbacks (2, 3) exist for single-environment, non-Coolify setups.
 * They can never return a container that carries another resource's
 * Coolify label (HOS-1950): prod and staging share ports and images, so a
 * fallback that ignored labels resolved the OTHER target whenever the
 * requested one was stopped.
 *
 * If a kind matches MORE than one container, the resolver fails loud:
 * we never want to pick "the first one" by accident in production.
 */

import { dockerInspectLabels, dockerPs } from './docker.ts';
import { log } from './log.ts';
import { getAppResourceName, getDbResourceName, type Target } from './target.ts';

/**
 * The set of container roles the toolkit knows about. Add new entries
 * here when introducing tools for additional services.
 */
export type ContainerKind = 'api' | 'web' | 'admin' | 'postgres' | 'redis' | 'coolify';

/**
 * Current target environment for resolution. Set once during CLI startup
 * by {@link setActiveTarget}. Commands then call `findContainer(kind)`
 * without needing to thread the target through every callsite.
 *
 * Single-invocation contract (SPEC-103 T-054):
 *
 * This module-level variable assumes EXACTLY ONE `hops` command runs per
 * process. `src/index.ts` resolves the target (from `--target=` flag or,
 * for default-ok commands, `HOPS_DEFAULT_TARGET`), calls `setActiveTarget`
 * once, then dispatches a single command before exiting. The variable is
 * NOT reset between commands.
 *
 * If a future invocation pattern needs to run multiple commands in a
 * single process (e.g. an interactive shell, an HTTP server wrapper, or
 * a batch driver), this assumption breaks: the second command would
 * inherit the first command's target unless the caller explicitly
 * resets via `setActiveTarget('prod')` before dispatch. The correct
 * fix in that case is to refactor `findContainer(kind, target)` so the
 * target is threaded through every callsite — the module state then
 * disappears entirely. Until that pattern actually exists, the simpler
 * single-invocation contract is preferred (less plumbing, easier to
 * reason about).
 */
let activeTarget: Target | undefined;

/**
 * Override the target used by subsequent {@link findContainer} calls.
 * Called by `src/index.ts` after parsing the `--target=<env>` flag.
 * See the JSDoc on {@link activeTarget} for the single-invocation
 * contract this function relies on.
 */
export function setActiveTarget(target: Target): void {
    activeTarget = target;
}

/**
 * Current active target (for diagnostic / verbose output).
 *
 * @throws when called before {@link setActiveTarget} — this indicates a
 * dispatch bug where a command that uses the target was invoked without
 * target resolution. Commands with `targetPolicy: 'none'` must NEVER call
 * this function (they have no prod/staging concept).
 */
export function getActiveTarget(): Target {
    if (activeTarget === undefined) {
        throw new Error(
            'active target not set — internal dispatch bug (command missing target resolution)'
        );
    }
    return activeTarget;
}

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
/**
 * Resolve the `coolify.resourceName` label value to look up for a given
 * (kind, target) pair. Apps use stable hardcoded names; DBs use
 * UUID-suffixed names sourced from env vars (UUIDs differ per Coolify
 * deployment).
 *
 * Returns `undefined` for kinds that don't have a label-based resolution
 * path (e.g. `coolify` infrastructure container).
 */
function resolveResourceName(kind: ContainerKind, target: Target): string | undefined {
    switch (kind) {
        case 'api':
        case 'web':
        case 'admin':
            return getAppResourceName(target, kind);
        case 'postgres':
        case 'redis':
            return getDbResourceName(target, kind);
        case 'coolify':
            return undefined;
    }
}

const KIND_CONFIG: Readonly<
    Record<
        ContainerKind,
        {
            readonly imagePatterns?: ReadonlyArray<string>;
            readonly exposedPort?: number;
            readonly nameFallback?: string;
            readonly excludeNamePrefixes?: ReadonlyArray<string>;
        }
    >
> = {
    api: {
        exposedPort: 3001
    },
    web: {
        exposedPort: 4321
    },
    admin: {
        exposedPort: 3000
    },
    postgres: {
        // Image patterns + exposed port are fallbacks only — with two
        // Postgres services (prod + staging) running on the same daemon,
        // image / port strategies match BOTH and fail loud. Label
        // resolution via target-aware resourceName is the only reliable
        // path; the fallbacks remain for single-environment setups.
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

/**
 * Narrow view of the docker CLI the resolver needs. Injected so the
 * resolution rules (and above all the cross-target guard) are unit-testable
 * without a docker daemon. Production code uses {@link REAL_DOCKER}.
 */
export interface DockerQueryPort {
    /** `docker ps --format <fmt> [--filter ...]` over RUNNING containers. */
    readonly ps: (params: {
        readonly format: string;
        readonly filters?: ReadonlyArray<string>;
    }) => Promise<ReadonlyArray<string>>;
    /** `docker inspect <name>` → `Config.Labels` (empty object when none). */
    readonly inspectLabels: (container: string) => Promise<Readonly<Record<string, string>>>;
}

const REAL_DOCKER: DockerQueryPort = {
    ps: dockerPs,
    inspectLabels: dockerInspectLabels
};

async function strategyByLabel(
    docker: DockerQueryPort,
    resourceName: string
): Promise<ReadonlyArray<string>> {
    // Try each known label key — at least one will hit on Coolify v4+.
    const matches = new Set<string>();
    for (const key of COOLIFY_NAME_LABEL_KEYS) {
        const rows = await docker.ps({
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
    docker: DockerQueryPort,
    patterns: ReadonlyArray<string>,
    excludeNamePrefixes: ReadonlyArray<string> = []
): Promise<ReadonlyArray<string>> {
    const rows = await docker.ps({ format: '{{.Names}}\t{{.Image}}' });
    return rows
        .map((line) => line.split('\t'))
        .filter((parts): parts is [string, string] => parts.length === 2)
        .filter(([, image]) => patterns.some((p) => image.startsWith(p)))
        .filter(([name]) => !excludeNamePrefixes.some((p) => name.startsWith(p)))
        .map(([name]) => name);
}

async function strategyByExposedPort(
    docker: DockerQueryPort,
    port: number,
    excludeNamePrefixes: ReadonlyArray<string> = []
): Promise<ReadonlyArray<string>> {
    const matches = await docker.ps({
        format: '{{.Names}}',
        filters: [`expose=${port}`]
    });
    if (excludeNamePrefixes.length === 0) return matches;
    return matches.filter((name) => !excludeNamePrefixes.some((p) => name.startsWith(p)));
}

async function strategyByNamePrefix(
    docker: DockerQueryPort,
    prefix: string
): Promise<ReadonlyArray<string>> {
    const rows = await docker.ps({ format: '{{.Names}}' });
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
 * Read the Coolify resource name a container carries, if any. Returns
 * `undefined` for a container that is not a Coolify-managed resource.
 */
function readResourceLabel(labels: Readonly<Record<string, string>>): string | undefined {
    for (const key of COOLIFY_NAME_LABEL_KEYS) {
        const value = labels[key];
        if (value) return value;
    }
    return undefined;
}

/**
 * Outcome of {@link resolveContainer}.
 */
export interface ResolvedContainer {
    /** Running container name. */
    readonly name: string;
    /** Which strategy produced the match (`label`, `image`, `port`, `name`). */
    readonly strategy: 'label' | 'image' | 'port' | 'name';
    /** The container's Coolify resource label, `undefined` when it has none. */
    readonly resourceLabel: string | undefined;
    /** Every label on the container (for `hops find --verbose`). */
    readonly labels: Readonly<Record<string, string>>;
}

/**
 * Central cross-target guard (HOS-1950). A container that the label
 * strategy did NOT select is only acceptable when it is not a Coolify
 * resource at all (a single-environment / non-Coolify setup, which is what
 * the image / port fallbacks exist for). A container carrying ANY Coolify
 * resource label other than the one the target expects belongs to some
 * other resource — on the VPS that is the same app of the OTHER target,
 * because prod and staging expose the same ports (api 3001, web 4321,
 * admin 3000) and run the same images. Returning it would make
 * `hops --target=staging redeploy api` redeploy production.
 *
 * @throws when the container carries a foreign Coolify resource label.
 */
function assertNotForeignResource(params: {
    readonly kind: ContainerKind;
    readonly target: Target;
    readonly expectedLabel: string;
    readonly name: string;
    readonly foundLabel: string | undefined;
    readonly strategy: string;
}): void {
    const { kind, target, expectedLabel, name, foundLabel, strategy } = params;
    if (foundLabel === undefined || foundLabel === expectedLabel) return;
    throw new Error(
        `No running container carries the Coolify label '${expectedLabel}' (kind '${kind}', target '${target}'). ` +
            `The ${strategy} fallback matched '${name}', but that container belongs to '${foundLabel}', ` +
            `not to target '${target}' — refusing to act on another target's container.\n` +
            `Is the '${target}' ${kind} stopped in Coolify? Run \`hops docker-by-name hospeda\` to inspect what is running.`
    );
}

/**
 * Resolve a container kind for a target to a single running container.
 *
 * Pure with respect to docker: everything goes through the injected
 * {@link DockerQueryPort}, so the rules are unit-testable.
 *
 * Rules:
 *   - The Coolify resource label of the target always wins.
 *   - The image / port / name fallbacks may run when the label finds
 *     nothing, but their result passes through
 *     {@link assertNotForeignResource}: a container labelled for any OTHER
 *     resource (e.g. the other target) is an error, never an answer.
 *   - Ambiguity (2+ matches in one strategy) is an error.
 *
 * @throws when nothing resolves, when a strategy is ambiguous, or when a
 * fallback lands on a container of another resource / target.
 */
export async function resolveContainer(params: {
    readonly kind: ContainerKind;
    readonly target: Target;
    readonly docker: DockerQueryPort;
}): Promise<ResolvedContainer> {
    const { kind, target, docker } = params;
    const config = KIND_CONFIG[kind];
    const labelValue = resolveResourceName(kind, target);

    const finish = async (
        name: string,
        strategy: ResolvedContainer['strategy']
    ): Promise<ResolvedContainer> => {
        const labels = await docker.inspectLabels(name);
        const resourceLabel = readResourceLabel(labels);
        if (labelValue !== undefined) {
            assertNotForeignResource({
                kind,
                target,
                expectedLabel: labelValue,
                name,
                foundLabel: resourceLabel,
                strategy
            });
        }
        return { name, strategy, resourceLabel, labels };
    };

    // Strategy 1: Coolify resource-name label, when applicable.
    if (labelValue) {
        const found = await tryStrategy(`label=${labelValue}`, () =>
            strategyByLabel(docker, labelValue)
        );
        if (found) return finish(found, 'label');
    }

    // Strategy 2: image ancestor.
    if (config.imagePatterns) {
        const patterns = config.imagePatterns;
        const exclude = config.excludeNamePrefixes ?? [];
        const found = await tryStrategy(`image~=${patterns[0]}`, () =>
            strategyByImage(docker, patterns, exclude)
        );
        if (found) return finish(found, 'image');
    }

    // Strategy 3: exposed port.
    if (config.exposedPort !== undefined) {
        const port = config.exposedPort;
        const exclude = config.excludeNamePrefixes ?? [];
        const found = await tryStrategy(`expose=${port}`, () =>
            strategyByExposedPort(docker, port, exclude)
        );
        if (found) return finish(found, 'port');
    }

    // Strategy 4: name prefix (used by 'coolify' since the orchestrator
    // doesn't carry the same labels as the apps it deploys).
    if (config.nameFallback) {
        const nameFallback = config.nameFallback;
        const found = await tryStrategy(`name~=${nameFallback}`, () =>
            strategyByNamePrefix(docker, nameFallback)
        );
        if (found) return finish(found, 'name');
    }

    throw new Error(
        `No running container resolves to kind '${kind}' for target '${target}'. Strategies tried in order:\n${
            labelValue ? `  - Coolify resourceName label '${labelValue}'\n` : ''
        }${
            config.imagePatterns
                ? `  - image starts-with ${config.imagePatterns.join(' / ')}\n`
                : ''
        }${config.exposedPort ? `  - exposed port ${config.exposedPort}\n` : ''}${config.nameFallback ? `  - name starts-with '${config.nameFallback}'\n` : ''}Run \`hops docker-by-name <prefix>\` to inspect what is running. To switch target, pass \`--target=prod|staging\` or set HOPS_DEFAULT_TARGET in .env.local.`
    );
}

/**
 * One-line, human-readable description of a resolution, printed by every
 * command that resolves a container so the operator always sees WHICH
 * container (and which target's label) a command is about to act on.
 */
export function formatResolution(params: {
    readonly kind: ContainerKind;
    readonly target: Target;
    readonly resolved: ResolvedContainer;
}): string {
    const { kind, target, resolved } = params;
    const label = resolved.resourceLabel ?? 'no coolify label';
    const via = resolved.strategy === 'label' ? '' : ` (via ${resolved.strategy} fallback)`;
    return `Resolved ${kind} (${target}) → container ${resolved.name} [${label}]${via}`;
}

/**
 * Resolve a container kind for the active target to a single running
 * container name, and print the resolution to stderr.
 *
 * Throws when no strategy matches, when a strategy finds multiple
 * containers (we never silently pick), or when a fallback lands on a
 * container that belongs to another target (see {@link resolveContainer}).
 */
export async function findContainer(kind: ContainerKind): Promise<string> {
    const target = getActiveTarget();
    const resolved = await resolveContainer({ kind, target, docker: REAL_DOCKER });
    if (resolved.strategy === 'label') {
        log.info(formatResolution({ kind, target, resolved }));
    } else {
        log.warn(formatResolution({ kind, target, resolved }));
    }
    return resolved.name;
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
 * misconfigured environments (`hops find api --verbose`).
 */
export async function findContainerVerbose(kind: ContainerKind): Promise<{
    readonly name: string;
    readonly strategy: string;
    readonly labels: Readonly<Record<string, string>>;
}> {
    const target = getActiveTarget();
    const resolved = await resolveContainer({ kind, target, docker: REAL_DOCKER });
    log.info(formatResolution({ kind, target, resolved }));
    const strategy =
        resolved.strategy === 'label'
            ? `label=${resolved.resourceLabel ?? ''}`
            : `fallback (${resolved.strategy})`;
    return { name: resolved.name, strategy, labels: resolved.labels };
}
