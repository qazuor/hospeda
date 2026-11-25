import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GeneralDashboardHeader } from '../../../../src/components/account/dashboard/GeneralDashboardHeader';

describe('GeneralDashboardHeader identity', () => {
    it('retains the complete name in the heading and uses significant initials', () => {
        const name = 'Host y Comercio Experiencias del Litoral';
        render(
            <GeneralDashboardHeader
                locale="es"
                name={name}
                email="host@example.test"
            />
        );
        expect(screen.getByRole('heading', { level: 1, name })).toBeInTheDocument();
        expect(screen.getByTitle(name)).toHaveTextContent(name);
        expect(screen.getByText('HC')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/editar/'
        );
    });
});
