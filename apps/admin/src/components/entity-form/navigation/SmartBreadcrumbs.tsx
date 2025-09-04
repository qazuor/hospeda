import { Icon } from '@/components/icons/Icon';
import { cn } from '@/lib/utils';
import { useTranslations } from '@repo/i18n';
import React from 'react';
import type { SectionProgress } from '../../../hooks/useSectionProgress';

/**
 * Props for SmartBreadcrumbs component
 */
export interface SmartBreadcrumbsProps {
    /** Array of section progress data */
    sections: SectionProgress[];
    /** Currently active section ID */
    activeSectionId?: string;
    /** Callback when breadcrumb is clicked */
    onSectionSelect: (sectionId: string) => void;
    /** Whether to show status icons */
    showIcons?: boolean;
    /** Whether to show progress indicators */
    showProgress?: boolean;
    /** Maximum number of breadcrumbs to show before collapsing */
    maxVisible?: number;
    /** Additional CSS classes */
    className?: string;
    /** Separator between breadcrumbs */
    separator?: React.ReactNode;
}

/**
 * Get icon for section status
 */
const getSectionIcon = (status: SectionProgress['status']) => {
    switch (status) {
        case 'complete':
            return 'confirm';
        case 'error':
            return 'alert-triangle';
        case 'partial':
            return 'loader';
        case 'empty':
            return 'add';
        case 'disabled':
            return 'cancel';
        default:
            return 'add';
    }
};

/**
 * Get color classes for breadcrumb status
 */
const getBreadcrumbColors = (status: SectionProgress['status'], isActive: boolean) => {
    if (isActive) {
        return 'text-blue-600 font-semibold';
    }

    switch (status) {
        case 'complete':
            return 'text-green-600 hover:text-green-700';
        case 'error':
            return 'text-red-600 hover:text-red-700';
        case 'partial':
            return 'text-amber-600 hover:text-amber-700';
        case 'empty':
            return 'text-gray-500 hover:text-gray-600';
        case 'disabled':
            return 'text-gray-400 cursor-not-allowed';
        default:
            return 'text-gray-600 hover:text-gray-700';
    }
};

/**
 * Smart breadcrumbs component for entity form navigation
 * Shows section progress and allows quick navigation
 *
 * @example
 * ```tsx
 * <SmartBreadcrumbs
 *   sections={sectionProgress}
 *   activeSectionId={activeSection}
 *   onSectionSelect={handleSectionSelect}
 *   showIcons
 *   showProgress
 *   maxVisible={5}
 * />
 * ```
 */
