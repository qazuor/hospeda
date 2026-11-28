/**
 * @file RichTextEditor.enable-dynamic-blocks.test.tsx
 *
 * HOS-2685: the `enableDynamicBlocks` prop. The default must leave the
 * newsletter editor unchanged; `false` removes the dynamic block entirely.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    buildEditorExtensions,
    NEWSLETTER_EDITOR_EXTENSIONS,
    PLAIN_EDITOR_EXTENSIONS,
    RichTextEditor
} from './RichTextEditor';

const INSERT_LABEL = 'admin-newsletter.dynamicBlock.insert';

describe('RichTextEditor enableDynamicBlocks', () => {
    it('shows the insert button by default (newsletter unchanged)', () => {
        render(
            <RichTextEditor
                value={null}
                onChange={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: INSERT_LABEL })).toBeInTheDocument();
    });

    it('shows the insert button when explicitly enabled', () => {
        render(
            <RichTextEditor
                value={null}
                onChange={vi.fn()}
                enableDynamicBlocks
            />
        );

        expect(screen.getByRole('button', { name: INSERT_LABEL })).toBeInTheDocument();
    });

    it('hides the insert button but keeps the formatting toolbar when disabled', () => {
        render(
            <RichTextEditor
                value={null}
                onChange={vi.fn()}
                enableDynamicBlocks={false}
            />
        );

        expect(screen.queryByRole('button', { name: INSERT_LABEL })).not.toBeInTheDocument();
        expect(screen.getByRole('toolbar')).toBeInTheDocument();
        expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(11);
    });

    it('builds an extension set without the dynamic block or its custom document', () => {
        const names = buildEditorExtensions({
            enableDynamicBlocks: false,
            onEdit: vi.fn()
        }).map((extension) => extension.name);

        expect(names).not.toContain('dynamicBlock');
        expect(PLAIN_EDITOR_EXTENSIONS).toBe(
            buildEditorExtensions({ enableDynamicBlocks: false, onEdit: vi.fn() })
        );
    });

    it('builds the newsletter set (same extension names) when enabled', () => {
        const names = buildEditorExtensions({
            enableDynamicBlocks: true,
            onEdit: vi.fn()
        }).map((extension) => extension.name);

        expect(names).toEqual(NEWSLETTER_EDITOR_EXTENSIONS.map((extension) => extension.name));
        expect(names).toContain('dynamicBlock');
    });
});
