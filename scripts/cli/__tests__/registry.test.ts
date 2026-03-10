import { describe, expect, it } from 'vitest';
import { CATEGORY_DISPLAY_ORDER } from '../categories.js';
import { getCuratedCommands } from '../registry.js';
import type { CommandCategory } from '../types.js';

const DANGEROUS_IDS = new Set([
    'db:reset',
    'db:fresh',
    'db:fresh-dev',
    'db:migrate:prod',
    'db:push',
    'env:push',
    'clean'
]);

const REQUIRED_IDS = ['db:start', 'dev:all', 'test', 'lint', 'build', 'env:check'];

const VALID_CATEGORIES = new Set<CommandCategory>(CATEGORY_DISPLAY_ORDER);

describe('getCuratedCommands', () => {
    it('should return exactly 46 commands', () => {
        const commands = getCuratedCommands();
        expect(commands).toHaveLength(46);
    });

    it('should have no duplicate IDs', () => {
        const commands = getCuratedCommands();
        const ids = commands.map((c) => c.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have dangerMessage set on all 7 dangerous commands', () => {
        const commands = getCuratedCommands();
        const dangerousCommands = commands.filter((c) => DANGEROUS_IDS.has(c.id));

        expect(dangerousCommands).toHaveLength(7);

        for (const cmd of dangerousCommands) {
            expect(cmd.dangerous).toBe(true);
            expect(typeof cmd.dangerMessage).toBe('string');
            expect((cmd.dangerMessage ?? '').length).toBeGreaterThan(0);
        }
    });

    it('should have all required fields on every command', () => {
        const commands = getCuratedCommands();

        for (const cmd of commands) {
            expect(typeof cmd.id).toBe('string');
            expect(cmd.id.length).toBeGreaterThan(0);

            expect(typeof cmd.description).toBe('string');
            expect(cmd.description.length).toBeGreaterThan(0);

            expect(typeof cmd.category).toBe('string');

            expect(cmd.execution).toBeDefined();
            expect(['pnpm-root', 'pnpm-filter', 'shell']).toContain(cmd.execution.type);

            expect(typeof cmd.source).toBe('string');
            expect(cmd.source.length).toBeGreaterThan(0);

            expect(['one-shot', 'long-running', 'interactive']).toContain(cmd.mode);
        }
    });

    it('should have description length <= 60 chars for all commands', () => {
        const commands = getCuratedCommands();

        for (const cmd of commands) {
            expect(cmd.description.length).toBeLessThanOrEqual(60);
        }
    });

    it('should have only valid CommandCategory values', () => {
        const commands = getCuratedCommands();

        for (const cmd of commands) {
            expect(VALID_CATEGORIES.has(cmd.category)).toBe(true);
        }
    });

    it.each(REQUIRED_IDS)('should contain the required command: %s', (id) => {
        const commands = getCuratedCommands();
        const found = commands.find((c) => c.id === id);
        expect(found).toBeDefined();
    });

    it('should mark all curated commands as curated=true', () => {
        const commands = getCuratedCommands();

        for (const cmd of commands) {
            expect(cmd.curated).toBe(true);
        }
    });

    it('should have valid execution shape for pnpm-root commands', () => {
        const commands = getCuratedCommands();
        const pnpmRoot = commands.filter((c) => c.execution.type === 'pnpm-root');

        for (const cmd of pnpmRoot) {
            if (cmd.execution.type === 'pnpm-root') {
                expect(typeof cmd.execution.script).toBe('string');
                expect(cmd.execution.script.length).toBeGreaterThan(0);
            }
        }
    });

    it('should have valid execution shape for pnpm-filter commands', () => {
        const commands = getCuratedCommands();
        const pnpmFilter = commands.filter((c) => c.execution.type === 'pnpm-filter');

        for (const cmd of pnpmFilter) {
            if (cmd.execution.type === 'pnpm-filter') {
                expect(typeof cmd.execution.filter).toBe('string');
                expect(cmd.execution.filter.length).toBeGreaterThan(0);
                expect(typeof cmd.execution.script).toBe('string');
                expect(cmd.execution.script.length).toBeGreaterThan(0);
            }
        }
    });

    it('should have valid execution shape for shell commands', () => {
        const commands = getCuratedCommands();
        const shellCmds = commands.filter((c) => c.execution.type === 'shell');

        for (const cmd of shellCmds) {
            if (cmd.execution.type === 'shell') {
                expect(typeof cmd.execution.command).toBe('string');
                expect(cmd.execution.command.length).toBeGreaterThan(0);
            }
        }
    });
});
