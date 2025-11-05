# Component Library Guide

Complete guide to Shadcn UI components and the admin component library in Hospeda.

---

## 📖 Overview

The Hospeda Admin Dashboard uses **Shadcn UI** - a collection of beautifully designed, accessible, and customizable components built with Radix UI and Tailwind CSS. Unlike traditional component libraries, Shadcn components are **copied into your project**, giving you full control.

**What you'll learn:**

- Available components overview
- Form components (Input, Textarea, Select, Checkbox, etc.)
- Data display (Table, Card, Badge, Avatar)
- Feedback (Alert, Toast, Dialog, Dropdown Menu)
- Navigation (Tabs, Breadcrumb, Pagination)
- Customizing components with variants
- Creating reusable compound components
- Accessibility best practices
- Theme customization

**Prerequisites:**

- Understanding of React components
- Basic Tailwind CSS knowledge
- TypeScript familiarity

---

## 🎯 Quick Start

### Adding a Component

```bash
# From admin directory
cd apps/admin

# Add a single component
pnpx shadcn@latest add button

# Add multiple components
pnpx shadcn@latest add button dialog input
```

### Using a Component

```tsx
import { Button } from '@/components/ui/button';

export function MyComponent() {
  return (
    <Button onClick={() => console.log('Clicked!')}>
      Click me
    </Button>
  );
}
```

---

## 📦 Available Components

### Form Components

**Button**

```tsx
import { Button } from '@/components/ui/button';

<Button variant="default">Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>

<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>

<Button disabled>Disabled</Button>
<Button loading>Loading...</Button>
```

**Variants:**

- `default` - Primary button
- `outline` - Outlined button
- `ghost` - Transparent button
- `destructive` - Danger/delete actions
- `link` - Link-styled button

**Input**

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="you@example.com"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
</div>

// With error
<Input
  type="text"
  className="border-red-500"
  aria-invalid="true"
/>
<p className="text-red-600 text-sm">This field is required</p>
```

**Textarea**

```tsx
import { Textarea } from '@/components/ui/textarea';

<Textarea
  placeholder="Enter your message..."
  rows={4}
  value={message}
  onChange={(e) => setMessage(e.target.value)}
/>
```

**Select**

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select a category" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="hotel">Hotel</SelectItem>
    <SelectItem value="hostel">Hostel</SelectItem>
    <SelectItem value="apartment">Apartment</SelectItem>
  </SelectContent>
</Select>
```

**Checkbox**

```tsx
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

<div className="flex items-center space-x-2">
  <Checkbox
    id="terms"
    checked={accepted}
    onCheckedChange={setAccepted}
  />
  <Label htmlFor="terms">Accept terms and conditions</Label>
</div>
```

**Radio Group**

```tsx
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

<RadioGroup value={value} onValueChange={setValue}>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="public" id="public" />
    <Label htmlFor="public">Public</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="private" id="private" />
    <Label htmlFor="private">Private</Label>
  </div>
</RadioGroup>
```

**Switch**

```tsx
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

<div className="flex items-center space-x-2">
  <Switch
    id="notifications"
    checked={enabled}
    onCheckedChange={setEnabled}
  />
  <Label htmlFor="notifications">Enable notifications</Label>
</div>
```

### Data Display

**Card**

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Accommodation Details</CardTitle>
    <CardDescription>View and edit accommodation information</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Save Changes</Button>
  </CardFooter>
</Card>
```

**Badge**

```tsx
import { Badge } from '@/components/ui/badge';

<Badge variant="default">Active</Badge>
<Badge variant="secondary">Pending</Badge>
<Badge variant="destructive">Inactive</Badge>
<Badge variant="outline">Draft</Badge>
```

**Avatar**

```tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

<Avatar>
  <AvatarImage src={user.imageUrl} alt={user.name} />
  <AvatarFallback>{user.initials}</AvatarFallback>
