import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GradientButton } from '../../../src/components/ui/GradientButtonReact';

describe('GradientButton flat variant', () => {
    it('emits the flat class for a rounded functional submit and preserves disabled state', () => {
        render(
            <GradientButton
                as="button"
                type="submit"
                label="Submit"
                flat
                shape="rounded"
                disabled
            />
        );

        const button = screen.getByRole('button', { name: 'Submit' });
        expect(button).toHaveClass(
            'btn-gradient--accent',
            'btn-gradient--flat',
            'btn-gradient--shape-rounded'
        );
        expect(button).toHaveAttribute('type', 'submit');
        expect(button).toBeDisabled();
    });

    it('keeps marketing links gradient by default', () => {
        render(
            <GradientButton
                href="/es/"
                label="Explore"
            />
        );

        expect(screen.getByRole('link', { name: 'Explore' })).not.toHaveClass('btn-gradient--flat');
    });

    it('supports flat CTA links', () => {
        render(
            <GradientButton
                href="/es/publicar/"
                label="Publish"
                flat
            />
        );

        expect(screen.getByRole('link', { name: 'Publish' })).toHaveClass('btn-gradient--flat');
    });
});
