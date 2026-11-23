/**
 * Tests for the kit KeyValueList (HOS-2472).
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KeyValueList } from '../../../../src/components/account/ui';

describe('KeyValueList', () => {
    it('renders each fact as a dt/dd pair inside a description list', () => {
        const { container } = render(
            <KeyValueList
                items={[
                    { key: 'a', label: 'Horario', value: '9 a 18' },
                    { key: 'b', label: 'Estado', value: <strong>Activo</strong> }
                ]}
            />
        );

        const list = container.querySelector('dl');
        expect(list).not.toBeNull();
        expect(list?.querySelectorAll('dt')).toHaveLength(2);
        expect(list?.querySelectorAll('dd')).toHaveLength(2);
        expect(screen.getByText('Horario').tagName).toBe('DT');
        expect(
            within(screen.getByText('Activo').closest('dd') as HTMLElement).getByText('Activo')
        ).toBeInTheDocument();
    });

    it('renders nothing when there are no facts', () => {
        const { container } = render(<KeyValueList items={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('forwards the help anchor as data-help', () => {
        const { container } = render(
            <KeyValueList
                helpId="section:host-trade.datos"
                items={[{ key: 'a', label: 'L', value: 'V' }]}
            />
        );
        expect(container.querySelector('dl')).toHaveAttribute(
            'data-help',
            'section:host-trade.datos'
        );
    });
});
