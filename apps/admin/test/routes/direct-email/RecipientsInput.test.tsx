/**
 * @file RecipientsInput.test.tsx
 * HOS-2685: chips input validation, dedup, cap and suppressed marking.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RecipientsInput } from '@/routes/_authed/direct-emails/-components/RecipientsInput';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key}|${JSON.stringify(params)}` : key,
        tPlural: (key: string, count: number) => `${key}#${count}`,
        locale: 'es'
    })
}));

function Harness({
    initial = [],
    suppressed = new Set<string>(),
    max = 20
}: {
    readonly initial?: ReadonlyArray<string>;
    readonly suppressed?: ReadonlySet<string>;
    readonly max?: number;
}) {
    const [recipients, setRecipients] = useState<ReadonlyArray<string>>(initial);
    return (
        <RecipientsInput
            recipients={recipients}
            onChange={setRecipients}
            suppressed={suppressed}
            max={max}
        />
    );
}

function type(value: string) {
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: 'Enter' });
}

const chips = () => screen.queryAllByTestId('recipient-chip').map((chip) => chip.textContent);

describe('RecipientsInput', () => {
    it('adds a valid address as a chip on Enter', () => {
        render(<Harness />);

        type('Ana@Empresa.com');

        expect(chips()).toHaveLength(1);
        expect(chips()[0]).toContain('ana@empresa.com');
    });

    it('shows an error for an invalid address and does not add it', () => {
        render(<Harness />);

        type('nope');

        expect(chips()).toHaveLength(0);
        expect(screen.getByRole('alert').textContent).toContain(
            'admin-direct-email.compose.recipientsInvalid'
        );
    });

    it('rejects a case-insensitive duplicate', () => {
        render(<Harness initial={['ana@x.com']} />);

        type('ANA@x.com');

        expect(chips()).toHaveLength(1);
        expect(screen.getByRole('alert').textContent).toContain(
            'admin-direct-email.compose.recipientsDuplicate'
        );
    });

    it('adds several pasted addresses at once', () => {
        render(<Harness />);
        const input = screen.getByRole('textbox');

        fireEvent.paste(input, {
            clipboardData: { getData: () => 'a@x.com, b@x.com; c@x.com' }
        });

        expect(chips()).toHaveLength(3);
    });

    it('stops at the cap and disables the field when full', () => {
        render(
            <Harness
                initial={['a@x.com', 'b@x.com']}
                max={2}
            />
        );

        expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('reports the limit when a paste overflows the cap', () => {
        render(<Harness max={2} />);
        const input = screen.getByRole('textbox');

        fireEvent.paste(input, { clipboardData: { getData: () => 'a@x.com b@x.com c@x.com' } });

        expect(chips()).toHaveLength(2);
        expect(screen.getByRole('alert').textContent).toContain(
            'admin-direct-email.compose.recipientsLimit'
        );
    });

    it('marks suppressed chips and warns, while keeping them removable', () => {
        render(
            <Harness
                initial={['ok@x.com', 'baja@x.com']}
                suppressed={new Set(['baja@x.com'])}
            />
        );

        const marked = screen
            .getAllByTestId('recipient-chip')
            .filter((chip) => chip.getAttribute('data-suppressed') === 'true');
        expect(marked).toHaveLength(1);
        expect(marked[0]?.textContent).toContain('baja@x.com');
        expect(screen.getByTestId('suppressed-warning').textContent).toContain('baja@x.com');

        fireEvent.click(
            screen.getByRole('button', {
                name: 'admin-direct-email.compose.recipientRemove|{"email":"baja@x.com"}'
            })
        );
        expect(chips()).toHaveLength(1);
        expect(screen.queryByTestId('suppressed-warning')).not.toBeInTheDocument();
    });

    it('removes the last chip with Backspace on an empty field', () => {
        render(<Harness initial={['a@x.com', 'b@x.com']} />);

        fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Backspace' });

        expect(chips()).toHaveLength(1);
    });
});
