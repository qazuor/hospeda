import { render } from '@react-email/render';
import { emailPalette } from '@repo/design-tokens';
import { describe, expect, it } from 'vitest';
import { Callout, type CalloutTone } from '../../src/components/callout.js';

const TONES: ReadonlyArray<{
    readonly tone: CalloutTone;
    readonly background: string;
    readonly border: string;
    readonly text: string;
}> = [
    {
        tone: 'info',
        background: emailPalette.calloutInfoBackground,
        border: emailPalette.calloutInfoBorder,
        text: emailPalette.calloutInfoText
    },
    {
        tone: 'success',
        background: emailPalette.calloutSuccessBackground,
        border: emailPalette.calloutSuccessBorder,
        text: emailPalette.calloutSuccessText
    },
    {
        tone: 'warning',
        background: emailPalette.calloutWarningBackground,
        border: emailPalette.calloutWarningBorder,
        text: emailPalette.calloutWarningText
    },
    {
        tone: 'danger',
        background: emailPalette.calloutDangerBackground,
        border: emailPalette.calloutDangerBorder,
        text: emailPalette.calloutDangerText
    }
];

/** Returns the opening tag of the `<td>` that carries `data-callout-tone`. */
function calloutCell(html: string): string {
    const cell = html.match(/<td\b[^>]*data-callout-tone="[^"]*"[^>]*>/)?.[0];
    if (!cell) {
        throw new Error('no callout <td> in the rendered html');
    }
    return cell;
}

describe('Callout (HOS-2565 US-2, AC-2.1)', () => {
    it.each(TONES)('should render the $tone tone from its palette roles', async ({
        tone,
        background,
        border,
        text
    }) => {
        // Arrange & Act
        const html = await render(<Callout tone={tone}>Contenido</Callout>);
        const cell = calloutCell(html);

        // Assert
        expect(cell).toContain(`data-callout-tone="${tone}"`);
        expect(cell).toContain(`background-color:${background}`);
        // HOS-2565 PR-4: the left border grew to 6px and the cell carries its tone class.
        expect(cell).toContain(`border-left:6px solid ${border}`);
        expect(cell).toContain(`class="hd-co-${tone}"`);
        expect(cell).toContain('border-radius:8px');
        expect(cell).toContain(`color:${text}`);
        expect(cell).toContain('padding:16px 20px');
    });

    it.each(TONES)('should draw the $tone line icon, skipped in the text part', async ({
        tone
    }) => {
        // Arrange & Act
        const html = await render(<Callout tone={tone}>Contenido</Callout>);

        // Assert
        const icon = html.match(/<td\b[^>]*data-skip-in-text="true"[^>]*><img\b[^>]*>/)?.[0];
        expect(icon).toBeDefined();
        expect(icon).toContain(`/email/user/callout-${tone}@2x.png`);
        expect(icon).toContain('alt=""');
    });

    it('should carry every visual style on the single <td> inside a 100% presentation table', async () => {
        // Arrange & Act
        const html = await render(<Callout tone="info">Hola</Callout>);

        // Assert
        expect(html).toMatch(/<table[^>]*role="presentation"[^>]*width="100%"[^>]*>/);
        expect(html).toMatch(/<td style="padding:12px 0"><table/);
        expect(html).not.toContain('margin:24px 0');
        expect(html.match(/data-callout-tone=/g)).toHaveLength(1);
    });

    it('should wrap a string child in a margin-free paragraph', async () => {
        // Arrange & Act
        const html = await render(<Callout tone="success">Todo salió bien</Callout>);

        // Assert
        expect(html).toMatch(/<p style="[^"]*margin:0[^"]*">Todo salió bien<\/p>/);
    });

    it('should render element children as they are, without an extra wrapper', async () => {
        // Arrange & Act
        const html = await render(
            <Callout tone="warning">
                <span>uno</span>
                <span>dos</span>
            </Callout>
        );

        // Assert
        expect(html).toContain('<span>uno</span><span>dos</span>');
    });

    it('should render the optional title as a bold first line', async () => {
        // Arrange & Act
        const html = await render(
            <Callout
                tone="danger"
                title="Atención"
            >
                Detalle
            </Callout>
        );

        // Assert
        expect(html).toMatch(/<p style="[^"]*font-weight:700[^"]*">Atención<\/p>/);
        expect(html.indexOf('Atención')).toBeLessThan(html.indexOf('Detalle'));
    });

    it('should not render a title paragraph when there is no title', async () => {
        // Arrange & Act
        const html = await render(<Callout tone="info">Solo texto</Callout>);

        // Assert
        expect(html).not.toContain('font-weight:700');
    });
});

describe('Callout spacing is Outlook-safe', () => {
    it('should space stacked callouts through wrapper cell padding, not table margins', async () => {
        // Arrange & Act
        const html = await render(
            <>
                <Callout tone="info">Uno</Callout>
                <Callout tone="warning">Dos</Callout>
            </>
        );

        // Assert
        expect(html.match(/<td style="padding:12px 0">/g)).toHaveLength(2);
        expect(html).not.toMatch(/<table[^>]*style="[^"]*margin:/);
    });
});
