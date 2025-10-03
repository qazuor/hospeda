import * as React from 'react';
import { useEntityFormContext } from '../context/EntityFormContext';
import { FormModeEnum } from '../enums/form-config.enums';

/**
 * Hook to access entity form context with additional utilities
 */
export const useEntityForm = () => {
    const context = useEntityFormContext();

    // Derived state
    const canSave = React.useMemo(() => {
        return context.hasUnsavedChanges() && !context.isSaving && !context.isLoading;
    }, [context]);

    const canDiscard = React.useMemo(() => {
        return context.hasUnsavedChanges() && !context.isSaving;
    }, [context]);

    const isViewMode = React.useMemo(() => {
        return context.mode === FormModeEnum.VIEW;
    }, [context.mode]);

    const isEditMode = React.useMemo(() => {
        return context.mode === FormModeEnum.EDIT;
    }, [context.mode]);

    // Utility functions
    const getFieldValue = React.useCallback(
        <T = unknown>(fieldId: string): T | undefined => {
            return context.values[fieldId] as T | undefined;
        },
        [context.values]
    );

    const getFieldError = React.useCallback(
        (fieldId: string): string | undefined => {
            return context.errors[fieldId];
        },
        [context.errors]
    );

    const hasFieldError = React.useCallback(
        (fieldId: string): boolean => {
            return Boolean(context.errors[fieldId]);
        },
        [context.errors]
    );

    const getSectionFields = React.useCallback(
        (sectionId: string) => {
            const section = context.config.sections.find((s) => s.id === sectionId);
            return section?.fields || [];
        },
        [context.config.sections]
    );

    const getVisibleSections = React.useCallback(() => {
        return context.config.sections.filter((section) => {
            // Check section permissions
            if (section.permissions?.view && section.permissions.view.length > 0) {
                const hasPermission = section.permissions.view.some((permission) =>
                    context.userPermissions.includes(permission)
                );
                if (!hasPermission) return false;
            }

            // TODO [029c627e-837c-4029-aca8-d7f930051e51]: Check section visibility conditions (visibleIf)
            // For now, show all permitted sections
            return true;
        });
    }, [context.config.sections, context.userPermissions]);

    const getEditableSections = React.useCallback(() => {
        return context.config.sections.filter((section) => {
            // Check section edit permissions
            if (section.permissions?.edit && section.permissions.edit.length > 0) {
                const hasPermission = section.permissions.edit.some((permission) =>
                    context.userPermissions.includes(permission)
                );
                if (!hasPermission) return false;
            }

            // TODO [0de46953-1f05-48af-84d6-a09f4eb2fdf9]: Check section editability conditions (editableIf)
            // For now, show all permitted sections
            return true;
        });
    }, [context.config.sections, context.userPermissions]);

    const switchToEditMode = React.useCallback(() => {
        context.setMode(FormModeEnum.EDIT);
    }, [context]);

    const switchToViewMode = React.useCallback(() => {
        context.setMode(FormModeEnum.VIEW);
    }, [context]);

    const goToSection = React.useCallback(
        (sectionId: string) => {
            const section = context.config.sections.find((s) => s.id === sectionId);
            if (section) {
                context.setActiveSection(sectionId);
            }
        },
        [context]
    );

    const goToNextSection = React.useCallback(() => {
        const currentIndex = context.config.sections.findIndex(
            (s) => s.id === context.activeSectionId
        );
        const nextIndex = currentIndex + 1;

        if (nextIndex < context.config.sections.length) {
            const nextSection = context.config.sections[nextIndex];
            context.setActiveSection(nextSection.id);
        }
    }, [context]);

    const goToPreviousSection = React.useCallback(() => {
        const currentIndex = context.config.sections.findIndex(
            (s) => s.id === context.activeSectionId
        );
        const prevIndex = currentIndex - 1;

        if (prevIndex >= 0) {
            const prevSection = context.config.sections[prevIndex];
            context.setActiveSection(prevSection.id);
        }
    }, [context]);

    // Keyboard shortcuts
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Ctrl+S or Cmd+S to save
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                if (canSave) {
                    context.save();
                }
            }

            // Escape to discard changes or switch to view mode
            if (event.key === 'Escape') {
                if (canDiscard) {
                    context.discard();
                } else if (isEditMode) {
                    switchToViewMode();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [canSave, canDiscard, isEditMode, context, switchToViewMode]);

    return {
        // Original context
        ...context,

        // Derived state
        canSave,
        canDiscard,
        isViewMode,
        isEditMode,

        // Utility functions
        getFieldValue,
        getFieldError,
        hasFieldError,
        getSectionFields,
        getVisibleSections,
        getEditableSections,

        // Navigation
        switchToEditMode,
        switchToViewMode,
        goToSection,
        goToNextSection,
        goToPreviousSection
    };
};
