import { describe, expect, it } from "vitest";
import {
  can,
  isOwner,
  landingPath,
  ROLE_PERMISSIONS,
  type AccessLevel,
  type Permission,
} from "@/lib/role-access";
import { scopeToMember } from "@/lib/permissions";
import { tasks } from "@/lib/db/schema";

describe("Role and Permission Matrix (Build Spec Pages 4-5)", () => {
  it("grants OWNER full access to all capabilities", () => {
    const ownerPermissions = ROLE_PERMISSIONS.owner;
    expect(isOwner("owner")).toBe(true);

    const requiredForOwner: Permission[] = [
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

    for (const perm of requiredForOwner) {
      expect(can("owner", perm), `Owner must have ${perm}`).toBe(true);
    }
  });

  it("strictly restricts TEAM role to own tasks, logs, assigned clients, and directory", () => {
    expect(isOwner("team")).toBe(false);

    // Permitted
    expect(can("team", "dashboard.view")).toBe(true);
    expect(can("team", "clients.read")).toBe(true);
    expect(can("team", "tasks.read")).toBe(true);
    expect(can("team", "tasks.update_own")).toBe(true);
    expect(can("team", "worklogs.write_own")).toBe(true);
    expect(can("team", "meetings.read")).toBe(true);
    expect(can("team", "members.read")).toBe(true);

    // Denied by spec
    expect(can("team", "leads.read")).toBe(false);
    expect(can("team", "leads.write")).toBe(false);
    expect(can("team", "leads.delete")).toBe(false);
    expect(can("team", "clients.write")).toBe(false);
    expect(can("team", "clients.assign")).toBe(false);
    expect(can("team", "tasks.create")).toBe(false);
    expect(can("team", "worklogs.read_all")).toBe(false);
    expect(can("team", "worklogs.rate")).toBe(false);
    expect(can("team", "meetings.write")).toBe(false);
    expect(can("team", "members.write")).toBe(false);
    expect(can("team", "finance.read")).toBe(false);
    expect(can("team", "finance.write")).toBe(false);
    expect(can("team", "audit.read")).toBe(false);
    expect(can("team", "liveweb.read")).toBe(false);
  });

  it("strictly restricts GROWTH role: leads, clients, own tasks/logs, LiveWeb; no finance/audit/admin", () => {
    expect(isOwner("growth")).toBe(false);

    // Permitted
    expect(can("growth", "dashboard.view")).toBe(true);
    expect(can("growth", "leads.read")).toBe(true);
    expect(can("growth", "leads.write")).toBe(true);
    expect(can("growth", "clients.read")).toBe(true);
    expect(can("growth", "clients.write")).toBe(true);
    expect(can("growth", "tasks.read")).toBe(true);
    expect(can("growth", "tasks.update_own")).toBe(true);
    expect(can("growth", "worklogs.write_own")).toBe(true);
    expect(can("growth", "meetings.read")).toBe(true);
    expect(can("growth", "members.read")).toBe(true);
    expect(can("growth", "liveweb.read")).toBe(true);

    // Denied by spec
    expect(can("growth", "leads.delete")).toBe(false);
    expect(can("growth", "clients.assign")).toBe(false);
    expect(can("growth", "tasks.create")).toBe(false);
    expect(can("growth", "worklogs.read_all")).toBe(false);
    expect(can("growth", "worklogs.rate")).toBe(false);
    expect(can("growth", "meetings.write")).toBe(false);
    expect(can("growth", "members.write")).toBe(false);
    expect(can("growth", "finance.read")).toBe(false);
    expect(can("growth", "finance.write")).toBe(false);
    expect(can("growth", "audit.read")).toBe(false);
  });

  it("strictly restricts VIEWER role to read-only dashboard, leads, clients, meetings", () => {
    expect(isOwner("viewer")).toBe(false);
    expect(landingPath("viewer")).toBe("/leads");

    // Permitted
    expect(can("viewer", "dashboard.view")).toBe(true);
    expect(can("viewer", "leads.read")).toBe(true);
    expect(can("viewer", "clients.read")).toBe(true);
    expect(can("viewer", "meetings.read")).toBe(true);

    // Denied
    expect(can("viewer", "leads.write")).toBe(false);
    expect(can("viewer", "leads.delete")).toBe(false);
    expect(can("viewer", "clients.write")).toBe(false);
    expect(can("viewer", "clients.assign")).toBe(false);
    expect(can("viewer", "tasks.read")).toBe(false);
    expect(can("viewer", "tasks.create")).toBe(false);
    expect(can("viewer", "tasks.update_own")).toBe(false);
    expect(can("viewer", "worklogs.write_own")).toBe(false);
    expect(can("viewer", "worklogs.read_all")).toBe(false);
    expect(can("viewer", "worklogs.rate")).toBe(false);
    expect(can("viewer", "meetings.write")).toBe(false);
    expect(can("viewer", "members.read")).toBe(false);
    expect(can("viewer", "members.write")).toBe(false);
    expect(can("viewer", "finance.read")).toBe(false);
    expect(can("viewer", "finance.write")).toBe(false);
    expect(can("viewer", "audit.read")).toBe(false);
    expect(can("viewer", "liveweb.read")).toBe(false);
  });

  it("scopeToMember correctly enforces row-level restriction for non-owners and bypasses for owners", () => {
    const ownerSession = { member: { id: "dev-owner-uuid", accessLevel: "owner" as AccessLevel } };
    const teamSession = { member: { id: "shubham-team-uuid", accessLevel: "team" as AccessLevel } };

    const ownerScope = scopeToMember(tasks.assigneeMemberId, ownerSession);
    expect(ownerScope).toBeUndefined(); // Owner bypasses query restriction

    const teamScope = scopeToMember(tasks.assigneeMemberId, teamSession);
    expect(teamScope).toBeDefined(); // Team must have SQL eq filter
  });
});
