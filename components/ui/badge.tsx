import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "brand";
  size?: "sm" | "md";
  className?: string;
}

const variantStyles = {
  default: "bg-white/[0.06] text-white/70 border-white/[0.06]",
  success: "bg-success/15 text-success border-success/20",
  warning: "bg-warning/15 text-warning border-warning/20",
  danger: "bg-danger/15 text-danger border-danger/20",
  info: "bg-info/15 text-info border-info/20",
  brand: "bg-brand-500/15 text-brand-400 border-brand-500/20",
};

export function Badge({ children, variant = "default", size = "sm", className = "" }: BadgeProps) {
  const sizeStyles = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-lg border ${variantStyles[variant]} ${sizeStyles} ${className}`}
    >
      {children}
    </span>
  );
}

// ─── Task-specific badges ──────────────────────────────

const statusConfig = {
  Todo: { label: "Todo", variant: "default" as const },
  InProgress: { label: "In Progress", variant: "info" as const },
  Done: { label: "Done", variant: "success" as const },
  Cancelled: { label: "Cancelled", variant: "danger" as const },
};

const priorityConfig = {
  Low: { label: "Low", variant: "default" as const },
  Medium: { label: "Medium", variant: "info" as const },
  High: { label: "High", variant: "warning" as const },
  Critical: { label: "Critical", variant: "danger" as const },
};

const categoryConfig = {
  Work: { label: "Work", variant: "brand" as const },
  Personal: { label: "Personal", variant: "success" as const },
};

export function TaskStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.Todo;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function TaskPriorityBadge({ priority }: { priority: string }) {
  const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.Medium;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function TaskCategoryBadge({ category }: { category: string }) {
  const config = categoryConfig[category as keyof typeof categoryConfig] || categoryConfig.Work;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
