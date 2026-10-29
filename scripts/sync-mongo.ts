import "./env";
import { db, closeDb } from "@/lib/db";
import {
  members,
  credentials,
  sessions,
  leads,
  leadEvents,
  clients,
  clientAssignments,
  tasks,
  taskComments,
  workLogs,
  meetings,
  financeEntries,
  auditEvents,
  rateLimits,
} from "@/lib/db/schema";
import { getMongoDb, clientPromise } from "@/lib/mongodb";

async function syncTable(
  mongoDb: any,
  collectionName: string,
  rows: any[],
  indexes?: Array<{ key: any; options?: any }>
) {
  const collection = mongoDb.collection(collectionName);
  
  if (indexes) {
    for (const idx of indexes) {
      try {
        await collection.createIndex(idx.key, idx.options || {});
      } catch (e: any) {
        console.warn(`Index note on ${collectionName}:`, e.message);
      }
    }
  }

  if (rows.length === 0) {
    console.log(`[${collectionName}] 0 rows (collection initialized with schema/indexes)`);
    return;
  }

  // Insert or update by 'id'
  let count = 0;
  for (const row of rows) {
    const filter = row.id ? { id: row.id } : { ...row };
    await collection.updateOne(filter, { $set: row }, { upsert: true });
    count++;
  }
  console.log(`[${collectionName}] Synced ${count} records to MongoDB`);
}

async function main() {
  console.log("Starting full database sync to MongoDB Atlas...");
  const mongoDb = await getMongoDb("Apthexx");

  // 1. Members
  const memberRows = await db.select().from(members);
  await syncTable(mongoDb, "members", memberRows, [
    { key: { email: 1 }, options: { unique: true } },
    { key: { accessLevel: 1 } },
    { key: { status: 1 } },
  ]);

  // 2. Credentials
  const credRows = await db.select().from(credentials);
  await syncTable(mongoDb, "credentials", credRows, [
    { key: { memberId: 1 }, options: { unique: true } },
    { key: { setupTokenHash: 1 } },
  ]);

  // 3. Sessions
  const sessionRows = await db.select().from(sessions);
  await syncTable(mongoDb, "sessions", sessionRows, [
    { key: { tokenHash: 1 }, options: { unique: true } },
    { key: { memberId: 1 } },
  ]);

  // 4. Leads
  const leadRows = await db.select().from(leads);
  await syncTable(mongoDb, "leads", leadRows, [
    { key: { stage: 1 } },
    { key: { ownerMemberId: 1 } },
  ]);

  // 5. Lead Events
  const leadEventRows = await db.select().from(leadEvents);
  await syncTable(mongoDb, "lead_events", leadEventRows, [
    { key: { leadId: 1, occurredAt: -1 } },
  ]);

  // 6. Clients
  const clientRows = await db.select().from(clients);
  await syncTable(mongoDb, "clients", clientRows, [
    { key: { ownerMemberId: 1 } },
    { key: { status: 1 } },
  ]);

  // 7. Client Assignments
  const assignmentRows = await db.select().from(clientAssignments);
  await syncTable(mongoDb, "client_assignments", assignmentRows, [
    { key: { clientId: 1, memberId: 1 } },
  ]);

  // 8. Tasks
  const taskRows = await db.select().from(tasks);
  await syncTable(mongoDb, "tasks", taskRows, [
    { key: { assigneeMemberId: 1 } },
    { key: { status: 1 } },
    { key: { dueOn: 1 } },
  ]);

  // 9. Task Comments
  const commentRows = await db.select().from(taskComments);
  await syncTable(mongoDb, "task_comments", commentRows, [
    { key: { taskId: 1, createdAt: 1 } },
  ]);

  // 10. Work Logs
  const workLogRows = await db.select().from(workLogs);
  await syncTable(mongoDb, "work_logs", workLogRows, [
    { key: { memberId: 1, logDate: 1 }, options: { unique: true } },
  ]);

  // 11. Meetings
  const meetingRows = await db.select().from(meetings);
  await syncTable(mongoDb, "meetings", meetingRows, [
    { key: { heldOn: 1 } },
    { key: { clientId: 1 } },
  ]);

  // 12. Finance Entries
  const financeRows = await db.select().from(financeEntries);
  await syncTable(mongoDb, "finance_entries", financeRows, [
    { key: { entryDate: 1 } },
    { key: { clientId: 1 } },
  ]);

  // 13. Audit Events
  const auditRows = await db.select().from(auditEvents);
  await syncTable(mongoDb, "audit_events", auditRows, [
    { key: { occurredAt: -1 } },
    { key: { memberId: 1 } },
    { key: { action: 1 } },
  ]);

  // 14. Rate Limits
  const rateLimitRows = await db.select().from(rateLimits);
  await syncTable(mongoDb, "rate_limits", rateLimitRows, [
    { key: { key: 1, windowStart: 1 }, options: { unique: true } },
  ]);

  console.log("\nALL ATTRIBUTES AND COLLECTIONS SUCCESSFULLY CREATED AND SYNCED TO MONGODB!");
  
  await closeDb();
  const mongoClient = await clientPromise;
  await mongoClient.close();
}

main().catch((err) => {
  console.error("Sync error:", err);
  process.exit(1);
});
