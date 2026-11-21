/**
 * Tests for AccountFooter (HOS-2413 T-018).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AccountFooter } from '../../../../src/components/account/ui';

describe('AccountFooter', () => {
    it('is one line: the three legal links and the copyright', () => {
        render(
            <AccountFooter
                locale="es"
                year={2026}
            />
        );
        expect(screen.getAllByRole('link')).toHaveLength(3);
        expect(screen.getByRole('link', { name: /Términos/i })).toHaveAttribute(
            'href',
            '/es/legal/terminos/'
        );
        expect(screen.getByRole('contentinfo')).toHaveTextContent('© 2026 Hospeda.');
    });

    it('translates the rights line', () => {
        render(
            <AccountFooter
                locale="en"
                year={2026}
            />
        );
        expect(screen.getByRole('contentinfo').textContent).toMatch(/rights reserved/i);
    });
});
