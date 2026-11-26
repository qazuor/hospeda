import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileMenuNavList } from '../../../../src/components/shared/navigation/MobileMenuNavList.client';

describe('MobileMenuNavList', () => {
    it('starts grouped destinations collapsed and reveals the parent and child on activation', () => {
        const { container } = render(
            <MobileMenuNavList
                navItems={[
                    {
                        label: 'Comer y salir',
                        href: '/venue/',
                        children: [{ label: 'Food', href: '/food/' }]
                    }
                ]}
                isOpen={true}
                onLinkClick={vi.fn()}
            />
        );
        const group = container.querySelector('details');
        expect(group).not.toHaveAttribute('open');
        fireEvent.click(container.querySelector('summary') as HTMLElement);
        expect(group).toHaveAttribute('open');
        expect(screen.getByRole('link', { name: 'Food' })).toHaveAttribute('href', '/food/');
        expect(screen.getByRole('link', { name: 'Comer y salir' })).toHaveAttribute(
            'href',
            '/venue/'
        );
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
