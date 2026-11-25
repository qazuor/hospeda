/**
 * @file RichTextEditor.no-phantom-change.test.tsx
 *
 * Regression test for HOS-2584: the editor must never call `onChange` unless
 * the user changed the content. Toggling `disabled` (which the campaign editor
 * does while a save is in flight) used to emit a TipTap `update` event, which
 * fed the autosave and produced a PATCH every ~3s forever.
 */
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RichTextEditor, type TiptapDocument } from './RichTextEditor';

const doc: TiptapDocument = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }]
};

describe('RichTextEditor does not emit onChange without user edits', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not call onChange on mount nor when disabled toggles', async () => {
        // Arrange
        vi.useFakeTimers();
        const onChange = vi.fn();
        const { rerender } = render(
            <RichTextEditor
                value={doc}
                onChange={onChange}
                disabled={false}
            />
        );

        // Act
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        rerender(
            <RichTextEditor
                value={doc}
                onChange={onChange}
                disabled={true}
            />
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        rerender(
            <RichTextEditor
                value={doc}
                onChange={onChange}
                disabled={false}
            />
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        // Assert
        expect(onChange).not.toHaveBeenCalled();
    });
});
