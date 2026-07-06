// @vitest-environment jsdom
/**
 * Component tests for GptActionExportPanel (HOS-67 G-6, T-011).
 *
 * Strategy (mirrors `../../__tests__/platform-settings-pages.test.tsx`): mock
 * `useTranslations` to return the raw key so assertions are stable, mock
 * `@/hooks/use-toast` for the copy-to-clipboard feedback, and stub
 * `navigator.clipboard.writeText` + `URL.createObjectURL` (not implemented by
 * jsdom).
 *
 * Covers: renders the pretty-printed JSON, the copy button copies the exact
 * stringified document to the clipboard, the download button triggers a blob
 * download, loading and error states render instead of the JSON block.
 *
 * IMPORTANT: `@testing-library/user-event`'s `setup()` call installs its own
 * clipboard stub on the view (`attachClipboardStubToView`), unconditionally —
 * it overwrites any `navigator.clipboard` mock defined beforehand. The
 * clipboard mock must therefore be (re)installed AFTER `userEvent.setup()`,
 * not in a `beforeEach` that runs before it.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

const addToastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ addToast: addToastMock })
}));

import { GptActionExportPanel } from '../-components/GptActionExportPanel';

const SAMPLE_DOC = {
    openapi: '3.1.0',
    info: { title: 'Hospeda Social Automation — Custom GPT Actions', version: '1.0.0' },
    paths: {}
} as const;

/**
 * (Re)installs a spy-able `navigator.clipboard.writeText` mock. Must be
 * called AFTER `userEvent.setup()` — see the file-level note above.
 */
function stubClipboard() {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
        writable: true
    });
    return writeText;
}

describe('GptActionExportPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // jsdom does not implement Blob URL creation.
        URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        URL.revokeObjectURL = vi.fn();
    });

    it('shows a loading indicator while isLoading is true', () => {
        render(
            <GptActionExportPanel
                data={undefined}
                isLoading={true}
                error={null}
            />
        );

        expect(screen.getByTestId('gpt-action-export-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('gpt-action-export-json')).not.toBeInTheDocument();
    });

    it('shows an error message when the query failed', () => {
        render(
            <GptActionExportPanel
                data={undefined}
                isLoading={false}
                error={new Error('boom')}
            />
        );

        expect(screen.getByTestId('gpt-action-export-error')).toBeInTheDocument();
        expect(screen.queryByTestId('gpt-action-export-json')).not.toBeInTheDocument();
    });

    it('renders the pretty-printed OpenAPI document', () => {
        render(
            <GptActionExportPanel
                data={SAMPLE_DOC}
                isLoading={false}
                error={null}
            />
        );

        const block = screen.getByTestId('gpt-action-export-json');
        expect(block.textContent).toBe(JSON.stringify(SAMPLE_DOC, null, 2));
    });

    it('copies the exact stringified document to the clipboard', async () => {
        const user = userEvent.setup();
        const writeText = stubClipboard();
        render(
            <GptActionExportPanel
                data={SAMPLE_DOC}
                isLoading={false}
                error={null}
            />
        );

        await user.click(screen.getByTestId('gpt-action-export-copy'));

        expect(writeText).toHaveBeenCalledWith(JSON.stringify(SAMPLE_DOC, null, 2));
        expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    });

    it('triggers a blob download when the download button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <GptActionExportPanel
                data={SAMPLE_DOC}
                isLoading={false}
                error={null}
            />
        );

        await user.click(screen.getByTestId('gpt-action-export-download'));

        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
});
