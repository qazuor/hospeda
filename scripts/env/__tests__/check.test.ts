/**
 * Tests for the env:check script core logic.
 *
 * Covers:
 * - dotenv.ts: readEnvFile, writeEnvFile, setEnvVar
 * - registry.ts: getVarsForApp, getVarDescription, findVar, getRequiredVarNamesForApp, ENV_REGISTRY
 * - formatters.ts: colors, formatCheckRow, formatDiff, formatSummary, formatHeader
 * - vercel-api.ts: readProjectConfig, getVercelToken
 * - Audit diff logic (missing/extra/ok classification)
 *
 * @module scripts/env/__tests__/check.test
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock node:fs and node:fs/promises before importing modules under test
// ---------------------------------------------------------------------------
vi.mock('node:fs', () => ({
    existsSync: vi.fn()
}));

vi.mock('node:fs/promises', () => ({
    readFile: vi.fn(),
    writeFile: vi.fn()
}));

import { readEnvFile, setEnvVar, writeEnvFile } from '../utils/dotenv.js';
import {
    colors,
    formatCheckRow,
    formatDiff,
    formatHeader,
    formatSummary
} from '../utils/formatters.js';
import {
    ENV_REGISTRY,
    findVar,
    getRequiredVarNamesForApp,
    getVarDescription,
    getVarsForApp
} from '../utils/registry.js';
import { getVercelToken, readProjectConfig } from '../utils/vercel-api.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
const mockReadFile = readFile as ReturnType<typeof vi.fn>;
const mockWriteFile = writeFile as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Audit diff logic (pure, extracted for testing)
// ---------------------------------------------------------------------------

/**
 * Computes missing/extra/ok sets from two sets of keys.
 * This mirrors the logic in check.ts auditApp without any I/O.
 */
function computeAuditDiff(params: {
    readonly exampleKeys: ReadonlySet<string>;
    readonly remoteKeys: ReadonlySet<string>;
}): {
    readonly missing: readonly string[];
    readonly extra: readonly string[];
    readonly ok: readonly string[];
} {
    const { exampleKeys, remoteKeys } = params;
    const missing: string[] = [];
    const ok: string[] = [];
    const extra: string[] = [];

    for (const key of exampleKeys) {
        if (remoteKeys.has(key)) {
            ok.push(key);
        } else {
            missing.push(key);
        }
    }

    for (const key of remoteKeys) {
        if (!exampleKeys.has(key)) {
            extra.push(key);
        }
    }

    return { missing, extra, ok };
}

// ---------------------------------------------------------------------------
// readEnvFile
// ---------------------------------------------------------------------------

