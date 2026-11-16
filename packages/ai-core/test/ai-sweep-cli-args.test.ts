/**
 * Tests for the fail-closed sweep command line (HOS-2217): a malformed numeric
 * flag must never turn the hard call cap into NaN (which disables it), and
 * `--api-key-file` must never reach a provider with a custom baseURL.
 */

import { describe, expect, it } from 'vitest';
import {
    CliArgError,
    readFlag,
    readPositiveIntFlag,
    resolveProviderKey
} from '../scripts/ai-sweep/cli-args.js';

describe('HOS-2217 readPositiveIntFlag', () => {
    it('reads a positive integer and returns null when the flag is absent', () => {
        // Act
        const present = readPositiveIntFlag({ argv: ['--max-calls', '40'], flag: '--max-calls' });
        const absent = readPositiveIntFlag({ argv: ['--features', 'chat'], flag: '--max-calls' });

        // Assert
        expect(present.value).toBe(40);
        expect(absent.value).toBeNull();
    });

    it.each([
        ['abc'],
        ['0'],
        ['-3'],
        ['1.5'],
        ['1e3'],
        [' 7'],
        ['99999999999999999999']
    ])('rejects %j', (raw) => {
        // Act
        const run = () =>
            readPositiveIntFlag({ argv: ['--concurrency', raw], flag: '--concurrency' });

        // Assert
        expect(run).toThrow(CliArgError);
    });

    it('rejects a flag whose "value" is another flag (--max-calls --execute)', () => {
        // Act
        const run = () =>
            readPositiveIntFlag({ argv: ['--max-calls', '--execute'], flag: '--max-calls' });

        // Assert
        expect(run).toThrow(/got the flag "--execute"/);
    });

    it('rejects a trailing flag without a value', () => {
        // Act
        const run = () => readPositiveIntFlag({ argv: ['--max-calls'], flag: '--max-calls' });

        // Assert
        expect(run).toThrow(/needs a value/);
    });
});

describe('HOS-2217 readFlag', () => {
    it('rejects a path flag followed by another flag', () => {
        // Act
        const run = () =>
            readFlag({ argv: ['--results', '--grades', 'g.json'], flag: '--results' });

        // Assert
        expect(run).toThrow(CliArgError);
    });

    it('reads a plain value', () => {
        // Act
        const { value } = readFlag({ argv: ['--features', 'chat,search'], flag: '--features' });

        // Assert
        expect(value).toBe('chat,search');
    });
});

describe('HOS-2217 resolveProviderKey', () => {
    const env = { OPENAI_API_KEY: 'env-openai', NAN_API_KEY: 'env-nan' };

    it('applies --api-key-file to a first-party provider (no baseURL)', () => {
        // Act
        const r = resolveProviderKey({
            provider: { id: 'openai', apiKeyEnv: 'OPENAI_API_KEY' },
            keyFileContent: ' file-key \n',
            env
        });

        // Assert
        expect(r.apiKey).toBe('file-key');
        expect(r.source).toBe('--api-key-file');
    });

    it('never sends the key file to a provider with a custom baseURL', () => {
        // Act
        const r = resolveProviderKey({
            provider: {
                id: 'nan',
                apiKeyEnv: 'NAN_API_KEY',
                baseURL: 'https://nan.example.com/v1'
            },
            keyFileContent: 'file-key',
            env
        });

        // Assert
        expect(r.apiKey).toBe('env-nan');
        expect(r.source).toBe('env var NAN_API_KEY');
    });

    it('returns null for an empty key file or an unset env var', () => {
        // Act
        const emptyFile = resolveProviderKey({
            provider: { id: 'openai', apiKeyEnv: 'OPENAI_API_KEY' },
            keyFileContent: '  \n',
            env
        });
        const unset = resolveProviderKey({
            provider: { id: 'x', apiKeyEnv: 'MISSING', baseURL: 'https://x.example.com' },
            keyFileContent: null,
            env
        });

        // Assert
        expect(emptyFile.apiKey).toBeNull();
        expect(unset.apiKey).toBeNull();
    });
});
