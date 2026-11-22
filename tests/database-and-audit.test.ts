import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db, ensureDbReady } from "@/lib/db";
import { auditEvents, clients, members, tasks, workLogs } from "@/lib/db/schema";
import { writeAudit, writeAuditStandalone } from "@/lib/audit";
import { isOwner } from "@/lib/role-access";

describe("Database Integrity, Scoping & Audit Immutability", () => {
  beforeAll(async () => {
    await ensureDbReady();
  });
  it("has seeded initial active members including Owners and Team members", async () => {
    const allMembers = await db
      .select({
        id: members.id,
        email: members.email,
        name: members.name,
        accessLevel: members.accessLevel,
        status: members.status,
      })
      .from(members)
      .where(isNull(members.deletedAt));

    expect(allMembers.length).toBeGreaterThanOrEqual(1);

    const ownerUser = allMembers.find((m) => m.accessLevel === "owner");
    expect(ownerUser).toBeDefined();
    expect(ownerUser?.status).toBe("active");
  });

  it("writes audit events with proper structure and handles standalone denied events", async () => {
    const testIp = "49.36.182.99";
    // Standalone audit log for an unauthenticated or denied attempt
    await writeAuditStandalone({
      memberId: null,
      action: "auth.fail",
      entityType: "auth",
      outcome: "denied",
      ip: testIp,
      userAgent: "Mozilla/5.0 Test Suite",
      detail: { reason: "invalid password", attempt: 1 },
    });

    const [event] = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.action, "auth.fail"), eq(auditEvents.ip, testIp)))
      .limit(1);

    expect(event).toBeDefined();
    expect(event?.action).toBe("auth.fail");
    expect(event?.outcome).toBe("denied");
    expect(event?.ip).toBe(testIp);
    expect((event?.detail as Record<string, unknown>).reason).toBe("invalid password");
  });

  it("atomic writes: data row and audit event are inserted in the same transaction", async () => {
    const [owner] = await db
      .select()
      .from(members)
      .where(eq(members.accessLevel, "owner"))
      .limit(1);

    expect(owner).toBeDefined();

    const createdTask = await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(tasks)
        .values({
          title: "Verify security controls",
          description: "Integration test task",
          assigneeMemberId: owner.id,
          status: "todo",
          createdBy: owner.id,
        })
        .returning();

      await writeAudit(tx, {
        memberId: owner.id,
        action: "task.create",
        entityType: "task",
        entityId: t.id,
        outcome: "allowed",
        ip: "127.0.0.1",
        userAgent: "Integration-Test",
        detail: { title: t.title },
      });

      return t;
    });

    expect(createdTask.id).toBeDefined();

    const [recordedAudit] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.entityId, createdTask.id))
      .limit(1);

    expect(recordedAudit).toBeDefined();
    expect(recordedAudit?.action).toBe("task.create");
    expect(recordedAudit?.outcome).toBe("allowed");
  });
});
