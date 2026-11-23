// Icon vocabulary for the module (lucide). Kept in the UI layer: the domain
// registry stays React-free, and a permit type with no icon here falls back to
// a generic one, so adding a type still needs no UI change.
import {
  ArrowUpToLine,
  Ban,
  BadgeCheck,
  CheckCheck,
  CircleX,
  Cylinder,
  FileWarning,
  Flame,
  Hourglass,
  OctagonPause,
  Pencil,
  Play,
  ShieldCheck,
  Shovel,
  TimerOff,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { PermitStatus } from "@/domain/enums";

export const TYPE_ICONS: Record<string, LucideIcon> = {
  HOT_WORK: Flame,
  CONFINED_SPACE: Cylinder,
  WORKING_AT_HEIGHT: ArrowUpToLine,
  ELECTRICAL_LOTO: Zap,
  EXCAVATION: Shovel,
};

export function typeIcon(type: string): LucideIcon {
  return TYPE_ICONS[type] ?? FileWarning;
}

/** Each status: an icon, and a tone from the reserved status palette. */
export const STATUS_META: Record<PermitStatus, { icon: LucideIcon; tone: "neutral" | "info" | "warning" | "good" | "critical" | "done" | "muted" }> = {
  DRAFT: { icon: Pencil, tone: "neutral" },
  PENDING_APPROVAL: { icon: Hourglass, tone: "warning" },
  APPROVED: { icon: BadgeCheck, tone: "info" },
  ACTIVE: { icon: Play, tone: "good" },
  SUSPENDED: { icon: OctagonPause, tone: "critical" },
  CLOSED: { icon: CheckCheck, tone: "info" },
  CLOSED_VERIFIED: { icon: ShieldCheck, tone: "done" },
  REJECTED: { icon: CircleX, tone: "critical" },
  EXPIRED: { icon: TimerOff, tone: "muted" },
  CANCELLED: { icon: Ban, tone: "muted" },
};
