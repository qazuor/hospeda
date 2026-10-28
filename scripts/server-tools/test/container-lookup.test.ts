/**
 * Unit tests for `resolveContainer` in `src/lib/container-lookup.ts`
 * (HOS-1950).
 *
 * The VPS runs prod AND staging on one docker daemon, and the two expose
 * the same ports (api 3001, web 4321, admin 3000) and the same images. The
 * trap these tests pin: with the requested target's container STOPPED, the
 * label lookup finds nothing and the old port fallback returned the OTHER
 * target's container — so `hops --target=staging redeploy api` redeployed
 * production.
 *
 * Docker is replaced by an in-memory fake that honours the two filters
 * the resolver uses (`label=<key>=<value>` and `expose=<port>`).
 */

import { describe, expect, it } from 'bun:test';
import {
    type DockerQueryPort,
    formatResolution,
    resolveContainer
} from '../src/lib/container-lookup.ts';

interface FakeContainer {
    readonly name: string;
    readonly image: string;
    readonly ports: ReadonlyArray<number>;
    readonly labels: Readonly<Record<string, string>>;
}

/** Coolify v4 publishes the resource name under both keys. */
function coolifyLabels(resourceName: string, uuid: string): Record<string, string> {
    return {
        'coolify.resourceName': resourceName,
        'coolify.serviceName': resourceName,
        'coolify.name': uuid
    };
}

function fakeDocker(running: ReadonlyArray<FakeContainer>): DockerQueryPort {
    return {
        ps: async ({ format, filters = [] }) => {
            const matching = running.filter((c) =>
                filters.every((f) => {
                    if (f.startsWith('label=')) {
                        const [key, value] = f.slice('label='.length).split('=');
                        return key !== undefined && c.labels[key] === value;
                    }
                    if (f.startsWith('expose=')) {
                        return c.ports.includes(Number(f.slice('expose='.length)));
                    }
                    throw new Error(`fake docker: unsupported filter ${f}`);
                })
            );
            return matching.map((c) =>
                format.includes('{{.Image}}') ? `${c.name}\t${c.image}` : c.name
            );
        },
        inspectLabels: async (name) => {
            const found = running.find((c) => c.name === name);
            if (!found) throw new Error(`fake docker: no such container ${name}`);
            return found.labels;
        }
    };
}

const PROD_API: FakeContainer = {
    name: 'prodapi-uuid-123',
    image: 'hospeda-api:latest',
    ports: [3001],
    labels: coolifyLabels('hospeda-api-prod', 'prod-api-app-uuid')
};

const STAGING_API: FakeContainer = {
    name: 'stagingapi-uuid-456',
    image: 'hospeda-api:latest',
    ports: [3001],
    labels: coolifyLabels('hospeda-api-staging', 'staging-api-app-uuid')
};

describe('resolveContainer — cross-target guard (HOS-1950)', () => {
    it('errors when the staging api is stopped and prod runs on the same port', async () => {
        // Arrange: only prod is running; it exposes the shared api port.
        const docker = fakeDocker([PROD_API]);

        // Act
        const attempt = resolveContainer({ kind: 'api', target: 'staging', docker });

        // Assert: an error naming target + expected label, never prod.
        await expect(attempt).rejects.toThrow(/hospeda-api-staging/);
        await expect(attempt).rejects.toThrow(/target 'staging'/);
        await expect(attempt).rejects.toThrow(/belongs to 'hospeda-api-prod'/);
    });

    it('errors symmetrically when prod is stopped and staging runs', async () => {
        const docker = fakeDocker([STAGING_API]);

        const attempt = resolveContainer({ kind: 'api', target: 'prod', docker });

        await expect(attempt).rejects.toThrow(/belongs to 'hospeda-api-staging'/);
    });

    it('errors for web/admin too: the guard is not api-specific', async () => {
        const prodWeb: FakeContainer = {
            name: 'prodweb-uuid',
            image: 'hospeda-web:latest',
            ports: [4321],
            labels: coolifyLabels('hospeda-web-prod', 'prod-web-app-uuid')
        };
        const prodAdmin: FakeContainer = {
            name: 'prodadmin-uuid',
            image: 'hospeda-admin:latest',
            ports: [3000],
            labels: coolifyLabels('hospeda-admin-prod', 'prod-admin-app-uuid')
        };
        const docker = fakeDocker([prodWeb, prodAdmin]);

        await expect(resolveContainer({ kind: 'web', target: 'staging', docker })).rejects.toThrow(
            /hospeda-web-prod/
        );
        await expect(
            resolveContainer({ kind: 'admin', target: 'staging', docker })
        ).rejects.toThrow(/hospeda-admin-prod/);
    });

    it('resolves the staging api by label when both targets are running', async () => {
        const docker = fakeDocker([PROD_API, STAGING_API]);

        const resolved = await resolveContainer({ kind: 'api', target: 'staging', docker });

        expect(resolved.name).toBe(STAGING_API.name);
        expect(resolved.strategy).toBe('label');
        expect(resolved.resourceLabel).toBe('hospeda-api-staging');
    });

    it('resolves the prod api by label when both targets are running', async () => {
        const docker = fakeDocker([STAGING_API, PROD_API]);

        const resolved = await resolveContainer({ kind: 'api', target: 'prod', docker });

        expect(resolved.name).toBe(PROD_API.name);
        expect(resolved.resourceLabel).toBe('hospeda-api-prod');
    });

    it('still accepts an UNLABELLED container on the port (non-Coolify setup)', async () => {
        const local: FakeContainer = {
            name: 'local-api',
            image: 'hospeda-api:dev',
            ports: [3001],
            labels: {}
        };
        const docker = fakeDocker([local]);

        const resolved = await resolveContainer({ kind: 'api', target: 'staging', docker });

        expect(resolved.name).toBe('local-api');
        expect(resolved.strategy).toBe('port');
        expect(resolved.resourceLabel).toBeUndefined();
    });

    it('fails with the not-found message when nothing runs at all', async () => {
        const docker = fakeDocker([]);

        await expect(resolveContainer({ kind: 'api', target: 'staging', docker })).rejects.toThrow(
            /No running container resolves to kind 'api' for target 'staging'/
        );
    });
});

describe('formatResolution', () => {
    it('names kind, target, container and label', () => {
        const line = formatResolution({
            kind: 'api',
            target: 'staging',
            resolved: {
                name: STAGING_API.name,
                strategy: 'label',
                resourceLabel: 'hospeda-api-staging',
                labels: STAGING_API.labels
            }
        });

        expect(line).toBe(
            `Resolved api (staging) → container ${STAGING_API.name} [hospeda-api-staging]`
        );
    });

    it('flags a fallback resolution and an unlabelled container', () => {
        const line = formatResolution({
            kind: 'api',
            target: 'prod',
            resolved: { name: 'local-api', strategy: 'port', resourceLabel: undefined, labels: {} }
        });

        expect(line).toBe(
            'Resolved api (prod) → container local-api [no coolify label] (via port fallback)'
        );
    });
});
