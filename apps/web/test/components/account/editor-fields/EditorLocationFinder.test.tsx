import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditorLocationFinder } from '@/components/account/editor-fields/EditorLocationFinder';
import { createT } from '@/lib/i18n';

vi.mock('@/hooks/useGeocoding', () => ({
    useGeocodingSearch: () => ({ suggestions: [], isLoading: false }),
    useGeocodingReverse: ({ enabled }: { readonly enabled: boolean }) => ({
        suggestion: enabled ? { label: 'Mitre 100' } : null
    })
}));

describe('EditorLocationFinder notices', () => {
    it('does not duplicate the parent section no-pin notice', () => {
        render(
            <EditorLocationFinder
                locale="es"
                idPrefix="acc"
                pin={null}
                onFound={vi.fn()}
            />
        );
        expect(
            screen.queryByText(createT('es')('host.properties.editor.location.pinNotSet'))
        ).toBeNull();
    });

    it('uses an informational kit Alert for the reverse-geocoded address', () => {
        render(
            <EditorLocationFinder
                locale="es"
                idPrefix="acc"
                pin={{ lat: -32.5, lng: -58.2 }}
                onFound={vi.fn()}
            />
        );
        expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'info');
        expect(screen.getByRole('status')).toHaveTextContent('Mitre 100');
    });
});
