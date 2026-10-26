/**
 * LOCAL / STAGING DEMO SEED ONLY — fake data, fake accounts.
 * Never run against production. All emails end in .test.
 */
import "./env";
import { sql } from "drizzle-orm";
import { closeDb, db } from "@/lib/db";
import {
  clientAssignments,
  clients,
  credentials,
  financeEntries,
  leadEvents,
  leads,
  meetings,
  members,
  tasks,
  workLogs,
  type AccessLevel,
} from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { currentStep, encryptTotpSecretForSeed, seedRecoveryHashes } from "@/lib/auth/seed-helpers";
import { addDays, istToday, weekRange } from "@/lib/dates";

const PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "Apthex-local-owner-2026";
const TOTP_SECRET = process.env.SEED_TOTP_SECRET ?? "JBSWY3DPEHPK3PXPJBSWY3DP";

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
    throw new Error("Refusing to seed fake data in production");
  }
  const [existing] = await db.select({ total: sql<number>`count(*)::int` }).from(members);
  if (Number(existing?.total ?? 0) > 0) {
    console.log("Database already contains members; seed skipped. Use npm run db:reset-local to start over.");
    await closeDb();
    return;
  }

  const passwordHash = await hashPassword(PASSWORD);
  const today = istToday();
  const week = weekRange(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const rowCreatedAt = new Date();

  const created = await db.transaction(async (tx) => {
    const [devendra] = await tx
      .insert(members)
      .values({
        name: "Devendra Hyalij",
        email: "devendra@apthex.test",
        roleTitle: "Founder & CTO",
        accessLevel: "owner",
        joinedOn: "2025-01-15",
        status: "active",
        createdAt: rowCreatedAt,
        updatedAt: rowCreatedAt,
      })
      .returning();

    const people: Array<{
      name: string;
      email: string;
      roleTitle: string;
      accessLevel: AccessLevel;
      joinedOn: string;
    }> = [
      { name: "Pranav Patil", email: "pranav@apthex.test", roleTitle: "Founder & CEO", accessLevel: "owner", joinedOn: "2025-01-15" },
      { name: "Shubham Jadhav", email: "shubham@apthex.test", roleTitle: "Developer", accessLevel: "team", joinedOn: "2026-10-01" },
      { name: "Rishi Shakya", email: "rishi@apthex.test", roleTitle: "Penetration Tester", accessLevel: "team", joinedOn: "2026-10-01" },
      { name: "Om Kale", email: "om@apthex.test", roleTitle: "Media", accessLevel: "growth", joinedOn: "2026-09-10" },
      { name: "Meera Joshi", email: "meera@apthex.test", roleTitle: "Advisor", accessLevel: "viewer", joinedOn: "2026-08-01" },
    ];

    const otherMembers = [];
    for (const person of people) {
      const [member] = await tx
        .insert(members)
        .values({
          ...person,
          status: "active",
          createdBy: devendra.id,
          createdAt: rowCreatedAt,
          updatedAt: rowCreatedAt,
        })
        .returning();
      otherMembers.push(member);
    }
    const [pranav, shubham, rishi, om, meera] = otherMembers;

    const allMembers = [devendra, pranav, shubham, rishi, om, meera];
    for (const member of allMembers) {
      const recovery = await seedRecoveryHashes();
      await tx.insert(credentials).values({
        memberId: member.id,
        passwordHash,
        totpSecret: encryptTotpSecretForSeed(TOTP_SECRET),
        totpEnrolledAt: rowCreatedAt,
        recoveryCodeHashes: recovery.hashes,
        lastTotpStep: null,
        failedAttempts: 0,
        createdBy: devendra.id,
        createdAt: rowCreatedAt,
        updatedAt: rowCreatedAt,
      });
    }

    const leadRows = [
      { company: "Zenith Infotech", contactName: "Aakash Rane", contactEmail: "aakash@zenith.test", source: "Referral", stage: "identified" as const, ownerMemberId: pranav.id, value: 85_000_00, nextAction: "Send intro note", days: 3, notes: "Met at Nashik tech meetup." },
      { company: "Nashik Dental Group", contactName: "Dr. Pooja Deshmukh", contactEmail: "pooja@ndg.test", source: "LinkedIn", stage: "identified" as const, ownerMemberId: pranav.id, value: 60_000_00, nextAction: "Qualify requirement", days: 5, notes: "Three clinics, no internal IT." },
      { company: "Matoshree College", contactName: "Prof. S. Kulkarni", contactEmail: "sk@matoshree.test", source: "Inbound", stage: "talking" as const, ownerMemberId: devendra.id, value: 1_40_000_00, nextAction: "Follow up on lab scope", days: 1, notes: "Wants awareness training plus a lab setup." },
      { company: "Arcadia Retail", contactName: "Nikhil Shah", contactEmail: "nikhil@arcadia.test", source: "Partner", stage: "talking" as const, ownerMemberId: pranav.id, value: 2_20_000_00, nextAction: "Discovery call", days: 2, notes: "E-commerce estate, 4 brands." },
      { company: "KVN Naik College", contactName: "Dr. K. Naik", contactEmail: "kvn@kvn.test", source: "Referral", stage: "pitched" as const, ownerMemberId: devendra.id, value: 3_50_000_00, nextAction: "Awaiting committee approval", days: 6, notes: "Proposal sent for VAPT + awareness." },
      { company: "BrandGoesUp", contactName: "Rhea Kapoor", contactEmail: "rhea@bgu.test", source: "LinkedIn", stage: "won" as const, ownerMemberId: pranav.id, value: 1_50_000_00, nextAction: null, days: null, notes: "Monthly retainer, converted in October." },
      { company: "Suvarna Hospital", contactName: "Dr. Suvarna", contactEmail: "office@suvarna.test", source: "Referral", stage: "won" as const, ownerMemberId: pranav.id, value: 1_80_000_00, nextAction: null, days: null, notes: "Awareness programme for staff." },
      { company: "Halo Media", contactName: "A. Singh", contactEmail: "a@halo.test", source: "Cold outreach", stage: "lost" as const, ownerMemberId: devendra.id, value: 40_000_00, nextAction: null, days: null, notes: "Budget deferred to next year." },
    ];

    const leadIds: Record<string, string> = {};
    for (const lead of leadRows) {
      const [row] = await tx
        .insert(leads)
        .values({
          company: lead.company,
          contactName: lead.contactName,
          contactEmail: lead.contactEmail,
          source: lead.source,
          stage: lead.stage,
          ownerMemberId: lead.ownerMemberId,
          valueEstimatePaise: lead.value,
          nextAction: lead.nextAction,
          nextActionOn: lead.days === null ? null : addDays(today, lead.days),
          notes: lead.notes,
          createdBy: lead.ownerMemberId,
          createdAt: rowCreatedAt,
          updatedAt: rowCreatedAt,
        })
        .returning();
      leadIds[lead.company] = row.id;
      if (lead.stage !== "identified") {
        await tx.insert(leadEvents).values({
          leadId: row.id,
          memberId: lead.ownerMemberId,
          fromStage: "identified",
          toStage: lead.stage,
          note:
            lead.stage === "won"
              ? "Converted — working with us. No agreement was required to become a client."
              : `Moved to ${lead.stage}.`,
          occurredAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        });
      }
    }

    const clientDefs = [
      { company: "BrandGoesUp", lead: "BrandGoesUp", owner: pranav, service: "vapt" as const, agreement: "signed" as const, status: "active" as const, scope: "External VAPT for the marketing platform, quarterly retainer. Scope covers 14 subdomains and the public API." },
      { company: "KVN Naik College", lead: "KVN Naik College", owner: devendra, service: "vapt" as const, agreement: "sent" as const, status: "active" as const, scope: "Web application and lab network assessment for the computer science department." },
      { company: "Suvarna Hospital", lead: "Suvarna Hospital", owner: pranav, service: "awareness" as const, agreement: "none" as const, status: "active" as const, scope: "Staff awareness sessions and phishing simulation. No signed agreement — active by owner decision." },
      { company: "Arcadia Retail", lead: "Arcadia Retail", owner: pranav, service: "other" as const, agreement: "draft" as const, status: "on_hold" as const, scope: "Security review across four storefronts. Paused pending board approval." },
    ];

    const clientIds: Record<string, string> = {};
    for (const def of clientDefs) {
      const [client] = await tx
        .insert(clients)
        .values({
          leadId: leadIds[def.lead],
          company: def.company,
          ownerMemberId: def.owner.id,
          serviceType: def.service,
          contactName: def.company === "BrandGoesUp" ? "Rhea Kapoor" : null,
          contactEmail: def.company === "BrandGoesUp" ? "rhea@bgu.test" : null,
          scopeOfWork: def.scope,
          agreementStatus: def.agreement,
          agreementRef: def.agreement === "none" ? null : `ATX-${def.company.slice(0, 3).toUpperCase()}-2026`,
          agreementSignedOn: def.agreement === "signed" ? addDays(today, -20) : null,
          status: def.status,
          notes: def.company === "Suvarna Hospital" ? "No agreement on file. Work approved by Devendra." : null,
          createdBy: def.owner.id,
          createdAt: rowCreatedAt,
          updatedAt: rowCreatedAt,
        })
        .returning();
      clientIds[def.company] = client.id;
    }

    for (const [client, member] of [
      [clientIds["BrandGoesUp"], rishi],
      [clientIds["BrandGoesUp"], shubham],
      [clientIds["KVN Naik College"], rishi],
      [clientIds["Suvarna Hospital"], shubham],
    ] as const) {
      await tx.insert(clientAssignments).values({
        clientId: client,
        memberId: member.id,
        assignedBy: rishi.accessLevel === "team" ? devendra.id : devendra.id,
        createdBy: devendra.id,
        createdAt: rowCreatedAt,
        updatedAt: rowCreatedAt,
      });
    }

    const taskDefs = [
      { title: "Finish KVN scope document", assignee: shubham, client: clientIds["KVN Naik College"], due: addDays(today, -2), status: "in_progress" as const, description: "Map the lab network and finalise the testing window." },
      { title: "Recon — BrandGoesUp", assignee: rishi, client: clientIds["BrandGoesUp"], due: addDays(today, -1), status: "in_progress" as const, description: "Subdomain review, 14 hosts mapped. Confirm ownership boundary." },
      { title: "Portal — auth module", assignee: shubham, client: null, due: addDays(today, 3), status: "todo" as const, description: "Session revocation and audit writer." },
      { title: "October reel — edit", assignee: om, client: null, due: addDays(today, 1), status: "in_progress" as const, description: "Cut the founder interview into a 45-second vertical reel." },
      { title: "Suvarna proposal", assignee: pranav, client: clientIds["Suvarna Hospital"], due: today, status: "todo" as const, description: "Send revised scope and pricing." },
      { title: "Lab plan — KVN Naik", assignee: rishi, client: clientIds["KVN Naik College"], due: addDays(today, 4), status: "blocked" as const, description: "Waiting on the college network diagram." },
      { title: "Close September books", assignee: devendra, client: null, due: addDays(today, -4), status: "done" as const, description: "Reconcile tooling and payroll entries." },
      { title: "Review BrandGoesUp report", assignee: devendra, client: clientIds["BrandGoesUp"], due: addDays(today, 2), status: "todo" as const, description: "Technical review before delivery." },
    ];
    const taskIds: string[] = [];
    for (const task of taskDefs) {
      const [row] = await tx
        .insert(tasks)
        .values({
          title: task.title,
          description: task.description,
          assigneeMemberId: task.assignee.id,
          clientId: task.client,
          dueOn: task.due,
          status: task.status,
          completedAt: task.status === "done" ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) : null,
          createdBy: devendra.id,
          createdAt: rowCreatedAt,
          updatedAt: rowCreatedAt,
        })
        .returning();
      taskIds.push(row.id);
    }

    const logDefs = [
      { member: rishi, date: addDays(today, -1), summary: "Recon on BrandGoesUp, 14 subdomains mapped; began auth boundary review.", hours: "6.50", rating: 4 },
      { member: shubham, date: addDays(today, -1), summary: "Login and session handling, started the audit writer.", hours: "7.50", rating: 5 },
      { member: om, date: addDays(today, -1), summary: "Reel cut, two carousels drafted.", hours: "4.00", rating: 3 },
      { member: pranav, date: addDays(today, -1), summary: "Suvarna call, proposal revised and sent.", hours: "5.00", rating: 4 },
      { member: shubham, date: today, summary: "Permissions module and audit transaction wiring; tasks and members screens next.", hours: "6.00", rating: null },
      { member: rishi, date: today, summary: "KVN lab scope review and BrandGoesUp retest plan.", hours: "5.25", rating: null },
    ];
    for (const log of logDefs) {
      await tx.insert(workLogs).values({
        memberId: log.member.id,
        logDate: log.date,
        summary: log.summary,
        hours: log.hours,
        taskIds: [],
        rating: log.rating,
        ratedBy: log.rating ? devendra.id : null,
        createdBy: log.member.id,
        createdAt: rowCreatedAt,
        updatedAt: rowCreatedAt,
      });
    }

    const meetingDefs = [
      { title: "Morning standup", date: addDays(week.start, 3), client: null, attendees: [devendra.id, pranav.id, shubham.id, rishi.id], notes: "Blockers: KVN network diagram. Portal demo on Friday." },
      { title: "Suvarna — scoping call", date: addDays(week.start, 2), client: clientIds["Suvarna Hospital"], attendees: [devendra.id, pranav.id], notes: "Wants internal and external awareness. Scope two groups. Quote at ₹1,300/hr, send by Friday. Pranav to follow up Thursday." },
      { title: "KVN Naik — lab plan", date: addDays(week.start, 1), client: clientIds["KVN Naik College"], attendees: [devendra.id, rishi.id], notes: "College will share network topology. Lab access from 09:00 daily." },
      { title: "Internal — portal kickoff", date: week.start, client: null, attendees: [devendra.id, pranav.id, shubham.id], notes: "Phases agreed. Shubham works on staging only. Devendra reviews permissions and audit." },
    ];
    for (const meeting of meetingDefs) {
      await tx.insert(meetings).values({
        title: meeting.title,
        heldOn: meeting.date,
        clientId: meeting.client,
        attendeeMemberIds: meeting.attendees,
        externalAttendees: meeting.client === clientIds["Suvarna Hospital"] ? "Dr. Suvarna, two staff coordinators" : null,
        notes: meeting.notes,
        createdBy: devendra.id,
        createdAt: rowCreatedAt,
        updatedAt: rowCreatedAt,
      });
    }

    const financeDefs = [
      { day: addDays(today, -6), direction: "in" as const, amount: 1_50_000_00, description: "BrandGoesUp — Oct retainer", category: "services" as const, client: clientIds["BrandGoesUp"] },
      { day: addDays(today, -9), direction: "in" as const, amount: 65_000_00, description: "KVN Naik — lab setup advance", category: "services" as const, client: clientIds["KVN Naik College"] },
      { day: addDays(today, -4), direction: "out" as const, amount: 38_400_00, description: "Burp Suite Pro renewal", category: "tools" as const, client: null },
      { day: addDays(today, -3), direction: "out" as const, amount: 34_000_00, description: "Intern stipends", category: "payroll" as const, client: null },
      { day: addDays(today, -11), direction: "out" as const, amount: 12_500_00, description: "Cloud infrastructure — October", category: "infrastructure" as const, client: null },
    ];
    for (const entry of financeDefs) {
      await tx.insert(financeEntries).values({
        entryDate: entry.day < monthStart ? monthStart : entry.day,
        direction: entry.direction,
        amountPaise: entry.amount,
        description: entry.description,
        category: entry.category,
        clientId: entry.client,
        createdBy: devendra.id,
        createdAt: rowCreatedAt,
        updatedAt: rowCreatedAt,
      });
    }

    return { members: allMembers.length, leads: leadIds, clients: clientIds };
  });

  console.log(`Seeded ${created.members} members, fake leads, clients, tasks, work logs, meetings and finance entries.`);
  console.log(`Sign in with ${process.env.SEED_OWNER_EMAIL ?? "devendra@apthex.test"} / ${PASSWORD}`);
  console.log("TOTP seed secret:", TOTP_SECRET, `(current step ${currentStep()})`);
  console.log("Run `npm run otp -- devendra@apthex.test` to print a current code.");
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
