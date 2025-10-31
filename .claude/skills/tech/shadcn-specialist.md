---
name: shadcn-specialist
category: tech
description: Shadcn/ui component specialist for consistent UI implementation across web and admin apps
usage: Use when adding UI components, customizing themes, or ensuring design system consistency
input: Component requirements, design specifications, theme configuration
output: Shadcn component implementations, theme customization, accessibility compliance
---

# Shadcn/ui Specialist

## Overview

**Purpose**: Expert guidance on implementing and customizing Shadcn/ui components for consistent, accessible UI across web and admin applications

**Category**: Tech
**Primary Users**: astro-engineer, tanstack-start-engineer, react-senior-dev, ui-ux-designer

## When to Use This Skill

- When adding new UI components
- Customizing Shadcn component themes
- Ensuring design system consistency
- Implementing accessible components
- Troubleshooting component behavior
- Migrating from other UI libraries
- Creating custom component variants

## Prerequisites

**Required:**

- Shadcn/ui installed in project
- Tailwind CSS configured
- Component registry set up
- Theme tokens defined

**Optional:**

- Design system documentation
- Figma designs
- Accessibility requirements (WCAG 2.1 Level AA)

## Workflow

### Step 1: Component Selection

**Objective**: Choose appropriate Shadcn components for requirements

**Actions:**

1. Review available Shadcn components
2. Check component documentation
3. Verify component fits use case
4. Plan component composition if needed

**Available Components:**

- **Forms**: Button, Input, Textarea, Select, Checkbox, Radio, Switch
- **Data Display**: Table, Card, Badge, Avatar, Separator
- **Feedback**: Alert, Toast, Dialog, AlertDialog, Sheet
- **Navigation**: Tabs, Dropdown, Command, Navigation Menu
- **Overlays**: Popover, Tooltip, HoverCard, Context Menu
- **Layout**: Accordion, Collapsible, Aspect Ratio, Scroll Area

**Validation:**

- [ ] Component available in Shadcn
- [ ] Component meets accessibility requirements
- [ ] Component supports required variants
- [ ] Component compatible with framework

**Output**: Selected components list

### Step 2: Component Installation

**Objective**: Install and configure Shadcn components

**Actions:**

1. **Install specific component**:

   ```bash
   npx shadcn-ui@latest add button
   npx shadcn-ui@latest add input
   npx shadcn-ui@latest add form
   ```

2. **Install multiple components**:

   ```bash
   npx shadcn-ui@latest add button input textarea select
   ```

3. **Verify installation**:
   - Check components appear in components/ui/
   - Verify imports work
   - Test component renders

4. **Configure component registry** (components.json):

   ```json
   {
     "style": "default",
     "rsc": true,
     "tsx": true,
     "tailwind": {
       "config": "tailwind.config.ts",
       "css": "src/styles/globals.css",
       "baseColor": "slate",
       "cssVariables": true
     },
     "aliases": {
       "components": "@/components",
       "utils": "@/lib/utils"
     }
   }
   ```

**Validation:**

- [ ] Components installed correctly
- [ ] No TypeScript errors
- [ ] Tailwind classes working
- [ ] Path aliases resolving

**Output**: Installed Shadcn components

### Step 3: Theme Customization

**Objective**: Customize theme to match brand guidelines

**Actions:**

1. **Define theme tokens** (globals.css):

   ```css
   @layer base {
     :root {
       --background: 0 0% 100%;
       --foreground: 222.2 84% 4.9%;
       --card: 0 0% 100%;
       --card-foreground: 222.2 84% 4.9%;
       --popover: 0 0% 100%;
       --popover-foreground: 222.2 84% 4.9%;
       --primary: 221.2 83.2% 53.3%;
       --primary-foreground: 210 40% 98%;
       --secondary: 210 40% 96.1%;
       --secondary-foreground: 222.2 47.4% 11.2%;
       --muted: 210 40% 96.1%;
       --muted-foreground: 215.4 16.3% 46.9%;
       --accent: 210 40% 96.1%;
       --accent-foreground: 222.2 47.4% 11.2%;
       --destructive: 0 84.2% 60.2%;
       --destructive-foreground: 210 40% 98%;
       --border: 214.3 31.8% 91.4%;
       --input: 214.3 31.8% 91.4%;
       --ring: 221.2 83.2% 53.3%;
       --radius: 0.5rem;
     }
  
     .dark {
       --background: 222.2 84% 4.9%;
       --foreground: 210 40% 98%;
       --card: 222.2 84% 4.9%;
       --card-foreground: 210 40% 98%;
       --popover: 222.2 84% 4.9%;
       --popover-foreground: 210 40% 98%;
       --primary: 217.2 91.2% 59.8%;
       --primary-foreground: 222.2 47.4% 11.2%;
       --secondary: 217.2 32.6% 17.5%;
       --secondary-foreground: 210 40% 98%;
       --muted: 217.2 32.6% 17.5%;
       --muted-foreground: 215 20.2% 65.1%;
       --accent: 217.2 32.6% 17.5%;
       --accent-foreground: 210 40% 98%;
       --destructive: 0 62.8% 30.6%;
       --destructive-foreground: 210 40% 98%;
       --border: 217.2 32.6% 17.5%;
       --input: 217.2 32.6% 17.5%;
       --ring: 224.3 76.3% 48%;
     }
   }
   ```

