import * as React from "react";
import { Button as MuiButton, type ButtonProps as MuiButtonProps } from "@mui/material";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Classes Tailwind mantidas para Calendar, Pagination e AlertDialog que ainda usam `buttonVariants`. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

const variantToMui: Record<
  NonNullable<ButtonVariant>,
  { variant: MuiButtonProps["variant"]; color: MuiButtonProps["color"] }
> = {
  default: { variant: "contained", color: "primary" },
  destructive: { variant: "contained", color: "error" },
  outline: { variant: "outlined", color: "primary" },
  secondary: { variant: "contained", color: "secondary" },
  ghost: { variant: "text", color: "primary" },
  link: { variant: "text", color: "primary" },
};

const sizeToMui: Record<NonNullable<ButtonSize>, MuiButtonProps["size"]> = {
  default: "medium",
  sm: "small",
  lg: "large",
  icon: "medium",
};

export interface ButtonProps extends Omit<MuiButtonProps, "variant" | "size" | "color"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild: _asChild, ...props }, ref) => {
    const m = variantToMui[variant];
    const iconSx =
      size === "icon"
        ? { minWidth: 40, width: 40, height: 40, padding: 0 }
        : undefined;
    return (
      <MuiButton
        ref={ref}
        variant={m.variant}
        color={m.color}
        size={sizeToMui[size]}
        className={className}
        disableElevation
        sx={{
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 1,
          ...(variant === "link" ? { textDecoration: "underline", minWidth: "auto" } : {}),
          ...iconSx,
        }}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
