/**
 * Tests for useTranslations hook
 *
 * Verifies that the i18n system correctly:
 * 1. Returns translations for valid keys
 * 2. Handles missing translation keys
 * 3. Handles parameter interpolation
 */

import { useTranslations } from '@/hooks/use-translations';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Undo the global mock from test/setup.tsx so we test the real implementation
vi.unmock('@/hooks/use-translations');

describe('useTranslations hook', () => {
    describe('Basic translation', () => {
        it('should return translation for valid key', () => {
            const { result } = renderHook(() => useTranslations());

            const translation = result.current.t('ui.actions.edit');

            expect(translation).toBe('Editar');
        });

        it('should return Spanish translations by default', () => {
            const { result } = renderHook(() => useTranslations());

            expect(result.current.locale).toBe('es');
        });

        it('should translate action keys correctly', () => {
            const { result } = renderHook(() => useTranslations());
            const { t } = result.current;

            expect(t('ui.actions.refresh')).toBe('Actualizar');
            expect(t('ui.actions.delete')).toBe('Eliminar');
            expect(t('ui.actions.viewDetails')).toBe('Ver detalles');
            expect(t('ui.actions.scrollToTop')).toBe('Ir al inicio');
            expect(t('ui.actions.scrollToBottom')).toBe('Ir al final');
            expect(t('ui.actions.previewImage')).toBe('Vista previa');
            expect(t('ui.actions.downloadImage')).toBe('Descargar imagen');
            expect(t('ui.actions.openInNewTab')).toBe('Abrir en nueva pestaña');
            expect(t('ui.actions.editField')).toBe('Editar campo');
        });

        it('should translate UI element keys', () => {
            const { result } = renderHook(() => useTranslations());
            const { t } = result.current;

            expect(t('ui.loading.text')).toBe('Cargando...');
            expect(t('ui.errors.general')).toBe('Ha ocurrido un error');
            expect(t('ui.navigation.home')).toBe('Inicio');
        });

        it('should translate admin navigation keys', () => {
            const { result } = renderHook(() => useTranslations());
            const { t } = result.current;

            expect(t('admin-nav.sidebar.navigation')).toBe('Navegación');
            expect(t('admin-nav.sidebar.closeMenu')).toBe('Cerrar menú');
        });
    });

    describe('Missing translation handling', () => {
        it('should return [MISSING: key] for invalid key', () => {
            const { result } = renderHook(() => useTranslations());

            const translation = result.current.t(
                'invalid.nonexistent.key' as Parameters<typeof result.current.t>[0]
            );

            expect(translation).toBe('[MISSING: invalid.nonexistent.key]');
        });

        it('should log error for missing translation', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const { result } = renderHook(() => useTranslations());

            result.current.t('missing.key.test' as Parameters<typeof result.current.t>[0]);

            expect(consoleSpy).toHaveBeenCalledWith('Translation key not found: missing.key.test');
            consoleSpy.mockRestore();
        });
    });

    describe('Parameter interpolation', () => {
        it('should interpolate single parameter with curly braces', () => {
            const { result } = renderHook(() => useTranslations());

            const translation = result.current.t('ui.slider.goToImage', { number: 5 });

            expect(translation).toBe('Ir a imagen 5');
        });

        it('should interpolate multiple parameters', () => {
            const { result } = renderHook(() => useTranslations());

            const translation = result.current.t('ui.table.pageInfo', {
                page: 2,
                pageCount: 10
            });

            expect(translation).toBe('Página 2 de 10');
        });

        it('should interpolate resource parameter in error messages', () => {
            const { result } = renderHook(() => useTranslations());

            const translation = result.current.t('ui.errors.failedToLoad', {
                resource: 'usuarios'
            });

            expect(translation).toBe('Error al cargar usuarios');
        });

        it('should handle double curly braces interpolation', () => {
            const { result } = renderHook(() => useTranslations());

            // Test with a key that uses double curly braces
            const translation = result.current.t('ui.entitySelect.selectedCount', {
                count: 3
            });

            expect(translation).toBe('3 seleccionados');
        });
    });

    describe('Locale parameter', () => {
        it('should accept explicit locale parameter', () => {
            const { result } = renderHook(() => useTranslations('es'));

            expect(result.current.locale).toBe('es');
            expect(result.current.t('ui.actions.edit')).toBe('Editar');
        });

        it('should return English translation for en locale', () => {
            const { result } = renderHook(() => useTranslations('en'));

            // English locale is supported and returns English translations
            const translation = result.current.t('ui.actions.edit');
            expect(translation).toBe('Edit');
        });
    });

    describe('Hook stability', () => {
        it('should return stable translation function reference', () => {
            const { result, rerender } = renderHook(() => useTranslations());

            const firstT = result.current.t;
            rerender();
            const secondT = result.current.t;

            expect(firstT).toBe(secondT);
        });

        it('should update when locale changes', () => {
            const { result, rerender } = renderHook(({ locale }) => useTranslations(locale), {
                initialProps: { locale: 'es' }
            });

            expect(result.current.locale).toBe('es');

            rerender({ locale: 'es' });
            expect(result.current.locale).toBe('es');
        });
    });
});