</Avatar>
```

**Table**

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Email</TableHead>
      <TableHead>Role</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {users.map((user) => (
      <TableRow key={user.id}>
        <TableCell>{user.name}</TableCell>
        <TableCell>{user.email}</TableCell>
        <TableCell>{user.role}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Feedback

**Alert**

```tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

// Success
<Alert variant="default">
  <CheckCircle2 className="h-4 w-4" />
  <AlertTitle>Success!</AlertTitle>
  <AlertDescription>
    Your accommodation has been created successfully.
  </AlertDescription>
</Alert>

// Error
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    There was a problem with your request.
  </AlertDescription>
</Alert>
```

**Toast**

```tsx
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export function MyComponent() {
  const { toast } = useToast();

  return (
    <Button
      onClick={() => {
        toast({
          title: 'Success!',
          description: 'Your changes have been saved.',
        });
      }}
    >
      Save
    </Button>
  );
}

// Success toast
toast({
  title: 'Success!',
  description: 'Accommodation created successfully.',
});

// Error toast
toast({
  title: 'Error',
  description: 'Failed to save changes.',
  variant: 'destructive',
});

// With action
toast({
  title: 'Deleted',
  description: 'Accommodation has been deleted.',
  action: (
    <Button variant="outline" size="sm" onClick={handleUndo}>
      Undo
    </Button>
  ),
});
```

**Dialog**

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Delete</DialogTitle>
      <DialogDescription>
        Are you sure you want to delete this accommodation?
        This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={handleDelete}>
        Delete
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Dropdown Menu**

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>Actions</DropdownMenuLabel>
    <DropdownMenuItem onClick={handleEdit}>
      Edit
    </DropdownMenuItem>
    <DropdownMenuItem onClick={handleDuplicate}>
      Duplicate
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      onClick={handleDelete}
      className="text-red-600"
    >
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Popover**

```tsx
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">Open Popover</Button>
  </PopoverTrigger>
  <PopoverContent>
    <div className="space-y-2">
      <h4 className="font-medium">Settings</h4>
      <p className="text-muted-foreground text-sm">
        Configure your preferences
      </p>
    </div>
  </PopoverContent>
</Popover>
```

### Navigation

**Tabs**

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

<Tabs defaultValue="details">
  <TabsList>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="photos">Photos</TabsTrigger>
    <TabsTrigger value="amenities">Amenities</TabsTrigger>
  </TabsList>
  <TabsContent value="details">
    <DetailsForm />
  </TabsContent>
  <TabsContent value="photos">
    <PhotoGallery />
  </TabsContent>
  <TabsContent value="amenities">
    <AmenitiesList />
  </TabsContent>
</Tabs>
```

**Breadcrumb**

```tsx
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="/accommodations">
        Accommodations
      </BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Beach House</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

**Pagination**

```tsx
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious href="/accommodations?page=1" />
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="/accommodations?page=1">1</PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="/accommodations?page=2" isActive>
        2
      </PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="/accommodations?page=3">3</PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationEllipsis />
    </PaginationItem>
    <PaginationItem>
      <PaginationNext href="/accommodations?page=3" />
    </PaginationItem>
  </PaginationContent>
</Pagination>
```

---

## 🎨 Customizing Components

### Component Variants

Use CVA (Class Variance Authority) for variants:

```tsx
// components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary/90',
        outline: 'border border-input bg-transparent hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        default: 'h-10 px-4',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
```

**Usage:**

```tsx
<Button variant="outline" size="sm">Small Outline</Button>
<Button variant="destructive" size="lg">Large Destructive</Button>
```

### Adding Custom Variants

```tsx
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white',
        outline: 'border border-input',
        ghost: 'hover:bg-accent',
        destructive: 'bg-destructive text-white',
        // Add custom variant
        success: 'bg-green-600 text-white hover:bg-green-700',
      },
      size: {
        sm: 'h-9 px-3',
        default: 'h-10 px-4',
        lg: 'h-11 px-8',
        // Add custom size
        xs: 'h-8 px-2 text-xs',
      },
    },
  }
);
```

### Extending Components

```tsx
// components/LoadingButton.tsx
import { Button, type ButtonProps } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type LoadingButtonProps = ButtonProps & {
  loading?: boolean;
  loadingText?: string;
};

