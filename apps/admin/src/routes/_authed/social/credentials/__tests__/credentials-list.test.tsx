// @vitest-environment jsdom
/**
 * Component tests for the masked social credential card list (HOS-64 G-4, T-029).
 *
 * Mirrors the local convention (see ../../__tests__/platform-settings-pages.test.tsx):
 * test the exported `-components/` presentational piece directly rather than
 * the unexported top-level route page component.
 *
 * Covers: one card per credential, and — the security-critical assertion —
 * no ciphertext/iv/authTag/plaintext field or value ever appears in the DOM.
 */

import type { SocialCredentialMasked } from '@/features/social-credentials';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CredentialsList } from '../-components/CredentialsList';

const MASKED_CREDENTIAL: SocialCredentialMasked = {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    key: 'make_webhook_url',
    label: 'Production webhook',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null
};

describe('CredentialsList', () => {
    it('renders no cards for an empty list', () => {
        render(<CredentialsList credentials={[]} />);
        expect(screen.queryByTestId(/social-credential-card-/)).not.toBeInTheDocument();
    });

    it('renders one card per credential', () => {
        render(
            <CredentialsList
                credentials={[
                    MASKED_CREDENTIAL,
                    { ...MASKED_CREDENTIAL, id: 'bbbb', key: 'make_api_key', label: 'Prod key' }
                ]}
            />
        );

        expect(screen.getByTestId('social-credential-card-make_webhook_url')).toBeInTheDocument();
        expect(screen.getByTestId('social-credential-card-make_api_key')).toBeInTheDocument();
    });

    it('shows the key, label, createdAt, and updatedAt for each card', () => {
        render(<CredentialsList credentials={[MASKED_CREDENTIAL]} />);

        const card = screen.getByTestId('social-credential-card-make_webhook_url');
        expect(card).toHaveTextContent('Production webhook');
        expect(card).toHaveTextContent('make_webhook_url');
    });

    it('never renders ciphertext/iv/authTag/plaintext anywhere in the DOM', () => {
        const { container } = render(<CredentialsList credentials={[MASKED_CREDENTIAL]} />);

        const html = container.innerHTML;
        expect(html).not.toContain('ciphertext');
        expect(html).not.toContain('authTag');
        expect(html).not.toContain('plaintext');
        // The masked type has no `iv` field at all — assert at the type/data
        // level too, since "iv" alone is too common a substring to grep the DOM for.
        expect(Object.keys(MASKED_CREDENTIAL)).not.toContain('iv');
        expect(Object.keys(MASKED_CREDENTIAL)).not.toContain('ciphertext');
        expect(Object.keys(MASKED_CREDENTIAL)).not.toContain('authTag');
    });
});
