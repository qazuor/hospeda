/**
 * Tests for AiAssistantsTabs (HOS-2502): the NavTabs of «Asistentes de IA».
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AiAssistantsTabs } from '../../../src/components/account/AiAssistantsTabs';

describe('AiAssistantsTabs', () => {
    it('links the assistants page and the history, marking the open one as current', () => {
        render(
            <AiAssistantsTabs
                locale="es"
                current="history"
            />
        );

        const nav = screen.getByRole('navigation', { name: 'Secciones de asistentes de IA' });
        expect(nav).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Asistentes' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/asistentes-ia/'
        );
        expect(screen.getByRole('link', { name: 'Asistentes' })).not.toHaveAttribute(
            'aria-current'
        );
        const history = screen.getByRole('link', { name: 'Historial' });
        expect(history).toHaveAttribute('href', '/es/mi-cuenta/asistentes-ia/historial/');
        expect(history).toHaveAttribute('aria-current', 'page');
    });

    it('translates the tabs to the page locale', () => {
        render(
            <AiAssistantsTabs
                locale="en"
                current="assistants"
            />
        );
        expect(screen.getByRole('link', { name: 'Assistants' })).toHaveAttribute(
            'aria-current',
            'page'
        );
        expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument();
    });
});
