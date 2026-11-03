"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  FileClock,
  Images,
  type LucideIcon,
  Settings,
  Shield,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";

import { cn } from "@/lib/cn";

export type BatchSection =
  | "overview"
  | "memories"
  | "timeline"
  | "upload"
  | "members"
  | "invite"
  | "moderation"
  | "audit-log"
  | "settings";

export interface BatchNavPermissions {
  canInvite: boolean;
  canModerate: boolean;
  canViewAuditLog: boolean;
  canEditSettings: boolean;
}

interface Tab {
  section: BatchSection;
  label: string;
  path: string;
  Icon: LucideIcon;
  /** Management tabs are present but visually quieter (design.md §15). */
  management?: boolean;
}

function tabsFor(permissions: BatchNavPermissions): Tab[] {
  const tabs: Tab[] = [
    { section: "memories", label: "Memories", path: "/memories", Icon: Images },
    { section: "timeline", label: "Timeline", path: "/timeline", Icon: Clock },
    { section: "upload", label: "Upload", path: "/upload", Icon: Upload },
    { section: "members", label: "Members", path: "/members", Icon: Users },
  ];
  if (permissions.canInvite) {
    tabs.push({ section: "invite", label: "Invite", path: "/invite", Icon: UserPlus, management: true });
  }
  if (permissions.canModerate) {
    tabs.push({ section: "moderation", label: "Moderation", path: "/moderation", Icon: Shield, management: true });
  }
  if (permissions.canViewAuditLog) {
    tabs.push({ section: "audit-log", label: "Audit log", path: "/audit-log", Icon: FileClock, management: true });
  }
  if (permissions.canEditSettings) {
    tabs.push({ section: "settings", label: "Settings", path: "/settings", Icon: Settings, management: true });
  }
  return tabs;
}

/**
 * Batch-level navigation (design.md §15): a horizontally scrolling tab strip
 * on phones, a plain row on wider screens. Every tab is scoped to this one
 * batch; management tabs only render when the caller's role allows — a
 * convenience, never the enforcement (security.md §3, §11).
 */
export function BatchNav({
  batchId,
  permissions,
  current,
}: {
  batchId: string;
  permissions: BatchNavPermissions;
  current: BatchSection;
}) {
  const pathname = usePathname();
  const base = `/batches/${batchId}`;
  const tabs = tabsFor(permissions);

  return (
    <nav aria-label="Batch sections" className="-mx-4 sm:mx-0">
      <ul className="scrollbar-none flex gap-1 overflow-x-auto px-4 sm:px-0 sm:flex-wrap">
        {tabs.map(({ section, label, path, Icon, management }) => {
          const href = `${base}${path}`;
          const active =
            current === section || pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={section} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-body-sm font-medium transition-colors",
                  active
                    ? "border-transparent bg-foreground text-background"
                    : management
                      ? "border-transparent text-foreground-muted hover:bg-surface-sunken hover:text-foreground"
                      : "border-border bg-surface text-foreground-muted hover:border-border-strong hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
