// @vitest-environment jsdom
/**
 * Component tests for MakeWebhookExportPanel (HOS-67 G-6, T-011).
 *
 * Strategy (mirrors `GptActionExportPanel.test.tsx`): mock `useTranslations`
 * to return the raw key, mock `@/hooks/use-toast`, and stub
 * `navigator.clipboard.writeText`.
 *
 * IMPORTANT: `@testing-library/user-event`'s `setup()` call installs its own
 * clipboard stub on the view (`attachClipboardStubToView`), unconditionally —
 * it overwrites any `navigator.clipboard` mock defined beforehand. The
 * clipboard mock must therefore be (re)installed AFTER `userEvent.setup()`,
 * not in a `beforeEach` that runs before it.
 *
 * Covers: the API key is masked by default and never renders the real secret
 * until the reveal toggle is clicked; each copy button copies the exact
 * expected content (URL, header name, masked API key's real value, payload/
 * response JSON Schemas); the "not configured" state renders when
 * `webhookUrl` / `makeApiKey` are `null`.
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

import { MakeWebhookExportPanel } from '../-components/MakeWebhookExportPanel';
import type { MakeWebhookSchemaResponse } from '../-hooks/use-integration-config';

const REAL_API_KEY = 'super-secret-make-api-key-do-not-leak';

const CONFIGURED_DATA: MakeWebhookSchemaResponse = {
    payloadSchema: { type: 'object', properties: { postId: { type: 'string' } } },
    responseSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
    webhookUrl: 'https://hook.make.com/abc123',
    makeApiKey: REAL_API_KEY,
    headerName: 'x-make-apikey'
};

const UNCONFIGURED_DATA: MakeWebhookSchemaResponse = {
    payloadSchema: { type: 'object' },
    responseSchema: { type: 'object' },
    webhookUrl: null,
    makeApiKey: null,
    headerName: 'x-make-apikey'
};

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

describe('MakeWebhookExportPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows a loading indicator while isLoading is true', () => {
        render(
            <MakeWebhookExportPanel
                data={undefined}
                isLoading={true}
                error={null}
            />
        );

        expect(screen.getByTestId('make-webhook-export-loading')).toBeInTheDocument();
    });

    it('shows an error message when the query failed', () => {
        render(
            <MakeWebhookExportPanel
                data={undefined}
                isLoading={false}
                error={new Error('boom')}
            />
        );

        expect(screen.getByTestId('make-webhook-export-error')).toBeInTheDocument();
    });

    it('renders "not configured" states when webhookUrl and makeApiKey are null', () => {
        render(
            <MakeWebhookExportPanel
                data={UNCONFIGURED_DATA}
                isLoading={false}
                error={null}
            />
        );

        expect(screen.getByTestId('make-webhook-export-url-not-configured')).toBeInTheDocument();
        expect(
            screen.getByTestId('make-webhook-export-api-key-not-configured')
        ).toBeInTheDocument();
        expect(screen.queryByTestId('make-webhook-export-url-value')).not.toBeInTheDocument();
        expect(screen.queryByTestId('make-webhook-export-api-key-value')).not.toBeInTheDocument();
    });

    it('masks the API key by default and reveals it only after clicking the toggle', async () => {
        const user = userEvent.setup();
        render(
            <MakeWebhookExportPanel
                data={CONFIGURED_DATA}
                isLoading={false}
                error={null}
            />
        );

        const valueEl = screen.getByTestId('make-webhook-export-api-key-value');
        expect(valueEl.textContent).not.toBe(REAL_API_KEY);
        expect(document.body.textContent).not.toContain(REAL_API_KEY);

        await user.click(screen.getByTestId('make-webhook-export-api-key-toggle'));

        expect(screen.getByTestId('make-webhook-export-api-key-value').textContent).toBe(
            REAL_API_KEY
        );
    });

    it('copies the webhook URL to the clipboard', async () => {
        const user = userEvent.setup();
        const writeText = stubClipboard();
        render(
            <MakeWebhookExportPanel
                data={CONFIGURED_DATA}
                isLoading={false}
                error={null}
            />
        );

        await user.click(screen.getByTestId('make-webhook-export-url-copy'));

        expect(writeText).toHaveBeenCalledWith(CONFIGURED_DATA.webhookUrl);
    });

    it('copies the header name to the clipboard', async () => {
        const user = userEvent.setup();
        const writeText = stubClipboard();
        render(
            <MakeWebhookExportPanel
                data={CONFIGURED_DATA}
                isLoading={false}
                error={null}
            />
        );

        await user.click(screen.getByTestId('make-webhook-export-header-name-copy'));

        expect(writeText).toHaveBeenCalledWith('x-make-apikey');
    });

    it('copies the real API key value to the clipboard even while masked', async () => {
        const user = userEvent.setup();
        const writeText = stubClipboard();
        render(
            <MakeWebhookExportPanel
                data={CONFIGURED_DATA}
                isLoading={false}
                error={null}
            />
        );

        await user.click(screen.getByTestId('make-webhook-export-api-key-copy'));

        expect(writeText).toHaveBeenCalledWith(REAL_API_KEY);
    });

    it('copies the pretty-printed payload and response JSON Schemas', async () => {
        const user = userEvent.setup();
        const writeText = stubClipboard();
        render(
            <MakeWebhookExportPanel
                data={CONFIGURED_DATA}
                isLoading={false}
                error={null}
            />
        );

        await user.click(screen.getByTestId('make-webhook-export-payload-schema-copy'));
        expect(writeText).toHaveBeenCalledWith(
            JSON.stringify(CONFIGURED_DATA.payloadSchema, null, 2)
        );

        await user.click(screen.getByTestId('make-webhook-export-response-schema-copy'));
        expect(writeText).toHaveBeenCalledWith(
            JSON.stringify(CONFIGURED_DATA.responseSchema, null, 2)
        );
    });
});
