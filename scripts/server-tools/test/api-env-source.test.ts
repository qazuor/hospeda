/**
 * Unit tests for the api environment source (HOS-1962).
 *
 * The cutover passes through a window with the api STOPPED. These tests pin
 * that the wrappers then read the environment from Coolify, that ambiguity
 * still aborts, and that `env-list`'s UUID lookup never touches a container.
 * Ports are in-memory fakes: no docker, no network. Values are fake.
 */

import { describe, expect, it } from 'bun:test';
import {
    type CoolifyEnvPort,
    coolifyEnvToEntries,
    resolveApiEnv,
    resolveAppUuidByName
} from '../src/lib/api-env-source.ts';
import { ContainerNotRunningError } from '../src/lib/container-lookup.ts';
import type { CoolifyApplication, CoolifyEnvVar } from '../src/lib/coolify.ts';

const RESOURCE = 'hospeda-api-prod';

function fakeCoolify(input: {
    readonly apps?: ReadonlyArray<CoolifyApplication>;
    readonly vars?: ReadonlyArray<CoolifyEnvVar>;
}): CoolifyEnvPort & { readonly calls: string[] } {
    const calls: string[] = [];
    return {
        calls,
        listApplications: async () => {
            calls.push('listApplications');
            return input.apps ?? [{ uuid: 'app-prod', name: RESOURCE }];
        },
        listEnvVars: async (uuid) => {
            calls.push(`listEnvVars:${uuid}`);
            return input.vars ?? [];
        }
    };
}

const notRunning = async (): Promise<ReadonlyArray<string>> => {
    throw new ContainerNotRunningError('No running container resolves to kind api');
};

describe('resolveApiEnv', () => {
    it('reads the running container and never calls Coolify', async () => {
        // Arrange
        const coolify = fakeCoolify({});
        // Act
        const result = await resolveApiEnv({
            readFromContainer: async () => ['HOSPEDA_X=1'],
            coolify: () => coolify,
            resourceName: RESOURCE,
            warn: () => {}
        });
        // Assert
        expect(result).toEqual({ entries: ['HOSPEDA_X=1'], source: 'container' });
        expect(coolify.calls).toEqual([]);
    });

    it('falls back to the Coolify env when the api container is not running', async () => {
        // Arrange
        const coolify = fakeCoolify({
            vars: [
                { uuid: '1', key: 'HOSPEDA_X', value: 'live' },
                { uuid: '2', key: 'HOSPEDA_X', value: 'preview', is_preview: true },
                { uuid: '3', key: 'HOSPEDA_EMPTY', value: '' },
                { uuid: '4', key: 'HOSPEDA_HIDDEN', value: null }
            ]
        });
        const warnings: string[] = [];
        // Act
        const result = await resolveApiEnv({
            readFromContainer: notRunning,
            coolify: () => coolify,
            resourceName: RESOURCE,
            warn: (m) => warnings.push(m)
        });
        // Assert
        expect(result).toEqual({ entries: ['HOSPEDA_X=live'], source: 'coolify' });
        expect(coolify.calls).toEqual(['listApplications', 'listEnvVars:app-prod']);
        expect(warnings.length).toBe(1);
    });

    it('still aborts on an ambiguous container lookup instead of falling back', async () => {
        // Arrange
        const coolify = fakeCoolify({});
        const ambiguous = async (): Promise<ReadonlyArray<string>> => {
            throw new Error(
                "Lookup 'expose=3001' found 2 matching containers, refusing to pick one"
            );
        };
        // Act
        const run = resolveApiEnv({
            readFromContainer: ambiguous,
            coolify: () => coolify,
            resourceName: RESOURCE,
            warn: () => {}
        });
        // Assert
        await expect(run).rejects.toThrow('refusing to pick one');
        expect(coolify.calls).toEqual([]);
    });

    it('fails loudly when the fallback yields no values (token without read:sensitive)', async () => {
        // Arrange
        const coolify = fakeCoolify({ vars: [{ uuid: '1', key: 'HOSPEDA_X', value: null }] });
        // Act
        const run = resolveApiEnv({
            readFromContainer: notRunning,
            coolify: () => coolify,
            resourceName: RESOURCE,
            warn: () => {}
        });
        // Assert
        await expect(run).rejects.toThrow('read:sensitive');
    });
});

describe('resolveAppUuidByName', () => {
    it('resolves by exact name and ignores other targets', async () => {
        // Arrange
        const coolify = fakeCoolify({
            apps: [
                { uuid: 'app-staging', name: 'hospeda-api-staging' },
                { uuid: 'app-prod', name: RESOURCE }
            ]
        });
        // Act
        const uuid = await resolveAppUuidByName({ coolify, resourceName: RESOURCE });
        // Assert
        expect(uuid).toBe('app-prod');
    });

    it('throws when the app is missing or the name is duplicated', async () => {
        // Arrange / Act / Assert
        await expect(
            resolveAppUuidByName({ coolify: fakeCoolify({ apps: [] }), resourceName: RESOURCE })
        ).rejects.toThrow('no application named');
        await expect(
            resolveAppUuidByName({
                coolify: fakeCoolify({
                    apps: [
                        { uuid: 'a', name: RESOURCE },
                        { uuid: 'b', name: RESOURCE }
                    ]
                }),
                resourceName: RESOURCE
            })
        ).rejects.toThrow('refusing to pick one');
    });
});

describe('coolifyEnvToEntries', () => {
    it('keeps values containing "=" verbatim', () => {
        expect(coolifyEnvToEntries([{ uuid: '1', key: 'K', value: 'a=b=c' }])).toEqual(['K=a=b=c']);
    });
});

describe('env-list', () => {
    it('does not resolve any container (HOS-1962)', async () => {
        // Arrange
        const source = await Bun.file(`${import.meta.dir}/../src/commands/env-list.ts`).text();
        // Act / Assert
        expect(source).not.toContain('findContainer');
        expect(source).not.toContain('getApplicationUuid');
        expect(source).toContain('resolveAppUuidByName');
    });
});
