import { DayPicker, type DayPickerProps } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shadcn calendar with the project's semantic colors and button control. */
export function Calendar({ className, ...props }: DayPickerProps) {
  return <DayPicker {...props} className={cn("pointer-events-auto p-3", className)} classNames={{
    months: "relative", month: "space-y-3", month_caption: "flex h-9 items-center justify-center px-10",
    caption_label: "text-sm font-medium", nav: "absolute inset-x-0 top-0 flex justify-between",
    month_grid: "w-full border-collapse", weekdays: "", weekday: "h-8 w-9 text-xs font-normal text-muted-foreground",
    day: "h-9 w-9 p-0 text-center text-sm", day_button: "h-9 w-9 rounded-md hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring",
    selected: "rounded-md bg-primary text-primary-foreground", today: "font-semibold underline", outside: "text-muted-foreground opacity-50", disabled: "opacity-30", hidden: "invisible",
  }} components={{
    Chevron: ({ orientation }) => orientation === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
    PreviousMonthButton: ({ children, ...buttonProps }) => <Button {...buttonProps} variant="ghost" size="icon">{children}</Button>,
    NextMonthButton: ({ children, ...buttonProps }) => <Button {...buttonProps} variant="ghost" size="icon">{children}</Button>,
  }} />;
}