export function LoadingButton({
  loading,
  loadingText,
  children,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={loading || disabled} {...props}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {loading ? loadingText || 'Loading...' : children}
    </Button>
  );
}
```

**Usage:**

```tsx
<LoadingButton
  loading={isSubmitting}
  loadingText="Saving..."
  onClick={handleSave}
>
  Save Changes
</LoadingButton>
```

---

## 🧩 Compound Components

### Form Field Component

```tsx
// components/FormField.tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FormFieldProps = {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function FormField({
  label,
  error,
  required,
  className,
  id,
  ...props
}: FormFieldProps) {
  const fieldId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={fieldId}>
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        id={fieldId}
        aria-invalid={!!error}
        className={cn(error && 'border-red-500')}
        {...props}
      />
      {error && (
        <p className="text-red-600 text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

**Usage:**

```tsx
<FormField
  label="Email Address"
  type="email"
  required
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={errors.email}
/>
```

### Confirmation Dialog

```tsx
// components/ConfirmDialog.tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
};

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelText}
          </Button>
          <Button variant={variant} onClick={onConfirm}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Usage:**

```tsx
export function DeleteButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    await deleteAccommodation(id);
    setOpen(false);
  };

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleDelete}
        title="Delete Accommodation"
        description="Are you sure? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}
```

### Data Table Component

```tsx
// components/DataTable.tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ColumnDef } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

type DataTableProps<TData> = {
  columns: ColumnDef<TData>[];
  data: TData[];
};

export function DataTable<TData>({ columns, data }: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

## ♿ Accessibility Best Practices

### Keyboard Navigation

**✅ DO:**

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button> {/* Focusable */}
  </DialogTrigger>
  <DialogContent>
    <Input autoFocus /> {/* Focus on open */}
  </DialogContent>
</Dialog>
```

### ARIA Labels

**✅ DO:**

```tsx
<Button aria-label="Delete accommodation">
  <Trash2 className="h-4 w-4" />
</Button>

<Input
  aria-describedby="email-error"
  aria-invalid={!!error}
/>
{error && (
  <p id="email-error" role="alert">
    {error}
  </p>
)}
```

### Focus Management

**✅ DO:**

```tsx
export function Modal({ open, onClose }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modal Title</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button ref={closeButtonRef} onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 🎨 Theme Customization

### Tailwind Configuration

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
      },
    },
  },
};
```

### CSS Variables

```css
/* styles.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
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
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark mode colors */
  }
}
```

---

## 💡 Best Practices

### Component Organization

**✅ DO:**

```text
components/
├── ui/              # Shadcn components
│   ├── button.tsx
│   ├── dialog.tsx
│   └── ...
├── forms/           # Form-specific components
│   ├── FormField.tsx
│   └── FormSection.tsx
├── layout/          # Layout components
│   ├── Header.tsx
│   └── Sidebar.tsx
└── features/        # Feature-specific components
```

### Use Composition

**✅ DO:**

```tsx
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
  </DialogContent>
</Dialog>
```

### Type Safety

**✅ DO:**

```tsx
import type { ButtonProps } from '@/components/ui/button';

type MyButtonProps = ButtonProps & {
  customProp: string;
};

export function MyButton({ customProp, ...props }: MyButtonProps) {
  return <Button {...props} />;
}
```

---

## 📖 Additional Resources

### Official Documentation

- **[Shadcn UI](https://ui.shadcn.com/)** - Component documentation
- **[Radix UI](https://www.radix-ui.com/)** - Primitives documentation
- **[Tailwind CSS](https://tailwindcss.com/)** - Styling documentation

### Internal Resources

- **[Forms Guide](./forms.md)** - Form patterns
- **[Tables Guide](./tables.md)** - Table patterns

---

⬅️ Back to [Development Documentation](./README.md)
