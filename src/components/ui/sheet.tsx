"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"

/**
 * A bottom sheet built on the same Base UI Dialog the rest of the app uses,
 * rather than pulling in a Radix-based drawer library. Two primitive systems
 * would compete over focus trapping and portal ordering.
 */
function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetContent({
  className,
  children,
  side = "bottom",
  ...props
}: DialogPrimitive.Popup.Props & { side?: "bottom" | "left" }) {
  return (
    <DialogPrimitive.Portal data-slot="sheet-portal">
      <DialogPrimitive.Backdrop
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-black/40 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col bg-popover text-popover-foreground shadow-lg outline-none duration-200",
          side === "bottom" && [
            "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl",
            // Clears the home indicator on gesture-nav phones.
            "pb-[env(safe-area-inset-bottom)]",
            "data-open:animate-in data-open:slide-in-from-bottom",
            "data-closed:animate-out data-closed:slide-out-to-bottom",
          ],
          side === "left" && [
            "inset-y-0 left-0 w-[85vw] max-w-sm",
            "data-open:animate-in data-open:slide-in-from-left",
            "data-closed:animate-out data-closed:slide-out-to-left",
          ],
          className
        )}
        {...props}
      >
        {side === "bottom" ? (
          <div
            aria-hidden
            className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30"
          />
        ) : null}
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent }
