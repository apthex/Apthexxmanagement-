import { eq } from "drizzle-orm";
import type { AccessLevel } from "@/lib/role-access";

export {
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  can,
  isOwner,
  landingPath,
  ALL_PERMISSIONS,
} from "@/lib/role-access";
export type { AccessLevel, Permission } from "@/lib/role-access";

type UUIDColumn = Parameters<typeof eq>[0];

/**
 * Equivalent of the spec's scopeToMember(query, session): restrict a
 * member-owned query to the signed-in member, unless the member is an owner.
 * Never accept the member id from a request parameter.
 */
export function scopeToMember(column: UUIDColumn, session: { member: { id: string; accessLevel: AccessLevel } }) {
  if (session.member.accessLevel === "owner") return undefined;
  return eq(column, session.member.id);
}
