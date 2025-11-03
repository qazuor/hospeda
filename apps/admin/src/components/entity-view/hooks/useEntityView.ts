import * as React from 'react';
import { useEntityViewContext } from '../context/EntityViewContext';

/**
 * Hook to access entity view context with additional utilities
 */
export const useEntityView = () => {
    const context = useEntityViewContext();

    // Derived state
    const hasData = React.useMemo(() => {
        return Object.keys(context.values).length > 0;
    }, [context.values]);

    const isEmpty = React.useMemo(() => {
        return !hasData;
    }, [hasData]);

    const isCardMode = React.useMemo(() => {
        return context.displayMode === 'card';
    }, [context.displayMode]);

    const isListMode = React.useMemo(() => {
        return context.displayMode === 'list';
    }, [context.displayMode]);

    const isCompactMode = React.useMemo(() => {
        return context.displayMode === 'compact';
    }, [context.displayMode]);

    const isDetailedMode = React.useMemo(() => {
        return context.displayMode === 'detailed';
    }, [context.displayMode]);

    // Utility functions
    const getFieldValue = React.useCallback(
        <T = unknown>(fieldId: string): T | undefined => {
            return context.values[fieldId] as T | undefined;
        },
        [context.values]
    );

    const hasFieldValue = React.useCallback(
        (fieldId: string): boolean => {
            const value = context.values[fieldId];
            return value !== null && value !== undefined && value !== '';
        },
        [context.values]
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

            // Check if section has any visible fields with data
            if (!context.showEmptyFields) {
                const hasVisibleFieldsWithData = section.fields.some((field) => {
                    // Check field permissions
                    if (field.permissions?.view && field.permissions.view.length > 0) {
                        const hasFieldPermission = field.permissions.view.some((permission) =>
                            context.userPermissions.includes(permission)
                        );
                        if (!hasFieldPermission) return false;
                    }

                    // Check if field has value
                    return hasFieldValue(field.id);
                });

                if (!hasVisibleFieldsWithData) return false;
            }

            // TODO: Check section visibility conditions (visibleIf)
            // For now, show all permitted sections
            return true;
        });
    }, [context.config.sections, context.userPermissions, context.showEmptyFields, hasFieldValue]);

    const getEditableFields = React.useCallback(() => {
        const editableFields: string[] = [];

        for (const section of context.config.sections) {
            // Check section edit permissions
            const sectionEditable =
                !section.permissions?.edit ||
                section.permissions.edit.length === 0 ||
                section.permissions.edit.some((permission) =>
                    context.userPermissions.includes(permission)
                );

            if (sectionEditable) {
                for (const field of section.fields) {
                    // Check field edit permissions
                    const fieldEditable =
                        !field.readonly &&
                        (!field.permissions?.edit ||
                            field.permissions.edit.length === 0 ||
                            field.permissions.edit.some((permission) =>
                                context.userPermissions.includes(permission)
                            ));

                    if (fieldEditable) {
                        editableFields.push(field.id);
                    }
                }
            }
        }

        return editableFields;
    }, [context.config.sections, context.userPermissions]);

    const canEditField = React.useCallback(
        (fieldId: string): boolean => {
            const editableFields = getEditableFields();
            return editableFields.includes(fieldId);
        },
        [getEditableFields]
    );

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
        const visibleSections = getVisibleSections();
        const currentIndex = visibleSections.findIndex((s) => s.id === context.activeSectionId);
        const nextIndex = currentIndex + 1;

        if (nextIndex < visibleSections.length) {
            const nextSection = visibleSections[nextIndex];
            context.setActiveSection(nextSection.id);
        }
    }, [context, getVisibleSections]);

    const goToPreviousSection = React.useCallback(() => {
        const visibleSections = getVisibleSections();
        const currentIndex = visibleSections.findIndex((s) => s.id === context.activeSectionId);
        const prevIndex = currentIndex - 1;

        if (prevIndex >= 0) {
            const prevSection = visibleSections[prevIndex];
            context.setActiveSection(prevSection.id);
        }
    }, [context, getVisibleSections]);

    const exportData = React.useCallback(() => {
        // Create a clean export of the visible data
        const exportData: Record<string, unknown> = {};
        const visibleSections = getVisibleSections();

        for (const section of visibleSections) {
            for (const field of section.fields) {
                // Check field permissions
                if (field.permissions?.view && field.permissions.view.length > 0) {
                    const hasFieldPermission = field.permissions.view.some((permission) =>
                        context.userPermissions.includes(permission)
                    );
                    if (!hasFieldPermission) continue;
                }

                const value = context.values[field.id];
                if (value !== null && value !== undefined) {
                    exportData[field.id] = value;
                }
            }
        }

        return exportData;
    }, [context.values, context.userPermissions, getVisibleSections]);

    const printView = React.useCallback(() => {
        // Trigger browser print dialog
        window.print();
    }, []);

    // Keyboard shortcuts
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Ctrl+P or Cmd+P to print
            if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
                event.preventDefault();
                printView();
            }

            // F5 to refresh
            if (event.key === 'F5') {
                event.preventDefault();
                context.refresh();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [context, printView]);

    return {
        // Original context
        ...context,

        // Derived state
        hasData,
        isEmpty,
        isCardMode,
        isListMode,
        isCompactMode,
        isDetailedMode,

        // Utility functions
        getFieldValue,
        hasFieldValue,
        getSectionFields,
        getVisibleSections,
        getEditableFields,
        canEditField,

        // Navigation
        goToSection,
        goToNextSection,
        goToPreviousSection,

        // Actions
        exportData,
        printView
    };
};
