/**
 * @file FieldError.test.tsx
 * @description Unit tests for the shared `FieldError` component and
 * `fieldErrorId` helper (HOS-190 slice 2).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';

describe('fieldErrorId', () => {
    it('builds the conventional `<field>-error` id', () => {
        expect(fieldErrorId('email')).toBe('email-error');
        expect(fieldErrorId('contactInfo.mobilePhone')).toBe('contactInfo.mobilePhone-error');
    });
});

describe('FieldError', () => {
    it('renders nothing when message is undefined', () => {
        const { container } = render(<FieldError id="email-error" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when message is an empty string', () => {
        const { container } = render(
            <FieldError
                id="email-error"
                message=""
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when message is null', () => {
        const { container } = render(
            <FieldError
                id="email-error"
                message={null}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders the message with the given id and role="alert"', () => {
        render(
            <FieldError
                id="email-error"
                message="Ingresá un email válido"
            />
        );

        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Ingresá un email válido');
        expect(alert).toHaveAttribute('id', 'email-error');
    });

    it('merges an extra className with the default error style', () => {
        render(
            <FieldError
                id="email-error"
                message="Error"
                className="extra-class"
            />
        );

        const alert = screen.getByRole('alert');
        expect(alert.className).toContain('extra-class');
    });
});
