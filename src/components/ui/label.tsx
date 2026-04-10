import * as React from "react";
import FormLabel from "@mui/material/FormLabel";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");

export interface LabelProps
  extends Omit<React.ComponentProps<typeof FormLabel>, "color">,
    VariantProps<typeof labelVariants> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  <FormLabel
    ref={ref}
    className={cn(labelVariants(), className)}
    sx={{ color: "text.primary", "&.Mui-focused": { color: "text.primary" } }}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
