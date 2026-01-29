/**
 * Tests for static translations helper
 *
 * Verifies that the static translation function works correctly
 * for class components where hooks cannot be used.
 */

import { getTranslation, t } from '@/lib/i18n';
import { describe, expect, it, vi } from 'vitest';

describe('static-translations', () => {
    describe('getTranslation function', () => {
        it('should return translation for valid key', () => {
            const translation = getTranslation('ui.actions.edit');
            expect(translation).toBe('Editar');
        });

        it('should return translation for error boundary keys', () => {
            expect(getTranslation('error.boundary.entity.tryAgain')).toBe('Intentar de nuevo');
            expect(getTranslation('error.boundary.entity.goBack')).toBe('Volver');
            expect(getTranslation('error.boundary.entity.showErrorDetails')).toBe(
                'Mostrar detalles del error'
            );
        });

        it('should return translation for route error boundary keys', () => {
            expect(getTranslation('error.boundary.route.updateRequiredTitle')).toBe(
                'Actualización requerida'
            );
            expect(getTranslation('error.boundary.route.connectionProblemTitle')).toBe(
                'Problema de conexión'
            );
            expect(getTranslation('error.boundary.route.accessDeniedTitle')).toBe(
                'Acceso denegado'
            );
            expect(getTranslation('error.boundary.route.genericErrorTitle')).toBe('Algo salió mal');
        });

        it('should return [MISSING: key] for invalid key', () => {
            const translation = getTranslation(
                'invalid.nonexistent.key' as Parameters<typeof getTranslation>[0]
            );
            expect(translation).toBe('[MISSING: invalid.nonexistent.key]');
        });

        it('should log error for missing translation', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            getTranslation('missing.key.test' as Parameters<typeof getTranslation>[0]);

            expect(consoleSpy).toHaveBeenCalledWith('Translation key not found: missing.key.test');
            consoleSpy.mockRestore();
        });
    });

    describe('parameter interpolation', () => {
        it('should interpolate single parameter with single curly braces', () => {
            const translation = getTranslation('ui.slider.goToImage', { number: 3 });
            expect(translation).toBe('Ir a imagen 3');
        });

        it('should interpolate entity name in error messages', () => {
            const translation = getTranslation('error.boundary.entity.notFoundTitle', {
                entity: 'Alojamiento'
            });
            expect(translation).toBe('Alojamiento no encontrado');
        });

        it('should interpolate operation and entity in access denied message', () => {
            const translation = getTranslation('error.boundary.entity.accessDeniedMessage', {
                operation: 'editar',
                entity: 'destino'
            });
            expect(translation).toBe('No tienes permiso para editar este destino.');
        });

        it('should interpolate route name in generic error message', () => {
            const translation = getTranslation('error.boundary.route.genericErrorMessage', {
                route: 'alojamientos'
            });
            expect(translation).toBe(
                'Ocurrió un error inesperado al cargar alojamientos. Nuestro equipo ha sido notificado.'
            );
        });

        it('should handle double curly braces interpolation', () => {
            const translation = getTranslation('ui.entitySelect.selectedCount', { count: 5 });
            expect(translation).toBe('5 seleccionados');
        });

        it('should return raw string when no params provided', () => {
            const translation = getTranslation('error.boundary.entity.connectionErrorTitle');
            expect(translation).toBe('Error de conexión');
        });
    });

    describe('t alias', () => {
        it('should be an alias for getTranslation', () => {
            expect(t).toBe(getTranslation);
        });

        it('should work identically to getTranslation', () => {
            expect(t('ui.actions.edit')).toBe(getTranslation('ui.actions.edit'));
            expect(t('ui.slider.goToImage', { number: 1 })).toBe(
                getTranslation('ui.slider.goToImage', { number: 1 })
            );
        });
    });

    describe('operations translations', () => {
        it('should have translations for all entity operations', () => {
            expect(getTranslation('error.boundary.operations.view')).toBe('ver');
            expect(getTranslation('error.boundary.operations.edit')).toBe('editar');
            expect(getTranslation('error.boundary.operations.create')).toBe('crear');
            expect(getTranslation('error.boundary.operations.delete')).toBe('eliminar');
            expect(getTranslation('error.boundary.operations.list')).toBe('listar');
            expect(getTranslation('error.boundary.operations.access')).toBe('acceder');
        });
    });
});