2. **Apply brand colors**:
   - Replace primary color with brand color
   - Adjust accent colors
   - Set custom radius values
   - Define semantic colors

3. **Test theme in light/dark modes**:
   - Verify contrast ratios (WCAG AA)
   - Test all component variants
   - Check color combinations

**Validation:**

- [ ] Theme colors match brand
- [ ] Dark mode works correctly
- [ ] Contrast ratios WCAG compliant
- [ ] All components use theme tokens

**Output**: Customized theme configuration

### Step 4: Component Implementation

**Objective**: Implement components following best practices

**Actions:**

1. **Basic component usage**:

   ```tsx
   import { Button } from '@/components/ui/button';

   export function MyComponent() {
     return (
       <Button variant="default" size="lg">
         Click me
       </Button>
     );
   }
   ```

2. **Form components with React Hook Form**:

   ```tsx
   import { useForm } from 'react-hook-form';
   import { zodResolver } from '@hookform/resolvers/zod';
   import { z } from 'zod';
   import { Button } from '@/components/ui/button';
   import {
     Form,
     FormControl,
     FormField,
     FormItem,
     FormLabel,
     FormMessage,
   } from '@/components/ui/form';
   import { Input } from '@/components/ui/input';

   const formSchema = z.object({
     email: z.string().email(),
     password: z.string().min(8),
   });

   export function LoginForm() {
     const form = useForm<z.infer<typeof formSchema>>({
       resolver: zodResolver(formSchema),
     });

     function onSubmit(values: z.infer<typeof formSchema>) {
       console.log(values);
     }

     return (
       <Form {...form}>
         <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
           <FormField
             control={form.control}
             name="email"
             render={({ field }) => (
               <FormItem>
                 <FormLabel>Email</FormLabel>
                 <FormControl>
                   <Input type="email" {...field} />
                 </FormControl>
                 <FormMessage />
               </FormItem>
             )}
           />
           <Button type="submit">Submit</Button>
         </form>
       </Form>
     );
   }
   ```

3. **Dialog/Modal implementation**:

   ```tsx
   import {
     Dialog,
     DialogContent,
     DialogDescription,
     DialogHeader,
     DialogTitle,
     DialogTrigger,
   } from '@/components/ui/dialog';

   export function ConfirmDialog() {
     return (
       <Dialog>
         <DialogTrigger asChild>
           <Button>Delete</Button>
         </DialogTrigger>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Are you sure?</DialogTitle>
             <DialogDescription>
               This action cannot be undone.
             </DialogDescription>
           </DialogHeader>
           <div className="flex justify-end gap-2">
             <Button variant="outline">Cancel</Button>
             <Button variant="destructive">Delete</Button>
           </div>
         </DialogContent>
       </Dialog>
     );
   }
   ```

4. **Data table implementation**:

   ```tsx
   import {
     Table,
     TableBody,
     TableCell,
     TableHead,
     TableHeader,
     TableRow,
   } from '@/components/ui/table';

   export function DataTable({ data }) {
     return (
       <Table>
         <TableHeader>
           <TableRow>
             <TableHead>Name</TableHead>
             <TableHead>Email</TableHead>
             <TableHead>Role</TableHead>
           </TableRow>
         </TableHeader>
         <TableBody>
           {data.map((item) => (
             <TableRow key={item.id}>
               <TableCell>{item.name}</TableCell>
               <TableCell>{item.email}</TableCell>
               <TableCell>{item.role}</TableCell>
             </TableRow>
           ))}
         </TableBody>
       </Table>
     );
   }
   ```

**Validation:**

- [ ] Components render correctly
- [ ] No TypeScript errors
- [ ] Styles applied correctly
- [ ] Interactive elements work

**Output**: Implemented components

### Step 5: Custom Variants

**Objective**: Create custom component variants for specific needs

**Actions:**

1. **Extend button variants**:

   ```tsx
   import { cva } from 'class-variance-authority';

   const buttonVariants = cva(
     'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
     {
       variants: {
         variant: {
           default: 'bg-primary text-primary-foreground hover:bg-primary/90',
           destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
           outline: 'border border-input bg-background hover:bg-accent',
           secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
           ghost: 'hover:bg-accent hover:text-accent-foreground',
           link: 'text-primary underline-offset-4 hover:underline',
           // Custom variants
           success: 'bg-green-600 text-white hover:bg-green-700',
           warning: 'bg-yellow-600 text-white hover:bg-yellow-700',
         },
         size: {
           default: 'h-10 px-4 py-2',
           sm: 'h-9 rounded-md px-3',
           lg: 'h-11 rounded-md px-8',
           icon: 'h-10 w-10',
         },
       },
       defaultVariants: {
         variant: 'default',
         size: 'default',
       },
     }
   );
   ```

