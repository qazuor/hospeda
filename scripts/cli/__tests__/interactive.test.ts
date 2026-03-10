import { Separator } from '@inquirer/prompts';
import { describe, expect, it } from 'vitest';
import { buildChoices } from '../interactive.js';
import type { CliCommand } from '../types.js';

function makeSafeCmd(overrides: Partial<CliCommand> = {}): CliCommand {
    return {
        id: 'test-cmd',
        description: 'A test command',
        category: 'development',
        execution: { type: 'pnpm-root', script: 'test' },
        source: 'root',
        mode: 'one-shot',
        curated: true,
        ...overrides
    } as CliCommand;
}

function makeDangerousCmd(overrides: Partial<CliCommand> = {}): CliCommand {
    return {
        id: 'db:reset',
        description: 'Reset database',
        category: 'database',
        execution: { type: 'pnpm-filter', filter: '@repo/db', script: 'reset' },
        source: '@repo/db',
        mode: 'one-shot',
        curated: true,
        dangerous: true,
        dangerMessage: 'This will drop all data',
        ...overrides
    } as CliCommand;
}

describe('buildChoices', () => {
    it('should return empty array for empty commands and no recent', () => {
        // Arrange & Act
        const choices = buildChoices({ commands: [], recentIds: [] });

        // Assert
        expect(choices).toEqual([]);
    });

    it('should group curated commands by category with separators', () => {
        // Arrange
        const commands = [
            makeSafeCmd({ id: 'dev', category: 'development' }),
            makeSafeCmd({ id: 'db:start', category: 'database' })
        ];

        // Act
        const choices = buildChoices({ commands, recentIds: [] });

        // Assert
        const separators = choices.filter((c) => c instanceof Separator);
        expect(separators.length).toBeGreaterThanOrEqual(2);
    });

    it('should prepend Recent section when recentIds are provided', () => {
        // Arrange
        const commands = [makeSafeCmd({ id: 'dev' }), makeSafeCmd({ id: 'test' })];

        // Act
        const choices = buildChoices({ commands, recentIds: ['dev'] });

        // Assert - first separator should be "Recent"
        const firstSep = choices[0];
        expect(firstSep).toBeInstanceOf(Separator);
    });

    it('should skip recent IDs that are not in commands', () => {
        // Arrange
        const commands = [makeSafeCmd({ id: 'dev' })];

        // Act
        const choices = buildChoices({ commands, recentIds: ['nonexistent'] });

        // Assert - only separators (no value choices for nonexistent)
        const valueChoices = choices.filter((c) => !(c instanceof Separator) && 'value' in c);
        // "Recent" separator added but no matching command, plus the Development category with "dev"
        const devChoice = valueChoices.find((c) => 'value' in c && c.value === 'dev');
        expect(devChoice).toBeDefined();
    });

    it('should only include curated commands in category groups', () => {
        // Arrange
        const commands = [
            makeSafeCmd({ id: 'curated-dev', curated: true, category: 'development' }),
            makeSafeCmd({ id: 'discovered-dev', curated: false, category: 'development' })
        ];

        // Act
        const choices = buildChoices({ commands, recentIds: [] });

        // Assert
        const valueChoices = choices.filter((c) => !(c instanceof Separator) && 'value' in c);
        const ids = valueChoices.map((c) => ('value' in c ? c.value : ''));
        expect(ids).toContain('curated-dev');
        expect(ids).not.toContain('discovered-dev');
    });

    it('should skip empty categories', () => {
        // Arrange - only development commands, no database
        const commands = [makeSafeCmd({ id: 'dev', category: 'development' })];

        // Act
        const choices = buildChoices({ commands, recentIds: [] });

        // Assert - should not have a Database separator
        const separatorTexts = choices.filter((c) => c instanceof Separator).map((s) => String(s));
        const hasDatabaseSep = separatorTexts.some((t) => t.includes('Database'));
        expect(hasDatabaseSep).toBe(false);
    });

    it('should show ⚠ prefix for dangerous commands', () => {
        // Arrange
        const commands = [makeDangerousCmd({ id: 'db:reset', category: 'database' })];

        // Act
        const choices = buildChoices({ commands, recentIds: [] });

        // Assert
        const valueChoice = choices.find(
            (c) => !(c instanceof Separator) && 'name' in c && c.name.includes('⚠')
        );
        expect(valueChoice).toBeDefined();
    });

    it('should not show ⚠ prefix for safe commands', () => {
        // Arrange
        const commands = [makeSafeCmd({ id: 'test' })];

        // Act
        const choices = buildChoices({ commands, recentIds: [] });

        // Assert
        const valueChoices = choices.filter((c) => !(c instanceof Separator));
        for (const choice of valueChoices) {
            if ('name' in choice) {
                expect(choice.name).not.toContain('⚠');
            }
        }
    });

    it('should include source in description field of choices', () => {
        // Arrange
        const commands = [makeSafeCmd({ id: 'dev', source: '@repo/api' })];

        // Act
        const choices = buildChoices({ commands, recentIds: [] });

        // Assert
        const valueChoice = choices.find((c) => !(c instanceof Separator) && 'description' in c);
        expect(valueChoice).toBeDefined();
        if (valueChoice && 'description' in valueChoice) {
            expect(valueChoice.description).toContain('@repo/api');
        }
    });

    it('should handle multiple recent IDs in order', () => {
        // Arrange
        const commands = [
            makeSafeCmd({ id: 'first' }),
            makeSafeCmd({ id: 'second' }),
            makeSafeCmd({ id: 'third' })
        ];

        // Act
        const choices = buildChoices({ commands, recentIds: ['first', 'second'] });

        // Assert - Recent section has both commands
        const recentSepIdx = choices.findIndex((c) => c instanceof Separator);
        const firstChoiceAfterRecent = choices[recentSepIdx + 1];
        expect(firstChoiceAfterRecent).toBeDefined();
        if (firstChoiceAfterRecent && 'value' in firstChoiceAfterRecent) {
            expect(firstChoiceAfterRecent.value).toBe('first');
        }
    });
});
