import * as React from 'react';
import {
    EntityViewContext,
    type EntityViewContextValue,
    type EntityViewProviderProps,
    type ViewDisplayMode
} from '../context/EntityViewContext';

/**
 * Entity view provider component that manages view state and actions
 */
export const EntityViewProvider: React.FC<EntityViewProviderProps> = ({
    config,
    values,
    userPermissions,
    displayMode = 'card',
    showEmptyFields = false,
    showEditControls = false,
    isLoading = false,
    getLinkUrl,
    onFieldEdit,
    onEntityLink,
    onRefresh,
    children
}) => {
    // View state
    const [currentDisplayMode, setCurrentDisplayMode] =
        React.useState<ViewDisplayMode>(displayMode);
    const [showEmpty, setShowEmpty] = React.useState(showEmptyFields);
    const [showEditCtrls, setShowEditCtrls] = React.useState(showEditControls);
    const [activeSectionId, setActiveSectionId] = React.useState<string | undefined>(
        config.sections[0]?.id
    );

    // View actions
    const setDisplayMode = React.useCallback((mode: ViewDisplayMode) => {
        setCurrentDisplayMode(mode);
    }, []);

    const toggleShowEmptyFields = React.useCallback(() => {
        setShowEmpty((prev) => !prev);
    }, []);

    const toggleShowEditControls = React.useCallback(() => {
        setShowEditCtrls((prev) => !prev);
    }, []);

    const setActiveSection = React.useCallback((sectionId: string) => {
        setActiveSectionId(sectionId);
    }, []);

    const handleFieldEdit = React.useCallback(
        (fieldId: string) => {
            onFieldEdit?.(fieldId);
        },
        [onFieldEdit]
    );

    const handleEntityLink = React.useCallback(
        (id: string, entityType: string) => {
            onEntityLink?.(id, entityType);
        },
        [onEntityLink]
    );

    const refresh = React.useCallback(async () => {
        if (onRefresh) {
            await onRefresh();
        }
    }, [onRefresh]);

    // Context value
    const contextValue: EntityViewContextValue = React.useMemo(
        () => ({
            // State
            config,
            values,
            userPermissions,
            displayMode: currentDisplayMode,
            showEmptyFields: showEmpty,
            showEditControls: showEditCtrls,
            activeSectionId,
            isLoading,
            getLinkUrl,

            // Actions
            setDisplayMode,
            toggleShowEmptyFields,
            toggleShowEditControls,
            setActiveSection,
            handleFieldEdit,
            handleEntityLink,
            refresh
        }),
        [
            config,
            values,
            userPermissions,
            currentDisplayMode,
            showEmpty,
            showEditCtrls,
            activeSectionId,
            isLoading,
            getLinkUrl,
            setDisplayMode,
            toggleShowEmptyFields,
            toggleShowEditControls,
            setActiveSection,
            handleFieldEdit,
            handleEntityLink,
            refresh
        ]
    );

    return <EntityViewContext.Provider value={contextValue}>{children}</EntityViewContext.Provider>;
};