2. **Custom badge variants**:

   ```tsx
   const badgeVariants = cva(
     'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
     {
       variants: {
         variant: {
           default: 'border-transparent bg-primary text-primary-foreground',
           // Custom status badges
           pending: 'border-yellow-500 bg-yellow-100 text-yellow-800',
           confirmed: 'border-green-500 bg-green-100 text-green-800',
           cancelled: 'border-red-500 bg-red-100 text-red-800',
         },
       },
     }
   );
   ```

**Validation:**

- [ ] Custom variants work correctly
- [ ] Variants follow design system
- [ ] TypeScript types updated
- [ ] Documentation added

**Output**: Custom component variants

### Step 6: Accessibility Compliance

**Objective**: Ensure all components meet WCAG 2.1 Level AA

**Actions:**

1. **Add ARIA labels**:

   ```tsx
   <Button aria-label="Close dialog">
     <X className="h-4 w-4" />
   </Button>
   ```

2. **Keyboard navigation**:
   - Test Tab navigation
   - Verify Enter/Space activation
   - Test Escape key for modals

3. **Focus management**:

   ```tsx
   import { useEffect, useRef } from 'react';

   export function Dialog({ open }) {
     const closeButtonRef = useRef<HTMLButtonElement>(null);

     useEffect(() => {
       if (open) {
         closeButtonRef.current?.focus();
       }
     }, [open]);

     return <Dialog>...</Dialog>;
   }
   ```

4. **Color contrast**:
   - Verify contrast ratios >= 4.5:1 (normal text)
   - Verify contrast ratios >= 3:1 (large text)
   - Test in both light and dark modes

**Validation:**

- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels present where needed
- [ ] Focus management correct
- [ ] Color contrast compliant

**Output**: Accessible component implementations

### Step 7: Testing

**Objective**: Test components thoroughly

**Actions:**

1. **Unit tests**:

   ```tsx
   import { render, screen } from '@testing-library/react';
   import { Button } from './button';

   describe('Button', () => {
     it('renders with correct text', () => {
       render(<Button>Click me</Button>);
       expect(screen.getByText('Click me')).toBeInTheDocument();
     });

     it('handles click events', () => {
       const handleClick = vi.fn();
       render(<Button onClick={handleClick}>Click</Button>);
       screen.getByText('Click').click();
       expect(handleClick).toHaveBeenCalled();
     });

     it('applies variant classes correctly', () => {
       const { container } = render(<Button variant="destructive">Delete</Button>);
       expect(container.firstChild).toHaveClass('bg-destructive');
     });
   });
   ```

2. **Accessibility tests**:

   ```tsx
   import { axe, toHaveNoViolations } from 'jest-axe';
   expect.extend(toHaveNoViolations);

   it('should not have accessibility violations', async () => {
     const { container } = render(<Button>Click me</Button>);
     const results = await axe(container);
     expect(results).toHaveNoViolations();
   });
   ```

3. **Visual regression tests**:
   - Use Playwright for screenshots
   - Test all variants
   - Test responsive behavior

**Validation:**

- [ ] All tests passing
- [ ] Coverage >= 90%
- [ ] No accessibility violations
- [ ] Visual regression tests passing

**Output**: Comprehensive test suite

## Output

**Produces:**

- Installed and configured Shadcn components
- Customized theme configuration
- Accessible component implementations
- Custom variants for specific needs
- Comprehensive test coverage

**Success Criteria:**

- All components render correctly
- Theme matches brand guidelines
- WCAG 2.1 Level AA compliance
- TypeScript types correct
- Tests passing with >= 90% coverage

## Common Patterns

### Form with Validation

```tsx
const formSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
});

function UserForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField name="name" render={...} />
        <FormField name="email" render={...} />
        <FormField name="role" render={...} />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}
```

### Confirmation Dialog

```tsx
function DeleteButton({ onConfirm }) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

## Best Practices

1. **Use Composition**: Combine primitives for complex components
2. **Theme Tokens**: Always use CSS variables, never hardcode colors
3. **Accessibility First**: ARIA labels, keyboard navigation, focus management
4. **TypeScript**: Leverage component prop types
5. **Variants**: Use CVA for consistent variant patterns
6. **Test Coverage**: >= 90% for all components
7. **Documentation**: Document custom variants and usage
8. **Responsive**: Test on mobile, tablet, desktop
9. **Dark Mode**: Test both themes
10. **Performance**: Lazy load heavy components

## Related Skills

- ui-ux-designer - Design system implementation
- accessibility-engineer - WCAG compliance
- react-senior-dev - React component patterns

## Notes

- Shadcn components are copy-paste, not npm packages
- Customize freely - you own the code
- Update components manually when Shadcn updates
- Use Tailwind arbitrary values sparingly
- Prefer theme tokens over direct colors
- Test accessibility with screen readers
- Keep component files under 500 lines

---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2025-10-31 | Initial version | @tech-lead | P-004 |