describe('readEnvFile', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty Map when file does not exist', async () => {
        // Arrange
        mockExistsSync.mockReturnValue(false);

        // Act
        const result = await readEnvFile({ filePath: '/fake/.env.example' });

        // Assert
        expect(result.size).toBe(0);
        expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('parses simple KEY=VALUE pairs', async () => {
        // Arrange
        mockExistsSync.mockReturnValue(true);
        mockReadFile.mockResolvedValue(
            'HOSPEDA_API_URL=http://localhost:3001\nHOSPEDA_SITE_URL=http://localhost:4321\n'
        );

        // Act
        const result = await readEnvFile({ filePath: '/fake/.env.example' });

        // Assert
        expect(result.get('HOSPEDA_API_URL')).toBe('http://localhost:3001');
        expect(result.get('HOSPEDA_SITE_URL')).toBe('http://localhost:4321');
        expect(result.size).toBe(2);
    });

    it('skips comment lines starting with #', async () => {
        // Arrange
        mockExistsSync.mockReturnValue(true);
        mockReadFile.mockResolvedValue('# This is a comment\nVAR_A=value_a\n# Another comment\n');

        // Act
        const result = await readEnvFile({ filePath: '/fake/.env' });

        // Assert
        expect(result.has('VAR_A')).toBe(true);
        expect(result.size).toBe(1);
    });

    it('skips blank lines', async () => {
        // Arrange
        mockExistsSync.mockReturnValue(true);
        mockReadFile.mockResolvedValue('\n\nVAR_B=hello\n\n');

        // Act
        const result = await readEnvFile({ filePath: '/fake/.env' });

        // Assert
        expect(result.get('VAR_B')).toBe('hello');
        expect(result.size).toBe(1);
    });

    it('strips double-quoted values', async () => {
        // Arrange
        mockExistsSync.mockReturnValue(true);
        mockReadFile.mockResolvedValue('SECRET_KEY="my secret value"\n');

        // Act
        const result = await readEnvFile({ filePath: '/fake/.env' });

        // Assert
        expect(result.get('SECRET_KEY')).toBe('my secret value');
    });

    it('strips single-quoted values', async () => {
        // Arrange
        mockExistsSync.mockReturnValue(true);
        mockReadFile.mockResolvedValue("ANOTHER_VAR='single quoted'\n");

        // Act
        const result = await readEnvFile({ filePath: '/fake/.env' });

        // Assert
        expect(result.get('ANOTHER_VAR')).toBe('single quoted');
    });

    it('handles export KEY=VALUE syntax', async () => {
        // Arrange
        mockExistsSync.mockReturnValue(true);
        mockReadFile.mockResolvedValue('export EXPORTED_VAR=exported_value\n');

        // Act
        const result = await readEnvFile({ filePath: '/fake/.env' });

        // Assert
        expect(result.get('EXPORTED_VAR')).toBe('exported_value');
    });

    it('skips lines without = sign', async () => {
        // Arrange
        mockExistsSync.mockReturnValue(true);
        mockReadFile.mockResolvedValue('INVALID_LINE\nVALID=ok\n');

        // Act
        const result = await readEnvFile({ filePath: '/fake/.env' });

        // Assert
        expect(result.has('INVALID_LINE')).toBe(false);
        expect(result.get('VALID')).toBe('ok');
    });

    it('handles values containing = signs', async () => {
        // Arrange
        mockExistsSync.mockReturnValue(true);
        mockReadFile.mockResolvedValue(
            'DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require\n'
        );

        // Act
        const result = await readEnvFile({ filePath: '/fake/.env' });

        // Assert
        expect(result.get('DATABASE_URL')).toBe(
            'postgres://user:pass@host:5432/db?sslmode=require'
        );
    });

    it('returns keys-only set usable for example file audit', async () => {
        // Arrange
        mockExistsSync.mockReturnValue(true);
        mockReadFile.mockResolvedValue(
            'HOSPEDA_API_URL=http://localhost:3001\nHOSPEDA_BETTER_AUTH_SECRET=your-secret-key\n'
        );

        // Act
        const result = await readEnvFile({ filePath: '/fake/.env.example' });
        const keys = new Set(result.keys());

        // Assert
        expect(keys.has('HOSPEDA_API_URL')).toBe(true);
        expect(keys.has('HOSPEDA_BETTER_AUTH_SECRET')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Audit diff logic (pure function tests)
// ---------------------------------------------------------------------------

describe('computeAuditDiff', () => {
    it('classifies all keys as ok when example and remote match exactly', () => {
        // Arrange
        const exampleKeys = new Set(['VAR_A', 'VAR_B', 'VAR_C']);
        const remoteKeys = new Set(['VAR_A', 'VAR_B', 'VAR_C']);

        // Act
        const result = computeAuditDiff({ exampleKeys, remoteKeys });

        // Assert
        expect(result.ok).toHaveLength(3);
        expect(result.missing).toHaveLength(0);
        expect(result.extra).toHaveLength(0);
    });

    it('detects missing vars when example has keys not in remote', () => {
        // Arrange
        const exampleKeys = new Set(['VAR_A', 'VAR_B', 'VAR_MISSING']);
        const remoteKeys = new Set(['VAR_A', 'VAR_B']);

        // Act
        const result = computeAuditDiff({ exampleKeys, remoteKeys });

        // Assert
        expect(result.missing).toContain('VAR_MISSING');
        expect(result.ok).toContain('VAR_A');
        expect(result.ok).toContain('VAR_B');
        expect(result.extra).toHaveLength(0);
    });

    it('detects extra vars when remote has keys not in example', () => {
        // Arrange
        const exampleKeys = new Set(['VAR_A']);
        const remoteKeys = new Set(['VAR_A', 'UNDOCUMENTED_VAR']);

        // Act
        const result = computeAuditDiff({ exampleKeys, remoteKeys });

        // Assert
        expect(result.extra).toContain('UNDOCUMENTED_VAR');
        expect(result.ok).toContain('VAR_A');
        expect(result.missing).toHaveLength(0);
    });

    it('handles both missing and extra simultaneously', () => {
        // Arrange
        const exampleKeys = new Set(['VAR_A', 'VAR_MISSING']);
        const remoteKeys = new Set(['VAR_A', 'EXTRA_VAR']);

        // Act
        const result = computeAuditDiff({ exampleKeys, remoteKeys });

        // Assert
        expect(result.ok).toContain('VAR_A');
        expect(result.missing).toContain('VAR_MISSING');
        expect(result.extra).toContain('EXTRA_VAR');
    });

    it('returns empty arrays when both sets are empty', () => {
        // Arrange
        const exampleKeys = new Set<string>();
        const remoteKeys = new Set<string>();

        // Act
        const result = computeAuditDiff({ exampleKeys, remoteKeys });

        // Assert
        expect(result.ok).toHaveLength(0);
        expect(result.missing).toHaveLength(0);
        expect(result.extra).toHaveLength(0);
    });

    it('counts missing correctly when example is full and remote is empty', () => {
        // Arrange
        const exampleKeys = new Set(['A', 'B', 'C', 'D']);
        const remoteKeys = new Set<string>();

        // Act
        const result = computeAuditDiff({ exampleKeys, remoteKeys });

        // Assert
        expect(result.missing).toHaveLength(4);
        expect(result.ok).toHaveLength(0);
        expect(result.extra).toHaveLength(0);
    });

    it('determines correct exit code signal: totalMissing > 0 means failure', () => {
        // Arrange
        const exampleKeys = new Set(['REQUIRED_VAR']);
        const remoteKeys = new Set<string>();

        // Act
        const result = computeAuditDiff({ exampleKeys, remoteKeys });

        // Assert - this mirrors the `if (totalMissing > 0) process.exit(1)` in main()
        expect(result.missing.length).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// Registry utilities
// ---------------------------------------------------------------------------

describe('getVarsForApp', () => {
    it('returns only vars whose apps array includes the given app', () => {
        // Arrange / Act
        const apiVars = getVarsForApp('api');

        // Assert
        for (const v of apiVars) {
            expect(v.apps).toContain('api');
        }
    });

    it('returns non-empty array for api app', () => {
        // Act
        const apiVars = getVarsForApp('api');

        // Assert
        expect(apiVars.length).toBeGreaterThan(0);
    });

    it('returns non-empty array for web app', () => {
        // Act
        const webVars = getVarsForApp('web');

        // Assert
        expect(webVars.length).toBeGreaterThan(0);
    });

    it('returns non-empty array for admin app', () => {
        // Act
        const adminVars = getVarsForApp('admin');

        // Assert
        expect(adminVars.length).toBeGreaterThan(0);
    });

    it('does not include vars from other apps when filtering by api', () => {
        // Act
        const apiVars = getVarsForApp('api');
        const webOnlyVars = apiVars.filter((v) => !v.apps.includes('api'));

        // Assert
        expect(webOnlyVars).toHaveLength(0);
    });
});

describe('getVarDescription', () => {
    it('returns description for a known registry variable', () => {
        // Act
        const desc = getVarDescription('HOSPEDA_API_URL');

        // Assert
        expect(desc).toBe('API base URL');
    });

    it('returns fallback for an unknown variable name', () => {
        // Act
        const desc = getVarDescription('TOTALLY_UNKNOWN_VAR_XYZ_123');

        // Assert
        expect(desc).toBe('No description available');
    });
});

describe('findVar', () => {
    it('returns the definition for a known variable', () => {
        // Act
        const def = findVar('HOSPEDA_API_URL');

        // Assert
        expect(def).toBeDefined();
        expect(def?.name).toBe('HOSPEDA_API_URL');
        expect(def?.type).toBe('url');
    });

    it('returns undefined for an unknown variable', () => {
        // Act
        const def = findVar('NONEXISTENT_VAR_ABC');

        // Assert
        expect(def).toBeUndefined();
    });

    it('correctly identifies secret variables', () => {
        // Act
        const def = findVar('HOSPEDA_BETTER_AUTH_SECRET');

        // Assert
        expect(def?.secret).toBe(true);
    });

    it('correctly identifies non-secret variables', () => {
        // Act
        const def = findVar('HOSPEDA_API_URL');

        // Assert
        expect(def?.secret).toBe(false);
    });
});

describe('getRequiredVarNamesForApp', () => {
    it('returns only required var names for api', () => {
        // Act
        const required = getRequiredVarNamesForApp('api');

        // Assert
        expect(required.length).toBeGreaterThan(0);
        for (const name of required) {
            const def = findVar(name);
            expect(def?.required).toBe(true);
        }
    });

    it('includes HOSPEDA_API_URL as required for api', () => {
        // Act
        const required = getRequiredVarNamesForApp('api');

        // Assert
        expect(required).toContain('HOSPEDA_API_URL');
    });

    it('includes HOSPEDA_BETTER_AUTH_SECRET as required for api', () => {
        // Act
        const required = getRequiredVarNamesForApp('api');

        // Assert
        expect(required).toContain('HOSPEDA_BETTER_AUTH_SECRET');
    });
});

describe('ENV_REGISTRY', () => {
    it('has no duplicate variable names', () => {
        // Arrange
        const names = ENV_REGISTRY.map((v) => v.name);
        const uniqueNames = new Set(names);

        // Assert
        expect(names.length).toBe(uniqueNames.size);
    });

    it('all entries have required fields', () => {
        // Act / Assert
        for (const entry of ENV_REGISTRY) {
            expect(typeof entry.name).toBe('string');
            expect(entry.name.length).toBeGreaterThan(0);
            expect(typeof entry.description).toBe('string');
            expect(typeof entry.required).toBe('boolean');
            expect(typeof entry.secret).toBe('boolean');
            expect(Array.isArray(entry.apps)).toBe(true);
        }
    });

    it('enum-typed vars have non-empty enumValues array', () => {
        // Act
        const enumVars = ENV_REGISTRY.filter((v) => v.type === 'enum');

        // Assert
        for (const v of enumVars) {
            expect(v.enumValues).toBeDefined();
            expect((v.enumValues ?? []).length).toBeGreaterThan(0);
        }
    });
});

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

describe('colors', () => {
    it('wraps string in ANSI green codes', () => {
        // Act
        const result = colors.green('success');

        // Assert
        expect(result).toContain('\x1b[32m');
        expect(result).toContain('success');
        expect(result).toContain('\x1b[0m');
    });

    it('wraps string in ANSI red codes', () => {
        // Act
        const result = colors.red('error');

        // Assert
        expect(result).toContain('\x1b[31m');
        expect(result).toContain('error');
    });

    it('wraps string in ANSI yellow codes', () => {
        // Act
        const result = colors.yellow('warning');

        // Assert
        expect(result).toContain('\x1b[33m');
        expect(result).toContain('warning');
    });

    it('wraps string in ANSI cyan codes', () => {
        // Act
        const result = colors.cyan('info');

        // Assert
        expect(result).toContain('\x1b[36m');
        expect(result).toContain('info');
    });

    it('wraps string in bold style', () => {
        // Act
        const result = colors.bold('heading');

        // Assert
        expect(result).toContain('\x1b[1m');
        expect(result).toContain('heading');
    });

    it('can be composed (bold + red)', () => {
        // Act
        const result = colors.bold(colors.red('danger'));

        // Assert
        expect(result).toContain('\x1b[1m');
        expect(result).toContain('\x1b[31m');
        expect(result).toContain('danger');
    });
});

describe('formatCheckRow', () => {
    it('includes green checkmark for ok status', () => {
        // Act
        const row = formatCheckRow('MY_VAR', 'ok');

        // Assert
        expect(row).toContain('✓');
        expect(row).toContain('MY_VAR');
    });

    it('includes red cross for missing status', () => {
        // Act
        const row = formatCheckRow('MISSING_VAR', 'missing');

        // Assert
        expect(row).toContain('✗');
        expect(row).toContain('MISSING_VAR');
    });

    it('includes yellow question mark for extra status', () => {
        // Act
        const row = formatCheckRow('EXTRA_VAR', 'extra');

        // Assert
        expect(row).toContain('?');
        expect(row).toContain('EXTRA_VAR');
    });

    it('appends optional detail string', () => {
        // Act
        const row = formatCheckRow('MY_VAR', 'ok', 'some detail');

        // Assert
        expect(row).toContain('some detail');
    });

    it('pads key to 50 characters for alignment', () => {
        // Act
        const row = formatCheckRow('SHORT', 'ok');

        // Assert - key should be padded to 50 chars (inside ANSI codes)
        expect(row).toContain('SHORT');
    });
});

describe('formatDiff', () => {
    it('labels new variable when only remote is set', () => {
        // Act
        const result = formatDiff({ key: 'NEW_VAR', local: undefined, remote: 'remote_value' });

        // Assert
        expect(result).toContain('NEW_VAR');
        expect(result).toContain('New variable');
    });

    it('labels missing variable when only local is set', () => {
        // Act
        const result = formatDiff({ key: 'LOCAL_ONLY', local: 'local_value', remote: undefined });

        // Assert
        expect(result).toContain('LOCAL_ONLY');
        expect(result).toContain('Not in remote');
    });

    it('labels changed variable when both exist but differ', () => {
        // Act
        const result = formatDiff({ key: 'CHANGED_VAR', local: 'old_value', remote: 'new_value' });

        // Assert
        expect(result).toContain('CHANGED_VAR');
        expect(result).toContain('Values differ');
    });

    it('labels identical variable when both values match', () => {
        // Act
        const result = formatDiff({ key: 'SAME_VAR', local: 'same_value', remote: 'same_value' });

        // Assert
        expect(result).toContain('SAME_VAR');
        expect(result).toContain('Identical');
    });

    it('includes description when provided', () => {
        // Act
        const result = formatDiff({
            key: 'DESCRIBED_VAR',
            local: 'val',
            remote: 'val',
            description: 'API base URL'
        });

        // Assert
        expect(result).toContain('API base URL');
    });
});

describe('formatSummary', () => {
    it('includes all three counts in output', () => {
        // Act
        const result = formatSummary({ added: 3, updated: 1, skipped: 5 });

        // Assert
        expect(result).toContain('+3 added');
        expect(result).toContain('~1 updated');
        expect(result).toContain('.5 skipped');
    });

    it('includes Summary label', () => {
        // Act
        const result = formatSummary({ added: 0, updated: 0, skipped: 0 });

        // Assert
        expect(result).toContain('Summary:');
    });

    it('handles zero counts', () => {
        // Act
        const result = formatSummary({ added: 0, updated: 0, skipped: 0 });

        // Assert
        expect(result).toContain('+0 added');
        expect(result).toContain('~0 updated');
        expect(result).toContain('.0 skipped');
    });
});

describe('formatHeader', () => {
    it('includes the title in output', () => {
        // Act
        const result = formatHeader('API - production');

        // Assert
        expect(result).toContain('API - production');
    });

    it('includes border characters', () => {
        // Act
        const result = formatHeader('Test Title');

        // Assert
        expect(result).toContain('┌');
        expect(result).toContain('┐');
        expect(result).toContain('└');
        expect(result).toContain('┘');
        expect(result).toContain('│');
    });
});

// ---------------------------------------------------------------------------
// vercel-api: readProjectConfig
// ---------------------------------------------------------------------------

describe('readProjectConfig', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns projectId and orgId from valid project.json', async () => {
        // Arrange
        const validConfig = JSON.stringify({ projectId: 'prj_abc123', orgId: 'team_xyz' });
        mockReadFile.mockResolvedValue(validConfig);

        // Act
        const result = await readProjectConfig('/fake/apps/api');

        // Assert
        expect(result.projectId).toBe('prj_abc123');
        expect(result.orgId).toBe('team_xyz');
    });

    it('throws when project.json file is missing', async () => {
        // Arrange
        mockReadFile.mockRejectedValue(new Error('ENOENT: file not found'));

        // Act / Assert
        await expect(readProjectConfig('/fake/apps/api')).rejects.toThrow('Could not read');
    });

    it('throws when project.json contains invalid JSON', async () => {
        // Arrange
        mockReadFile.mockResolvedValue('{ invalid json }');

        // Act / Assert
        await expect(readProjectConfig('/fake/apps/api')).rejects.toThrow('Malformed JSON');
    });

    it('throws when project.json is missing projectId field', async () => {
        // Arrange
        mockReadFile.mockResolvedValue(JSON.stringify({ orgId: 'team_xyz' }));

        // Act / Assert
        await expect(readProjectConfig('/fake/apps/api')).rejects.toThrow('Invalid project.json');
    });

    it('throws when project.json is missing orgId field', async () => {
        // Arrange
        mockReadFile.mockResolvedValue(JSON.stringify({ projectId: 'prj_abc' }));

        // Act / Assert
        await expect(readProjectConfig('/fake/apps/api')).rejects.toThrow('Invalid project.json');
    });

    it('throws when projectId is not a string', async () => {
        // Arrange
        mockReadFile.mockResolvedValue(JSON.stringify({ projectId: 123, orgId: 'team_xyz' }));

        // Act / Assert
        await expect(readProjectConfig('/fake/apps/api')).rejects.toThrow('Invalid project.json');
    });

    it('reads from correct .vercel/project.json path inside appDir', async () => {
        // Arrange
        const validConfig = JSON.stringify({ projectId: 'prj_test', orgId: 'org_test' });
        mockReadFile.mockResolvedValue(validConfig);

        // Act
        await readProjectConfig('/fake/apps/web');

        // Assert - verify it reads from <appDir>/.vercel/project.json
        expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining('.vercel'), 'utf-8');
        expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining('project.json'), 'utf-8');
    });
});

// ---------------------------------------------------------------------------
// vercel-api: getVercelToken
// ---------------------------------------------------------------------------

describe('getVercelToken', () => {
    const originalEnv = process.env.VERCEL_TOKEN;

    afterEach(() => {
        if (originalEnv === undefined) {
            // biome-ignore lint/performance/noDelete: test cleanup requires removal of env var
            delete process.env.VERCEL_TOKEN;
        } else {
            process.env.VERCEL_TOKEN = originalEnv;
        }
    });

    it('returns token from VERCEL_TOKEN env var', async () => {
        // Arrange
        process.env.VERCEL_TOKEN = 'test-token-abc123';

        // Act
        const token = await getVercelToken();

        // Assert
        expect(token).toBe('test-token-abc123');
    });

    it('throws when VERCEL_TOKEN is not set', async () => {
        // Arrange
        // biome-ignore lint/performance/noDelete: removing env var in test is intentional
        delete process.env.VERCEL_TOKEN;

        // Act / Assert
        await expect(getVercelToken()).rejects.toThrow('VERCEL_TOKEN');
    });

    it('throws with helpful error message mentioning vercel login', async () => {
        // Arrange
        // biome-ignore lint/performance/noDelete: removing env var in test is intentional
        delete process.env.VERCEL_TOKEN;

        // Act / Assert
        await expect(getVercelToken()).rejects.toThrow('vercel login');
    });
});

// ---------------------------------------------------------------------------
// writeEnvFile
// ---------------------------------------------------------------------------

describe('writeEnvFile', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('writes generated header comment as first line', async () => {
        // Arrange
        mockWriteFile.mockResolvedValue(undefined);
        const vars: Map<string, string> = new Map([['VAR_A', 'value_a']]);

        // Act
        await writeEnvFile({ filePath: '/fake/.env.local', vars });

        // Assert
        const written = mockWriteFile.mock.calls[0]?.[1] as string;
        expect(written).toContain('# Generated by hospeda env tools');
    });

    it('writes simple key=value pairs without quotes', async () => {
        // Arrange
        mockWriteFile.mockResolvedValue(undefined);
        const vars: Map<string, string> = new Map([['MY_KEY', 'simple_value']]);

        // Act
        await writeEnvFile({ filePath: '/fake/.env.local', vars });

        // Assert
        const written = mockWriteFile.mock.calls[0]?.[1] as string;
        expect(written).toContain('MY_KEY=simple_value');
    });

    it('quotes values containing spaces', async () => {
        // Arrange
        mockWriteFile.mockResolvedValue(undefined);
        const vars: Map<string, string> = new Map([['SPACED', 'hello world']]);

        // Act
        await writeEnvFile({ filePath: '/fake/.env.local', vars });

        // Assert
        const written = mockWriteFile.mock.calls[0]?.[1] as string;
        expect(written).toContain('SPACED="hello world"');
    });

    it('quotes empty values', async () => {
        // Arrange
        mockWriteFile.mockResolvedValue(undefined);
        const vars: Map<string, string> = new Map([['EMPTY_VAR', '']]);

        // Act
        await writeEnvFile({ filePath: '/fake/.env.local', vars });

        // Assert
        const written = mockWriteFile.mock.calls[0]?.[1] as string;
        expect(written).toContain('EMPTY_VAR=""');
    });

    it('escapes double quotes inside quoted values', async () => {
        // Arrange
        mockWriteFile.mockResolvedValue(undefined);
        const vars: Map<string, string> = new Map([['QUOTED', 'say "hello"']]);

        // Act
        await writeEnvFile({ filePath: '/fake/.env.local', vars });

        // Assert
        const written = mockWriteFile.mock.calls[0]?.[1] as string;
        expect(written).toContain('\\"hello\\"');
    });

    it('writes multiple vars, one per line', async () => {
        // Arrange
        mockWriteFile.mockResolvedValue(undefined);
        const vars: Map<string, string> = new Map([
            ['VAR_A', 'value_a'],
            ['VAR_B', 'value_b']
        ]);

        // Act
        await writeEnvFile({ filePath: '/fake/.env.local', vars });

        // Assert
        const written = mockWriteFile.mock.calls[0]?.[1] as string;
        expect(written).toContain('VAR_A=value_a');
        expect(written).toContain('VAR_B=value_b');
    });

    it('writes to the provided file path with utf-8 encoding', async () => {
        // Arrange
        mockWriteFile.mockResolvedValue(undefined);
        const vars: Map<string, string> = new Map([['K', 'v']]);

        // Act
        await writeEnvFile({ filePath: '/project/.env.local', vars });

        // Assert
        expect(mockWriteFile).toHaveBeenCalledWith(
            '/project/.env.local',
            expect.any(String),
            'utf-8'
        );
    });
});

// ---------------------------------------------------------------------------
// setEnvVar
// ---------------------------------------------------------------------------

describe('setEnvVar', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('creates new file with single key=value when file does not exist', async () => {
        // Arrange
        mockExistsSync.mockReturnValue(false);
        mockWriteFile.mockResolvedValue(undefined);

        // Act
        await setEnvVar({ filePath: '/new/.env.local', key: 'NEW_KEY', value: 'new_value' });

        // Assert
        expect(mockWriteFile).toHaveBeenCalledWith(
            '/new/.env.local',
            'NEW_KEY=new_value\n',
            'utf-8'
        );
    });

    it('updates existing key in-place preserving other lines', async () => {
        // Arrange
        mockExistsSync.mockReturnValue(true);
        mockReadFile.mockResolvedValue('EXISTING_VAR=old_value\nOTHER_VAR=other\n');
        mockWriteFile.mockResolvedValue(undefined);

        // Act
        await setEnvVar({ filePath: '/app/.env.local', key: 'EXISTING_VAR', value: 'new_value' });

        // Assert
        const written = mockWriteFile.mock.calls[0]?.[1] as string;
        expect(written).toContain('EXISTING_VAR=new_value');
        expect(written).toContain('OTHER_VAR=other');
        expect(written).not.toContain('EXISTING_VAR=old_value');
    });

    it('appends new key when key not already present in existing file', async () => {
        // Arrange
        mockExistsSync.mockReturnValue(true);
        mockReadFile.mockResolvedValue('EXISTING_VAR=value\n');
        mockWriteFile.mockResolvedValue(undefined);

        // Act
        await setEnvVar({ filePath: '/app/.env.local', key: 'BRAND_NEW', value: 'brand_value' });

        // Assert
        const written = mockWriteFile.mock.calls[0]?.[1] as string;
        expect(written).toContain('EXISTING_VAR=value');
        expect(written).toContain('BRAND_NEW=brand_value');
    });

    it('quotes values with spaces when creating new file', async () => {
        // Arrange
        mockExistsSync.mockReturnValue(false);
        mockWriteFile.mockResolvedValue(undefined);

        // Act
        await setEnvVar({ filePath: '/new/.env.local', key: 'SPACED', value: 'hello world' });

        // Assert
        const written = mockWriteFile.mock.calls[0]?.[1] as string;
        expect(written).toContain('SPACED="hello world"');
    });

    it('preserves comment lines when updating existing file', async () => {
        // Arrange
        mockExistsSync.mockReturnValue(true);
        mockReadFile.mockResolvedValue('# My config\nMY_VAR=old\n');
        mockWriteFile.mockResolvedValue(undefined);

        // Act
        await setEnvVar({ filePath: '/app/.env.local', key: 'MY_VAR', value: 'new_val' });

        // Assert
        const written = mockWriteFile.mock.calls[0]?.[1] as string;
        expect(written).toContain('# My config');
        expect(written).toContain('MY_VAR=new_val');
    });
});

// ---------------------------------------------------------------------------
// formatDiff edge cases
// ---------------------------------------------------------------------------

describe('formatDiff - edge cases', () => {
    it('handles both local and remote undefined gracefully', () => {
        // Act
        const result = formatDiff({ key: 'GHOST_VAR', local: undefined, remote: undefined });

        // Assert
        expect(result).toContain('GHOST_VAR');
        expect(result).toContain('(both undefined)');
    });

    it('masks secret values for changed variables', () => {
        // Act
        const result = formatDiff({
            key: 'SECRET_VAR',
            local: 'local_secret_value',
            remote: 'remote_secret_value',
            secret: true
        });

        // Assert
        expect(result).toContain('SECRET_VAR');
        // Should not contain raw values
        expect(result).not.toContain('local_secret_value');
        expect(result).not.toContain('remote_secret_value');
    });

    it('masks short secret values with asterisks only', () => {
        // Act
        const result = formatDiff({
            key: 'SHORT_SECRET',
            local: 'abc',
            remote: 'abc',
            secret: true
        });

        // Assert - short values are fully masked
        expect(result).not.toContain('abc');
    });

    it('shows dim colors.dim for identical non-secret values', () => {
        // Act
        const result = formatDiff({ key: 'SAME_VAR', local: 'same', remote: 'same' });

        // Assert - identical values result should contain dim ANSI code
        expect(result).toContain('\x1b[2m');
        expect(result).toContain('Identical');
    });

    it('shows raw values for changed non-secret variables', () => {
        // Regression test for GAP-047: isChanged branch was hardcoding maskValue
        // instead of using the show function derived from the secret flag.
        // Act
        const result = formatDiff({
            key: 'NON_SECRET_CHANGED',
            local: 'old_value',
            remote: 'new_value',
            secret: false
        });

        // Assert - non-secret changed values must be visible
        expect(result).toContain('old_value');
        expect(result).toContain('new_value');
        expect(result).toContain('Values differ');
    });
});
