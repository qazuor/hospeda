import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/Modal.client.tsx');
const content = readFileSync(componentPath, 'utf8');

describe('Modal.client.tsx', () => {
    describe('Imports', () => {
        it('should import CloseIcon from @repo/icons', () => {
            expect(content).toContain("import { CloseIcon } from '@repo/icons'");
        });

        it('should import cn utility', () => {
            expect(content).toContain("import { cn } from '../../lib/cn'");
        });

        it('should NOT import useTranslation hook', () => {
            expect(content).not.toContain('useTranslation');
        });
    });

    describe('Props', () => {
        it('should have readonly title prop', () => {
            expect(content).toContain('readonly title: string');
        });

        it('should have readonly open prop', () => {
            expect(content).toContain('readonly open: boolean');
        });

        it('should have readonly onClose callback', () => {
            expect(content).toContain('readonly onClose: () => void');
        });

        it('should have closeLabel prop with default "Cerrar"', () => {
            expect(content).toContain('readonly closeLabel?: string');
            expect(content).toContain("closeLabel = 'Cerrar'");
        });
    });

    describe('Native dialog', () => {
        it('should use native <dialog> element', () => {
            expect(content).toContain('<dialog');
        });

        it('should sync open prop with showModal/close', () => {
            expect(content).toContain('dialog.showModal()');
            expect(content).toContain('dialog.close()');
        });

        it('should handle native cancel event', () => {
            expect(content).toContain("dialog.addEventListener('cancel'");
        });
    });

    describe('Design tokens', () => {
        it('should use card background token', () => {
            expect(content).toContain('bg-card');
        });

        it('should use foreground token for title', () => {
            expect(content).toContain('text-foreground');
        });

        it('should use muted-foreground for close button', () => {
            expect(content).toContain('text-muted-foreground');
        });

        it('should use muted for hover state', () => {
            expect(content).toContain('hover:bg-muted');
        });
    });

    describe('Animation', () => {
        it('should use tw-animate-css composable classes', () => {
            expect(content).toContain('open:animate-in');
            expect(content).toContain('open:fade-in');
            expect(content).toContain('open:zoom-in-95');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-modal="true"', () => {
            expect(content).toContain('aria-modal="true"');
        });

        it('should have aria-labelledby referencing modal-title', () => {
            expect(content).toContain('aria-labelledby="modal-title"');
        });

        it('should have id="modal-title" on heading', () => {
            expect(content).toContain('id="modal-title"');
        });

        it('should handle backdrop click', () => {
            expect(content).toContain('handleDialogClick');
        });

        it('should close on Escape key', () => {
            expect(content).toContain("e.key === 'Escape'");
        });
    });

    describe('Named export', () => {
        it('should use named export', () => {
            expect(content).toContain('export function Modal');
        });
    });
});
