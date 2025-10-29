/**
 * Parser Tests
 * Tests for TODOs.md and PDR.md parsing functions
 */

import { describe, expect, it } from 'vitest';
import {
    parseFeatureName,
    parsePdrSummary,
    parseTodosMarkdown,
    statusToCheckbox,
    updateTaskStatus
} from '../src/parser.js';

describe('parseTodosMarkdown', () => {
    it('should parse simple tasks', () => {
        const content = `
## Tasks

- [ ] Create User model
- [~] Write tests
- [x] Complete documentation
`;

        const tasks = parseTodosMarkdown(content);

        expect(tasks).toHaveLength(3);
        expect(tasks[0]).toMatchObject({
            title: 'Create User model',
            status: 'pending'
        });
        expect(tasks[1]).toMatchObject({
            title: 'Write tests',
            status: 'in_progress'
        });
        expect(tasks[2]).toMatchObject({
            title: 'Complete documentation',
            status: 'completed'
        });
    });

    it('should parse tasks with descriptions', () => {
        const content = `
- [ ] Implement User model
  > Extend BaseModel with CRUD operations
  > Include validation methods
`;

        const tasks = parseTodosMarkdown(content);

        expect(tasks).toHaveLength(1);
        expect(tasks[0].description).toBe(
            'Extend BaseModel with CRUD operations\nInclude validation methods'
        );
    });

    it('should generate unique IDs for tasks', () => {
        const content = `
- [ ] Task One
- [ ] Task Two
- [ ] Task One
`;

        const tasks = parseTodosMarkdown(content);

        expect(tasks).toHaveLength(3);
        // Same title = same ID (deterministic)
        expect(tasks[0].id).toBe(tasks[2].id);
        // Different title = different ID
        expect(tasks[0].id).not.toBe(tasks[1].id);
    });

    it('should handle empty content', () => {
        const tasks = parseTodosMarkdown('');
        expect(tasks).toHaveLength(0);
    });

    it('should handle malformed checkboxes', () => {
        const content = `
- Create User model
- [x] Valid task
- [ ] Another valid task
`;

        const tasks = parseTodosMarkdown(content);

        // Only valid checkboxes should be parsed
        expect(tasks).toHaveLength(2);
        expect(tasks[0].title).toBe('Valid task');
    });
});

describe('parseFeatureName', () => {
    it('should extract feature name from first heading', () => {
        const content = `
# User Authentication Feature

This is the description...
`;

        const name = parseFeatureName(content);
        expect(name).toBe('User Authentication Feature');
    });

    it('should handle PDR with multiple headings', () => {
        const content = `
# Main Feature

## Sub Heading

Some content
`;

        const name = parseFeatureName(content);
        expect(name).toBe('Main Feature');
    });

    it('should return default for content without heading', () => {
        const content = 'Just some text without heading';

        const name = parseFeatureName(content);
        expect(name).toBe('Unknown Feature');
    });
});

describe('parsePdrSummary', () => {
    it('should extract first paragraph after heading', () => {
        const content = `
# Feature Name

This is the summary paragraph.

## Section

More content...
`;

        const summary = parsePdrSummary(content);
        expect(summary).toBe('This is the summary paragraph.');
    });

    it('should handle PDR with no summary', () => {
        const content = `
# Feature Name

## Section
`;

        const summary = parsePdrSummary(content);
        expect(summary).toBe('');
    });
});

describe('statusToCheckbox', () => {
    it('should convert status to checkbox format', () => {
        expect(statusToCheckbox('pending')).toBe(' ');
        expect(statusToCheckbox('in_progress')).toBe('~');
        expect(statusToCheckbox('completed')).toBe('x');
    });
});

describe('updateTaskStatus', () => {
    it('should update task status in markdown', () => {
        const content = `
- [ ] Create User model
- [~] Write tests
- [x] Complete docs
`;

        const updated = updateTaskStatus(content, 'Write tests', 'completed');

        expect(updated).toContain('- [x] Write tests');
        expect(updated).toContain('- [ ] Create User model');
        expect(updated).toContain('- [x] Complete docs');
    });

    it('should handle tasks with special characters in title', () => {
        const content = `
- [ ] Task with (parentheses) and [brackets]
`;

        const updated = updateTaskStatus(
            content,
            'Task with (parentheses) and [brackets]',
            'completed'
        );

        expect(updated).toContain('- [x] Task with (parentheses) and [brackets]');
    });

    it('should only update matching task', () => {
        const content = `
- [ ] Create User model
- [ ] Create Admin model
- [ ] Create Guest model
`;

        const updated = updateTaskStatus(content, 'Create Admin model', 'completed');

        expect(updated).toContain('- [ ] Create User model');
        expect(updated).toContain('- [x] Create Admin model');
        expect(updated).toContain('- [ ] Create Guest model');
    });

    it('should not update if task not found', () => {
        const content = `
- [ ] Task One
- [ ] Task Two
`;

        const updated = updateTaskStatus(content, 'Task Three', 'completed');

        expect(updated).toBe(content);
    });
});
