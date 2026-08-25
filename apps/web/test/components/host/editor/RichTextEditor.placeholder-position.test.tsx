/**
 * @file RichTextEditor.placeholder-position.test.tsx
 * @description Regression guard (HOS-828): the placeholder overlay must be
 * positioned against the EDITING AREA, never against some arbitrary ancestor
 * further up the page.
 *
 * The bug: `.placeholderOverlay` is `position: absolute`, and the only element
 * between it and the page was `.wrapper`, which declares no `position` at all.
 * An absolutely-positioned box resolves `top/left` against its nearest
 * POSITIONED ancestor, so the hint escaped the editor and was drawn 24px on top
 * of the field's own title in the commerce editor.
 *
 * Two assertions, because either one alone is satisfiable with the bug present:
 *
 *  1. DOM — the overlay and TipTap's editing surface share one container. A
 *     test that only checked "the overlay renders" passed throughout the bug.
 *  2. CSS — that container declares `position: relative`. JSDOM does not apply
 *     CSS modules, so the stylesheet is read from disk and the `.editorArea`
 *     RULE BLOCK is inspected on its own. Asserting over the whole file would
 *     match the `position: relative` of any other rule and prove nothing.
 *
 * Runs against the REAL TipTap (like `RichTextEditor.controlled-emit`): the
 * overlay only renders while `editor.isEmpty`, which a mocked editor does not
 * report.
 *
 * @module test/components/host/editor/RichTextEditor.placeholder-position
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from '@/components/host/editor/RichTextEditor.client';

const PLACEHOLDER = 'Contá la historia de tu comercio con detalle...';

/**
 * Path to the stylesheet under test.
 *
 * Read from disk rather than imported: this vitest project processes only
 * `*.css?url` ids, so both a plain and a `?raw` import of a CSS module come back
 * as the class-name map — an object, in which every string assertion below would
 * be vacuous. `import.meta.url` is not a `file:` URL under this runner either,
 * hence the cwd-relative resolution with an explicit existence gate: a path that
 * stopped resolving must fail the suite, not quietly read nothing.
 */
const CSS_PATH = (() => {
    const relativeToApp = 'src/components/host/editor/RichTextEditor.module.css';
    for (const base of [process.cwd(), resolve(process.cwd(), 'apps/web')]) {
        const candidate = resolve(base, relativeToApp);
        if (existsSync(candidate)) return candidate;
    }
    throw new Error(`RichTextEditor.module.css not found from cwd ${process.cwd()}`);
})();

/** Waits for the deferred (`immediatelyRender: false`) editor to finish init. */
async function waitForEditorMount(): Promise<void> {
    await waitFor(() => expect(document.querySelector('.ProseMirror')).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 50));
}

/**
 * Returns the declarations of ONE top-level CSS rule, failing loudly when the
 * rule is absent — a missing selector must read as a failure, not as an empty
 * body that trivially satisfies a `not.toContain`.
 *
 * Anchored at line start so the selector names quoted inside the file's own
 * comments (` * \`.placeholderOverlay\` is ...`) cannot be mistaken for rules.
 *
 * @param source - Full stylesheet text.
 * @param selector - Class selector to extract, including the leading dot.
 * @returns The rule's declaration block.
 */
function ruleBody(source: string, selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(source);
    expect(match, `stylesheet declares no \`${selector}\` rule`).not.toBeNull();
    return (match as RegExpExecArray)[1] as string;
}

describe('RichTextEditor — placeholder overlay containing block (HOS-828)', () => {
    it('renders the overlay inside the same box as the editing surface', async () => {
        render(
            <RichTextEditor
                value=""
                onChange={vi.fn()}
                placeholder={PLACEHOLDER}
            />
        );
        await waitForEditorMount();

        const overlay = screen.getByText(PLACEHOLDER);
        expect(overlay.className).toContain('placeholderOverlay');

        // The absolutely-positioned overlay must hang off the container that
        // also holds the contenteditable. Before HOS-828 its parent was
        // `.wrapper` (which also holds the toolbar and declares no position).
        const containingBlock = overlay.parentElement;
        expect(containingBlock).not.toBeNull();
        expect((containingBlock as HTMLElement).className).toContain('editorArea');
        expect((containingBlock as HTMLElement).querySelector('.ProseMirror')).toBeTruthy();

        // ...and the toolbar must stay OUT of it, or `top: 0` would land the
        // hint on the format buttons instead of on the first line of text.
        expect((containingBlock as HTMLElement).querySelector('[role="toolbar"]')).toBeNull();
    });

    it('declares `position: relative` on that container and `absolute` on the overlay', () => {
        const css = readFileSync(CSS_PATH, 'utf8');
        // Guard against reading an empty/wrong file, which would make a
        // `ruleBody` miss look like a code defect instead of a broken test.
        expect(css).toContain('.wrapper {');

        expect(ruleBody(css, '.editorArea')).toMatch(/position:\s*relative\s*;/);
        expect(ruleBody(css, '.placeholderOverlay')).toMatch(/position:\s*absolute\s*;/);
    });
});
