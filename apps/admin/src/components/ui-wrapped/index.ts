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

// Layout Components
// export { Separator } from './Separator';
// export type { SeparatorProps } from './Separator';

// Feedback Components
// export { Alert, AlertDescription, AlertTitle } from './Alert';
// export type { AlertProps } from './Alert';

// export { Toast, ToastProvider } from './Toast';
// export type { ToastProps } from './Toast';

// Navigation Components
// export { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';
// export type { TabsProps } from './Tabs';

// export {
//     Breadcrumb,
//     BreadcrumbItem,
//     BreadcrumbLink,
//     BreadcrumbList,
//     BreadcrumbSeparator
// } from './Breadcrumb';
// export type { BreadcrumbProps } from './Breadcrumb';

// Overlay Components
// export {
//     Dialog,
//     DialogContent,
//     DialogDescription,
//     DialogFooter,
//     DialogHeader,
//     DialogTitle,
//     DialogTrigger
// } from './Dialog';
// export type { DialogProps } from './Dialog';

// export {
//     Sheet,
//     SheetContent,
//     SheetDescription,
//     SheetFooter,
//     SheetHeader,
//     SheetTitle,
//     SheetTrigger
// } from './Sheet';
// export type { SheetProps } from './Sheet';

// Data Display Components
// export {
//     Table,
//     TableBody,
//     TableCaption,
//     TableCell,
//     TableHead,
//     TableHeader,
//     TableRow
// } from './Table';
// export type { TableProps } from './Table';

// export { Avatar, AvatarFallback, AvatarImage } from './Avatar';
// export type { AvatarProps } from './Avatar';

// Form Components
// export {
//     Form,
//     FormControl,
//     FormDescription,
//     FormField,
//     FormItem,
//     FormLabel,
//     FormMessage
// } from './Form';
// export type { FormProps } from './Form';

// Utility Components
// export { Skeleton } from './Skeleton';
// export type { SkeletonProps } from './Skeleton';

// export { ScrollArea } from './ScrollArea';
// export type { ScrollAreaProps } from './ScrollArea';
