export type { AccessLevel } from "@/lib/role-access";
import type { AccessLevel } from "@/lib/role-access";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  accessLevel: AccessLevel;
};

export type LeadStage = "identified" | "talking" | "pitched" | "won" | "lost";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type ServiceType = "awareness" | "vapt" | "other";
export type AgreementStatus = "none" | "draft" | "sent" | "signed" | "expired";
export type ClientStatus = "active" | "on_hold" | "closed";
export type FinanceDirection = "in" | "out";
export type FinanceCategory = "services" | "tools" | "payroll" | "infrastructure" | "travel" | "other";

export type LeadRow = {
  id: string;
  company: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  source: string | null;
  stage: LeadStage;
  ownerMemberId: string;
  ownerName: string;
  valueEstimatePaise: number | null;
  nextAction: string | null;
  nextActionOn: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadEvent = {
  id: string;
  fromStage: LeadStage | null;
  toStage: LeadStage | null;
  note: string | null;
  occurredAt: string;
  memberName: string | null;
};

export type LeadDetail = LeadRow & {
  events: LeadEvent[];
  convertedClientId: string | null;
};

export type ClientAssignment = {
  id: string;
  memberId: string;
  name: string;
  roleTitle: string;
  accessLevel: AccessLevel;
  assignedAt: string;
  assignedByName: string | null;
};

export type ClientMeetingSummary = {
  id: string;
  title: string;
  heldOn: string;
  attendeeMemberIds: string[];
  externalAttendees: string | null;
  notes: string | null;
};

export type ClientRow = {
  id: string;
  company: string;
  ownerMemberId: string;
  ownerName: string;
  serviceType: ServiceType;
  agreementStatus: AgreementStatus;
  status: ClientStatus;
  contactName: string | null;
  contactEmail: string | null;
  updatedAt: string;
  assigned: Array<{ id: string; name: string }>;
};

export type ClientDetail = {
  id: string;
  leadId: string | null;
  company: string;
  ownerMemberId: string;
  ownerName: string | null;
  serviceType: ServiceType;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  scopeOfWork: string | null;
  agreementStatus: AgreementStatus;
  agreementRef: string | null;
  agreementSignedOn: string | null;
  status: ClientStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  assignments: ClientAssignment[];
  meetings: ClientMeetingSummary[];
};

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  assigneeMemberId: string;
  assigneeName: string;
  clientId: string | null;
  clientName: string | null;
  dueOn: string | null;
  status: TaskStatus;
  completedAt: string | null;
  meetingId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskComment = {
  id: string;
  body: string;
  createdAt: string;
  memberId: string;
  memberName: string;
};

export type TaskDetail = TaskRow & { comments: TaskComment[] };

export type WorkLogRow = {
  id: string;
  logDate: string;
  summary: string;
  hours: string;
  taskIds: string[];
  locked: boolean;
  createdAt: string;
  updatedAt: string;
  rating?: number | null;
  ratedBy?: string | null;
};

export type WorkLogMember = {
  memberId: string;
  name: string;
  roleTitle: string;
  accessLevel: AccessLevel;
  totalHours: number;
  averageRating: number | null;
  missingDays: string[];
  logs: WorkLogRow[];
};

export type WorkLogsData = {
  weekStart: string;
  weekEnd: string;
  today: string;
  canRate: boolean;
  members: WorkLogMember[];
};

export type MeetingAttendee = { id: string; name: string };

export type MeetingRow = {
  id: string;
  title: string;
  heldOn: string;
  clientId: string | null;
  clientName: string | null;
  attendeeMemberIds: string[];
  externalAttendees: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  attendees: MeetingAttendee[];
};

export type FinanceEntryRow = {
  id: string;
  entryDate: string;
  direction: FinanceDirection;
  amountPaise: number;
  description: string;
  category: FinanceCategory;
  clientId: string | null;
  clientName: string | null;
  reversesEntryId: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinanceData = {
  month: string;
  monthLabel: string;
  totals: { inPaise: number; outPaise: number; netPaise: number };
  entries: FinanceEntryRow[];
  count: number;
};

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  accessLevel: AccessLevel;
  joinedOn: string;
  status: "active" | "inactive";
  lastLoginAt: string | null;
  createdAt: string;
};

export type AuditEventRow = {
  id: string;
  occurredAt: string;
  memberId: string | null;
  memberName: string | null;
  memberEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  outcome: "allowed" | "denied";
  ip: string | null;
  userAgent: string | null;
  detail: Record<string, unknown>;
};

export type AuditData = {
  events: AuditEventRow[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

export type LookupPerson = {
  id: string;
  name: string;
  accessLevel: AccessLevel;
  roleTitle: string;
  status: "active" | "inactive";
};

export type LookupClient = {
  id: string;
  company: string;
  status: ClientStatus;
  serviceType: ServiceType;
};

export type Lookups = {
  owners: LookupPerson[];
  assignable: LookupPerson[];
  people: LookupPerson[];
  clients: LookupClient[];
};

export type DashboardTask = {
  id: string;
  title: string;
  dueOn: string | null;
  status: TaskStatus;
  clientName: string | null;
};

export type DashboardData = {
  today: string;
  weekStart: string;
  weekEnd: string;
  nextWeekStart: string;
  isOwner: boolean;
  myTasks: DashboardTask[];
  openTaskCount: number;
  dueToday: DashboardTask[];
  meetingsThisWeek: Array<{ id: string; title: string; heldOn: string }>;
  loggedToday: boolean;
  owner?: {
    leadsInPlay: number;
    leadsByStage: Record<string, number>;
    activeClients: number;
    finance: { inPaise: number; outPaise: number; netPaise: number; monthLabel: string };
    teamCount: number;
  };
};

export type LiveWebRow = {
  ip: string;
  location: string;
  device: string;
  browser: string;
  page: string;
  source: string;
  timeOnSite: number;
  lastAction: string | null;
};

export type LiveWebRollup = { label: string; visits: number };

export type LiveWebData =
  | {
      available: false;
      reason: "not_configured" | "unavailable";
      site: "apthex.com";
      generatedAt: string;
    }
  | {
      available: true;
      site: "apthex.com";
      generatedAt: string;
      range: string;
      liveNow: number;
      todayVisits: number;
      totalVisits: number;
      totalViews: number;
      avgTimeOnSite: number;
      visitors: LiveWebRow[];
      topPages: LiveWebRollup[];
      topSources: LiveWebRollup[];
      topCountries: LiveWebRollup[];
      topDevices: LiveWebRollup[];
      topBrowsers: LiveWebRollup[];
    };

export type LeadInput = {
  company: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  source?: string | null;
  ownerMemberId: string;
  valueEstimatePaise?: number | null;
  nextAction?: string | null;
  nextActionOn?: string | null;
  notes?: string | null;
};

export type ClientInput = {
  company: string;
  ownerMemberId: string;
  serviceType: ServiceType;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  scopeOfWork?: string | null;
  agreementStatus?: AgreementStatus;
  agreementRef?: string | null;
  agreementSignedOn?: string | null;
  status?: ClientStatus;
  notes?: string | null;
};
