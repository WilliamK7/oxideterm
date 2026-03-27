import * as React from "react"
import { cn } from "../../lib/utils"

const Progress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: number; indeterminate?: boolean }
>(({ className, value, indeterminate, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-theme-bg-panel border border-theme-border",
      className
    )}
    {...props}
  >
    <div
      className={cn(
        "h-full flex-1 bg-theme-accent",
        indeterminate
          ? "w-1/3 animate-[progress-indeterminate_1.5s_ease-in-out_infinite]"
          : "w-full transition-all"
      )}
      style={indeterminate ? undefined : { transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </div>
))
Progress.displayName = "Progress"

export { Progress }
