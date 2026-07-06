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
 * Covers: webhook URL and API key are both vault secrets masked by default and
 * only revealed after clicking the toggle; each copy button copies the exact
 * expected content; the "not configured" (missing) state renders when a
 * credential is absent; and a distinct "error" state renders when a credential
 * failed to read (vault decrypt/DB failure) — never conflated with "missing".
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
const REAL_WEBHOOK_URL = 'https://hook.make.com/abc123';

const CONFIGURED_DATA: MakeWebhookSchemaResponse = {
    payloadSchema: { type: 'object', properties: { postId: { type: 'string' } } },
    responseSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
    webhookUrl: { value: REAL_WEBHOOK_URL, status: 'ok' },
    makeApiKey: { value: REAL_API_KEY, status: 'ok' },
    headerName: 'x-make-apikey'
};

const UNCONFIGURED_DATA: MakeWebhookSchemaResponse = {
    payloadSchema: { type: 'object' },
    responseSchema: { type: 'object' },
    webhookUrl: { value: null, status: 'missing' },
    makeApiKey: { value: null, status: 'missing' },
    headerName: 'x-make-apikey'
};

const ERRORED_DATA: MakeWebhookSchemaResponse = {
    payloadSchema: { type: 'object' },
    responseSchema: { type: 'object' },
    webhookUrl: { value: null, status: 'error' },
    makeApiKey: { value: null, status: 'error' },
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

    it('renders "not configured" states when the credentials are missing', () => {
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

    it('renders a distinct error state (not "not configured") when a credential failed to read', () => {
        render(
            <MakeWebhookExportPanel
                data={ERRORED_DATA}
                isLoading={false}
                error={null}
            />
        );

        expect(screen.getByTestId('make-webhook-export-url-error')).toBeInTheDocument();
        expect(screen.getByTestId('make-webhook-export-api-key-error')).toBeInTheDocument();
        // Must NOT fall back to the misleading "not configured" state
        expect(
            screen.queryByTestId('make-webhook-export-url-not-configured')
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId('make-webhook-export-api-key-not-configured')
        ).not.toBeInTheDocument();
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

    it('masks the webhook URL by default and reveals it only after clicking the toggle', async () => {
        const user = userEvent.setup();
        render(
            <MakeWebhookExportPanel
                data={CONFIGURED_DATA}
                isLoading={false}
                error={null}
            />
        );

        const valueEl = screen.getByTestId('make-webhook-export-url-value');
        expect(valueEl.textContent).not.toBe(REAL_WEBHOOK_URL);
        expect(document.body.textContent).not.toContain(REAL_WEBHOOK_URL);

        await user.click(screen.getByTestId('make-webhook-export-url-toggle'));

        expect(screen.getByTestId('make-webhook-export-url-value').textContent).toBe(
            REAL_WEBHOOK_URL
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

        expect(writeText).toHaveBeenCalledWith(REAL_WEBHOOK_URL);
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
