import { WhatsappLogo as PhosphorWhatsappLogo } from '@phosphor-icons/react';
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { getIconSpriteName, WhatsappLogo } from '../src';
import { resolveIcon } from '../src/resolver';

it('exports the Phosphor WhatsApp glyph and forwards icon props', () => {
    const reference = render(<PhosphorWhatsappLogo weight="fill" />);
    const actual = render(
        <WhatsappLogo
            weight="fill"
            size={20}
            aria-hidden="true"
        />
    );

    const svg = actual.container.querySelector('svg');

    expect(svg?.querySelector('path')?.getAttribute('d')).toBe(
        reference.container.querySelector('path')?.getAttribute('d')
    );
    expect(svg?.getAttribute('width')).toBe('20');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(resolveIcon({ iconName: 'WhatsappLogo' })).toBe(WhatsappLogo);
    expect(getIconSpriteName(WhatsappLogo)).toBe('WhatsappLogoIcon');
});
