import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AccountZoneSwitch } from '../../../src/components/account/AccountZoneSwitch';

describe('AccountZoneSwitch', () => {
    it.each([
        ['es', 'Ir a Comer y salir'],
        ['en', 'Go to Food & nightlife'],
        ['pt', 'Ir para Comer e sair']
    ] as const)('renders the vertical phrase in %s and keeps a real keyboard-focusable kit link', (locale, label) => {
        render(
            <AccountZoneSwitch
                locale={locale}
                links={[
                    {
                        id: 'venue',
                        href: 'mi-cuenta/comercio?vertical=venue',
                        i18nKey: 'account.nav.zoneLink.venues',
                        direction: 'forward'
                    }
                ]}
            />
        );
        const link = screen.getByRole('link');
        expect(link).toHaveTextContent(label);
        expect(link).toHaveAttribute('href', `/${locale}/mi-cuenta/comercio/?vertical=venue`);
        link.focus();
        expect(link).toHaveFocus();
        expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    });
    it('returns to the account root without repeating the old kit return door', () => {
        render(
            <AccountZoneSwitch
                locale="es"
                links={[
                    {
                        id: 'account',
                        href: 'mi-cuenta',
                        i18nKey: 'account.title',
                        direction: 'back'
                    }
                ]}
            />
        );
        expect(screen.getAllByRole('link')).toHaveLength(1);
        expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/'
        );
    });
    it('has no doors for a tourist', () => {
        render(
            <AccountZoneSwitch
                locale="es"
                links={[]}
            />
        );
        expect(screen.queryByRole('link')).toBeNull();
    });
});
