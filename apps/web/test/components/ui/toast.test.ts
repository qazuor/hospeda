import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/Toast.client.tsx');
const content = readFileSync(componentPath, 'utf8');

describe('Toast.client.tsx', () => {
    describe('Imports', () => {
        it('should import toast icons from @repo/icons', () => {
            expect(content).toContain('CheckCircleIcon');
            expect(content).toContain('XCircleIcon');
            expect(content).toContain('AlertTriangleIcon');
            expect(content).toContain('InfoIconComponent');
        });

        it('should import useSyncExternalStore from react', () => {
            expect(content).toContain("import { useSyncExternalStore } from 'react'");
        });

        it('should import store functions', () => {
            expect(content).toContain(
                "import { getToasts, removeToast, subscribe } from '../../store/toast-store'"
            );
        });

        it('should import cn utility', () => {
            expect(content).toContain("import { cn } from '../../lib/cn'");
        });

        it('should NOT import useTranslation hook', () => {
            expect(content).not.toContain('useTranslation');
        });
    });

    describe('Feedback design tokens', () => {
        it('should use success token for success toasts', () => {
            expect(content).toContain('bg-success/10 text-success border-success/30');
        });

        it('should use destructive token for error toasts', () => {
            expect(content).toContain('bg-destructive/10 text-destructive border-destructive/30');
        });

        it('should use warning token for warning toasts', () => {
            expect(content).toContain('bg-warning/10 text-warning border-warning/30');
        });

        it('should use info token for info toasts', () => {
            expect(content).toContain('bg-info/10 text-info border-info/30');
        });
    });

    describe('Animation', () => {
        it('should use tw-animate-css slide-in-from-right with fade-in', () => {
            expect(content).toContain('animate-in');
            expect(content).toContain('slide-in-from-right-5');
            expect(content).toContain('fade-in');
        });
    });

    describe('ToastContainer', () => {
        it('should have named export for ToastContainer', () => {
            expect(content).toContain('export function ToastContainer');
        });

        it('should have closeToastLabel prop with default', () => {
            expect(content).toContain("closeToastLabel = 'Cerrar notificacion'");
        });

        it('should use aria-live="polite" for announcements', () => {
            expect(content).toContain('aria-live="polite"');
        });

        it('should use fixed positioning with z-50', () => {
            expect(content).toContain('fixed top-4 right-4 z-50');
        });
    });

    describe('ToastItem', () => {
        it('should have role="alert" on individual toasts', () => {
            expect(content).toContain('role="alert"');
        });

        it('should have close button with aria-label', () => {
            expect(content).toContain('aria-label={closeToastLabel}');
        });
    });

    describe('Spacing fix', () => {
        it('should use cn() for class merging instead of template literal concatenation', () => {
            expect(content).toContain('cn(');
            expect(content).not.toContain('${getToastTypeClasses');
        });
    });
});
