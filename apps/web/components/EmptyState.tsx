/**
 * Estado vacío reutilizable para listas/secciones sin contenido: icono,
 * título, descripción opcional y hasta dos acciones (una primaria destacada,
 * otra secundaria en forma de enlace de texto). Genérico y sin lógica de
 * negocio — todo el comportamiento se inyecta vía props.
 */
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/** Acción mostrada en el estado vacío: si trae `href` se renderiza como enlace, si no como botón con `onClick`. */
interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  /** Icono opcional mostrado junto a la etiqueta (solo se usa en `secondaryAction`). */
  icon?: LucideIcon;
}

/** Props de {@link EmptyState}. */
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Acción principal, renderizada como botón/enlace destacado (`bg-primary`). */
  action?: EmptyStateAction;
  /** Acción secundaria, renderizada como enlace de texto discreto debajo de la principal. */
  secondaryAction?: EmptyStateAction;
}

/** Renderiza el bloque de estado vacío con borde discontinuo, icono, texto y acciones. */
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