export const SmartBreadcrumbs: React.FC<SmartBreadcrumbsProps> = ({
    sections,
    activeSectionId,
    onSectionSelect,
    showIcons = true,
    showProgress = false,
    maxVisible = 5,
    className,
    separator = (
        <Icon
            name="next"
            className="h-4 w-4 text-gray-400"
        />
    )
}) => {
    const { t } = useTranslations();

    // Filter visible sections
    const visibleSections = sections.filter((s) => s.isVisible && s.totalFields > 0);

    if (visibleSections.length === 0) {
        return null;
    }

    // Handle collapsing if too many sections
    const shouldCollapse = visibleSections.length > maxVisible;
    const activeIndex = visibleSections.findIndex((s) => s.id === activeSectionId);

    let displaySections = visibleSections;
    let showEllipsis = false;

    if (shouldCollapse) {
        const start = Math.max(0, activeIndex - Math.floor(maxVisible / 2));
        const end = Math.min(visibleSections.length, start + maxVisible);

        displaySections = visibleSections.slice(start, end);
        showEllipsis = start > 0 || end < visibleSections.length;
    }

    return (
        <nav
            className={cn('flex items-center space-x-1 text-sm', className)}
            aria-label="Breadcrumb"
        >
            <ol className="flex items-center space-x-1">
                {/* Show ellipsis at start if needed */}
                {showEllipsis && displaySections[0] !== visibleSections[0] && (
                    <>
                        <li>
                            <button
                                type="button"
                                onClick={() => onSectionSelect(visibleSections[0].id)}
                                className="flex items-center space-x-1 text-gray-500 hover:text-gray-700"
                            >
                                {showIcons && (
                                    <Icon
                                        name={getSectionIcon(visibleSections[0].status)}
                                        className="h-3 w-3"
                                    />
                                )}
                                <span className="max-w-[100px] truncate">
                                    {visibleSections[0].title}
                                </span>
                            </button>
                        </li>
                        <li className="flex items-center">
                            <span className="text-gray-400">...</span>
                        </li>
                        <li className="flex items-center">{separator}</li>
                    </>
                )}

                {displaySections.map((section, index) => {
                    const isActive = section.id === activeSectionId;
                    const isLast = index === displaySections.length - 1;
                    const isDisabled = section.status === 'disabled';

                    return (
                        <React.Fragment key={section.id}>
                            <li>
                                <button
                                    type="button"
                                    onClick={() => !isDisabled && onSectionSelect(section.id)}
                                    disabled={isDisabled}
                                    className={cn(
                                        'flex items-center space-x-1 transition-colors duration-200',
                                        getBreadcrumbColors(section.status, isActive),
                                        !isDisabled && 'hover:underline',
                                        isDisabled && 'cursor-not-allowed opacity-50'
                                    )}
                                    aria-current={isActive ? 'page' : undefined}
                                >
                                    {showIcons && (
                                        <Icon
                                            name={getSectionIcon(section.status)}
                                            className="h-3 w-3 flex-shrink-0"
                                        />
                                    )}

                                    <span className="max-w-[150px] truncate">{section.title}</span>

                                    {showProgress && section.totalFields > 0 && (
                                        <span className="ml-1 text-gray-500 text-xs">
                                            ({section.completedFields}/{section.totalFields})
                                        </span>
                                    )}

                                    {section.hasErrors && (
                                        <Icon
                                            name="alert-triangle"
                                            className="h-3 w-3 flex-shrink-0 text-red-500"
                                        />
                                    )}

                                    {section.isRequired && (
                                        <Icon
                                            name="alert-triangle"
                                            className="h-2 w-2 flex-shrink-0 text-red-400"
                                        />
                                    )}
                                </button>
                            </li>

                            {!isLast && <li className="flex items-center">{separator}</li>}
                        </React.Fragment>
                    );
                })}

                {/* Show ellipsis at end if needed */}
                {showEllipsis &&
                    displaySections[displaySections.length - 1] !==
                        visibleSections[visibleSections.length - 1] && (
                        <>
                            <li className="flex items-center">{separator}</li>
                            <li className="flex items-center">
                                <span className="text-gray-400">...</span>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onSectionSelect(
                                            visibleSections[visibleSections.length - 1].id
                                        )
                                    }
                                    className="flex items-center space-x-1 text-gray-500 hover:text-gray-700"
                                >
                                    {showIcons && (
                                        <Icon
                                            name={getSectionIcon(
                                                visibleSections[visibleSections.length - 1].status
                                            )}
                                            className="h-3 w-3"
                                        />
                                    )}
                                    <span className="max-w-[100px] truncate">
                                        {visibleSections[visibleSections.length - 1].title}
                                    </span>
                                </button>
                            </li>
                        </>
                    )}
            </ol>

            {/* Overall progress indicator */}
            {showProgress && (
                <div className="ml-4 flex items-center space-x-2 text-gray-500 text-xs">
                    <span>{t('ui.breadcrumbs.progress')}:</span>
                    <div className="flex items-center space-x-1">
                        <div className="h-2 w-16 rounded-full bg-gray-200">
                            <div
                                className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                                style={{
                                    width: `${(visibleSections.filter((s) => s.status === 'complete').length / visibleSections.length) * 100}%`
                                }}
                            />
                        </div>
                        <span className="font-medium">
                            {Math.round(
                                (visibleSections.filter((s) => s.status === 'complete').length /
                                    visibleSections.length) *
                                    100
                            )}
                            %
                        </span>
                    </div>
                </div>
            )}
        </nav>
    );
};
