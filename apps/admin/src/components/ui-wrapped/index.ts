/**
 * @file UI Wrapped Components Index
 *
 * This file exports all wrapped UI components that encapsulate Shadcn components.
 * This abstraction allows us to easily migrate to different UI libraries in the future
 * without changing the consuming code.
 *
 * @example
 * ```tsx
 * // Instead of importing from @/components/ui directly:
 * import { Button } from '@/components/ui/button';
 *
 * // Import from our wrapped components:
 * import { Button } from '@/components/ui-wrapped';
 * ```
 */

// Core UI Components - Currently Implemented
export { Button } from './Button';
export type { ButtonProps } from './Button';

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card';
export type { CardContentProps, CardHeaderProps, CardProps } from './Card';

export { Badge } from './Badge';
export type { BadgeProps } from './Badge';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';
export type { TabsContentProps, TabsListProps, TabsProps, TabsTriggerProps } from './Tabs';

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './Accordion';
export type {
    AccordionContentProps,
    AccordionItemProps,
    AccordionProps,
    AccordionTriggerProps
} from './Accordion';

export { Textarea } from './Textarea';
export type { TextareaProps } from './Textarea';

export {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue
} from './Select';
export type {
    SelectContentProps,
    SelectItemProps,
    SelectLabelProps,
    SelectProps,
    SelectTriggerProps
} from './Select';

export { Checkbox } from './Checkbox';
export type { CheckboxProps } from './Checkbox';

export { Label } from './Label';
export type { LabelProps } from './Label';

export { Switch } from './Switch';
export type { SwitchProps } from './Switch';
