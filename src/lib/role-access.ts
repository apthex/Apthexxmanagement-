/**
 * Pure role capability matrix. Kept free of database imports so client
 * components can decide what to render without shipping server code.
 * This is a UX mirror only — every API route re-checks the same matrix.
 */

export type AccessLevel = "owner" | "team" | "growth" | "viewer";

export type Permission =
  | "dashboard.view"
  | "leads.read"
  | "leads.write"
  | "leads.delete"
  | "clients.read"
  | "clients.write"
  | "clients.assign"
  | "tasks.read"
  | "tasks.create"
  | "tasks.update_own"
  | "worklogs.write_own"
  | "worklogs.read_all"
  | "worklogs.rate"
  | "meetings.read"
  | "meetings.write"
  | "members.read"
  | "members.write"
  | "finance.read"
  | "finance.write"
  | "audit.read"
  | "liveweb.read";

const OWNER: Permission[] = [
  "dashboard.view",
  "leads.read",
  "leads.write",
  "leads.delete",
  "clients.read",
  "clients.write",
  "clients.assign",
  "tasks.read",
  "tasks.create",
  "tasks.update_own",
  "worklogs.write_own",
  "worklogs.read_all",
  "worklogs.rate",
  "meetings.read",
  "meetings.write",
  "members.read",
  "members.write",
  "finance.read",
  "finance.write",
  "audit.read",
  "liveweb.read",
];

const TEAM: Permission[] = [
  "dashboard.view",
  "clients.read",
  "tasks.read",
  "tasks.update_own",
  "worklogs.write_own",
  "meetings.read",
  "members.read",
];

const GROWTH: Permission[] = [
  "dashboard.view",
  "leads.read",
  "leads.write",
  "clients.read",
  "clients.write",
  "tasks.read",
  "tasks.update_own",
  "worklogs.write_own",
  "meetings.read",
  "members.read",
  "liveweb.read",
];

const VIEWER: Permission[] = [
  "dashboard.view",
  "leads.read",
  "clients.read",
  "meetings.read",
];

export const ROLE_PERMISSIONS: Record<AccessLevel, ReadonlySet<Permission>> = {
  owner: new Set(OWNER),
  team: new Set(TEAM),
  growth: new Set(GROWTH),
  viewer: new Set(VIEWER),
};

export const ROLE_LABELS: Record<AccessLevel, string> = {
  owner: "Owner",
  team: "Team",
  growth: "Growth",
  viewer: "Viewer",
};

export function can(role: AccessLevel, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function isOwner(role: AccessLevel): boolean {
  return role === "owner";
}

export function landingPath(role: AccessLevel): string {
  if (role === "viewer") return "/leads";
  return "/dashboard";
}

export const ALL_PERMISSIONS = Object.freeze([
  ...new Set(Object.values(ROLE_PERMISSIONS).flatMap((set) => [...set])),
]);
