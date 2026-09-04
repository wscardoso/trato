"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Link2,
  PlusCircle,
  Users,
  Wallet,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/app/novo", label: "Novo", icon: PlusCircle },
  { href: "/app/link", label: "Link", icon: Link2 },
  { href: "/app/clientes", label: "Clientes", icon: Users },
  { href: "/app/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/app/relatorios", label: "Relatórios", icon: BarChart3 },
] as const;

const PRIMARY = new Set(["/app/agenda", "/app/novo", "/app/link"]);

type Props = { variant: "bottom" | "side" };

export function AppNav({ variant }: Props) {
  const pathname = usePathname();
  const items =
    variant === "bottom" ? LINKS.filter((l) => PRIMARY.has(l.href)) : LINKS;

  if (variant === "bottom") {
    return (
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium",
                  active
                    ? "text-[var(--copper)]"
                    : "text-[var(--steel)] active:text-[var(--offwhite)]",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <nav className="sticky top-20 space-y-1 rounded-2xl border border-[var(--border)] bg-[var(--lead)] p-2">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
              active
                ? "bg-[var(--brand-soft)] text-[var(--copper)]"
                : "text-[var(--steel)] hover:bg-[var(--surface-2)] hover:text-[var(--offwhite)]",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
