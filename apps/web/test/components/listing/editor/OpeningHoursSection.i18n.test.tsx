/**
 * @file OpeningHoursSection.i18n.test.tsx
 * @description Regression test (HOS-2436): with the `en` locale the weekday
 * labels, the "closed" label and every aria-label of the opening-hours editor
 * must come from `@repo/i18n`, not from hardcoded Spanish. Uses the REAL
 * translation loader, so a missing key would surface as Spanish fallback text.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OpeningHoursSection } from '../../../../src/components/listing/editor/OpeningHoursSection.client';

const SPANISH = /Lun|Mar|Mié|Jue|Vie|Sáb|Dom|Cerrado|cerrado|Quitar|Agregar|apertura|cierre/;

describe('OpeningHoursSection locale en (HOS-2436)', () => {
    it('renders English weekday and closed labels', () => {
        const { container } = render(
            <OpeningHoursSection
                locale="en"
                value={null}
                errors={{}}
                onChange={() => {}}
            />
        );

        for (const label of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
        expect(screen.getByLabelText('Mon closed')).toBeInTheDocument();
        expect(container.textContent).toContain('Closed');
    });

    it('renders English shift aria-labels for an open day', () => {
        render(
            <OpeningHoursSection
                locale="en"
                value={
                    {
                        timezone: 'America/Argentina/Buenos_Aires',
                        days: {
                            tue: { closed: false, shifts: [{ open: '10:00', close: '14:00' }] }
                        }
                    } as never
                }
                errors={{}}
                onChange={() => {}}
            />
        );

        expect(screen.getByLabelText('Tue opening time 1')).toBeInTheDocument();
        expect(screen.getByLabelText('Tue closing time 1')).toBeInTheDocument();
        expect(screen.getByLabelText('Remove shift Tue 1')).toBeInTheDocument();
        expect(screen.getByLabelText('Add shift Tue')).toBeInTheDocument();
    });

    it('leaks no hardcoded Spanish into the accessible names', () => {
        const { container } = render(
            <OpeningHoursSection
                locale="en"
                value={null}
                errors={{}}
                onChange={() => {}}
            />
        );
        const names = Array.from(container.querySelectorAll('[aria-label]')).map((el) =>
            el.getAttribute('aria-label')
        );
        for (const name of names) {
            expect(name).not.toMatch(SPANISH);
        }
    });
});
