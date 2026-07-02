import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}

export default function EmptyState({ icon: Icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="mt-2 flex flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center">
      <Icon className="text-muted-foreground" size={40} aria-hidden="true" />
      <p className="text-base font-semibold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {action.label}
          </button>
        )
      )}
      {secondaryAction && (
        <button
          onClick={secondaryAction.onClick}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          {secondaryAction.icon && <secondaryAction.icon size={15} aria-hidden="true" />}
          {secondaryAction.label}
        </button>
      )}
    </div>
  );
}
