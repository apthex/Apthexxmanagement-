import type { NextRequest } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { noStoreJson, withApi } from "@/lib/http";
import { db } from "@/lib/db";
import { clients, members } from "@/lib/db/schema";
import { clientScope } from "@/lib/data/clients";
import { AUDIT_ACTIONS, writeAuditStandalone } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "members.read");

    const people = await db
      .select({
        id: members.id,
        name: members.name,
        accessLevel: members.accessLevel,
        roleTitle: members.roleTitle,
        status: members.status,
      })
      .from(members)
      .where(and(isNull(members.deletedAt), inArray(members.accessLevel, ["owner", "team", "growth"])))
      .orderBy(members.name);

    const accessibleClients = await db
      .select({ id: clients.id, company: clients.company, status: clients.status, serviceType: clients.serviceType })
      .from(clients)
      .where(and(isNull(clients.deletedAt), clientScope(session)))
      .orderBy(clients.company);

    await writeAuditStandalone({
      memberId: session.member.id,
      action: "lookup.read",
      entityType: "lookup",
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { people: people.length, clients: accessibleClients.length },
    });

    return noStoreJson({
      owners: people.filter((person) => person.accessLevel === "owner" && person.status === "active"),
      assignable: people.filter((person) => ["team", "growth"].includes(person.accessLevel) && person.status === "active"),
      people: people.filter((person) => person.status === "active"),
      clients: accessibleClients,
    });
  });
}
