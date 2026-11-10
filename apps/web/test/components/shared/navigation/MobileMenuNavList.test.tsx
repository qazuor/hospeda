import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileMenuNavList } from '../../../../src/components/shared/navigation/MobileMenuNavList.client';

describe('MobileMenuNavList', () => {
    it('renders nested collection links and follows menu tab state', () => {
        render(
            <MobileMenuNavList
                navItems={[
                    {
                        label: 'Comer y salir',
                        href: '/venue/',
                        children: [{ label: 'Food', href: '/food/' }]
                    }
                ]}
                isOpen={false}
                onLinkClick={vi.fn()}
            />
        );
        expect(screen.getByRole('link', { name: 'Food' })).toHaveAttribute('href', '/food/');
        expect(screen.getByRole('link', { name: 'Food' })).toHaveAttribute('tabindex', '-1');
    });

    it('does not render a nested list for ordinary links', () => {
        render(
            <MobileMenuNavList
                navItems={[{ label: 'Events', href: '/events/' }]}
                isOpen={true}
                onLinkClick={vi.fn()}
            />
        );
        expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('tabindex', '0');
        expect(screen.getByRole('list').querySelector('ul')).toBeNull();
    });
});
