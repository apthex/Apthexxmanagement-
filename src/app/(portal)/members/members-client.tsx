"use client";

import * as React from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Edit2,
  KeyRound,
  MoreVertical,
  Plus,
  ShieldAlert,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { formatIstDate, formatIstDateTime } from "@/lib/dates";
import { can, ROLE_LABELS, type Permission } from "@/lib/role-access";
import type { AccessLevel, MemberRow } from "@/lib/portal-types";
import { usePortal } from "@/components/portal/context";
import {
  Avatar,
  Card,
  EmptyState,
  ErrorState,
  FormGrid,
  FullWidth,
  InlineAlert,
  PageHeader,
  SearchField,
  TableSkeleton,
} from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR, TableWrap } from "@/components/ui/table";

const ACCESS_LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "owner", label: "Owner — Full access, finance, audit, administration" },
  { value: "team", label: "Team — Tasks, work logs, assigned clients only" },
  { value: "growth", label: "Growth — Leads, clients, tasks, logs, LiveWeb" },
  { value: "viewer", label: "Viewer — Read-only dashboard, leads, clients, meetings" },
];

function AddMemberModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [roleTitle, setRoleTitle] = React.useState("");
  const [accessLevel, setAccessLevel] = React.useState<AccessLevel>("team");
  const [joinedOn, setJoinedOn] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = React.useState<"active" | "inactive">("active");

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [setupLink, setSetupLink] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const resetForm = () => {
    setName("");
    setEmail("");
    setRoleTitle("");
    setAccessLevel("team");
    setJoinedOn(new Date().toISOString().slice(0, 10));
    setStatus("active");
    setError(null);
    setErrors({});
    setSetupLink(null);
    setCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setErrors({});

    try {
      const res = await apiFetch<{
        member: MemberRow;
        emailSent: boolean;
        setupLink?: string;
      }>("/api/members", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          roleTitle: roleTitle.trim(),
          accessLevel,
          joinedOn,
          status,
        }),
      });

      onSaved();
      if (res.setupLink) {
        setSetupLink(res.setupLink);
      } else {
        handleClose();
      }
    } catch (err) {
      setError(errorMessage(err));
      setErrors(fieldErrors(err));
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!setupLink) return;
    await navigator.clipboard.writeText(setupLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(val) => {
        if (!val) handleClose();
      }}
      title={setupLink ? "Member Created — Setup Link" : "Add Team Member"}
      description={
        setupLink
          ? "The member account has been created. A one-time 24-hour setup link has been generated."
          : "Create a new member account. An invite link with 24-hour validity will be sent."
      }
    >
      {setupLink ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-zinc-50 p-4">
            <p className="text-[12px] font-medium text-zinc-500 uppercase tracking-wider">
              One-Time Setup Link (Expires in 24 hours)
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={setupLink}
                className="flex-1 rounded-md border border-line bg-white px-2.5 py-1.5 font-mono text-[11px] text-zinc-700"
              />
              <Button size="sm" variant="outline" onClick={copyLink} className="h-8 shrink-0">
                {copied ? <Check className="mr-1 size-3.5 text-ok" /> : <Copy className="mr-1 size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="mt-2 text-[11.5px] text-zinc-500">
              Share this link securely with the member so they can set their initial password and enroll in 2FA.
            </p>
          </div>

          <div className="flex justify-end">
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <InlineAlert tone="error">{error}</InlineAlert>}

          <FormGrid>
            <Field label="Full Name" error={errors.name}>
              <Input
                type="text"
                placeholder="e.g. Rishi Shakya"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>

            <Field label="Email Address" error={errors.email}>
              <Input
                type="email"
                placeholder="e.g. rishi@apthex.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
          </FormGrid>

          <FormGrid>
            <Field label="Role Title at Apthex" error={errors.roleTitle}>
              <Input
                type="text"
                placeholder="e.g. Penetration Tester"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                required
              />
            </Field>

            <Field label="Access Level" error={errors.accessLevel}>
              <Select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value as AccessLevel)}
              >
                {ACCESS_LEVELS.map((al) => (
                  <option key={al.value} value={al.value}>
                    {al.label}
                  </option>
                ))}
              </Select>
            </Field>
          </FormGrid>

          <FormGrid>
            <Field label="Joined On" error={errors.joinedOn}>
              <Input
                type="date"
                value={joinedOn}
                onChange={(e) => setJoinedOn(e.target.value)}
                required
              />
            </Field>

            <Field label="Account Status" error={errors.status}>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
          </FormGrid>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Creating..." : "Add member"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function EditMemberModal({
  member,
  onClose,
  onSaved,
}: {
  member: MemberRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [roleTitle, setRoleTitle] = React.useState("");
  const [accessLevel, setAccessLevel] = React.useState<AccessLevel>("team");
  const [joinedOn, setJoinedOn] = React.useState("");
  const [status, setStatus] = React.useState<"active" | "inactive">("active");

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (member) {
      setName(member.name);
      setEmail(member.email);
      setRoleTitle(member.roleTitle);
      setAccessLevel(member.accessLevel);
      setJoinedOn(member.joinedOn);
      setStatus(member.status);
      setError(null);
      setErrors({});
    }
  }, [member]);

  if (!member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setErrors({});

    try {
      await apiFetch(`/api/members/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          roleTitle: roleTitle.trim(),
          accessLevel,
          joinedOn,
          status,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setErrors(fieldErrors(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(member)}
      onOpenChange={(val) => {
        if (!val) onClose();
      }}
      title="Edit Member"
      description="Update member attributes. Role changes or deactivation take effect and revoke active sessions immediately."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}

        <FormGrid>
          <Field label="Full Name" error={errors.name}>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <Field label="Email Address" error={errors.email}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
        </FormGrid>

        <FormGrid>
          <Field label="Role Title at Apthex" error={errors.roleTitle}>
            <Input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              required
            />
          </Field>

          <Field label="Access Level" error={errors.accessLevel}>
            <Select
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value as AccessLevel)}
            >
              {ACCESS_LEVELS.map((al) => (
                <option key={al.value} value={al.value}>
                  {al.label}
                </option>
              ))}
            </Select>
          </Field>
        </FormGrid>

        <FormGrid>
          <Field label="Joined On" error={errors.joinedOn}>
            <Input
              type="date"
              value={joinedOn}
              onChange={(e) => setJoinedOn(e.target.value)}
              required
            />
          </Field>

          <Field label="Account Status" error={errors.status}>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        </FormGrid>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeactivateModal({
  member,
  onClose,
  onSaved,
}: {
  member: MemberRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [confirmName, setConfirmName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setConfirmName("");
    setError(null);
  }, [member]);

  if (!member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmName !== member.name) {
      setError("Please type the member's full name exactly to confirm.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/members/${member.id}/deactivate`, {
        method: "POST",
        body: JSON.stringify({ confirmName }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(member)}
      onOpenChange={(val) => {
        if (!val) onClose();
      }}
      title="Deactivate Member"
      description="Deactivation immediately revokes all active sessions. Account records are retained; accounts are never deleted."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}

        <div className="rounded-lg border border-red/20 bg-red-50/50 p-3 text-[13px] text-zinc-700">
          <p>
            <strong>Warning:</strong> Deactivating <strong>{member.name}</strong> will kill all sessions and prevent them from accessing any portal modules.
          </p>
          <p className="mt-1 text-[11.5px] text-zinc-500">
            Remember to also remove <strong>{member.email}</strong> from the Cloudflare Access allowlist.
          </p>
        </div>

        <Field
          label={`Type "${member.name}" to confirm deactivation:`}
          hint="Required security measure to prevent accidental deactivations."
        >
          <Input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            required
            autoComplete="off"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={saving || confirmName !== member.name}
          >
            {saving ? "Deactivating..." : "Confirm Deactivation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Reset2faModal({
  member,
  onClose,
  onSaved,
}: {
  member: MemberRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [confirmName, setConfirmName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setConfirmName("");
    setError(null);
  }, [member]);

  if (!member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmName !== member.name) {
      setError("Please type the member's full name exactly to confirm.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/members/${member.id}/reset-2fa`, {
        method: "POST",
        body: JSON.stringify({ confirmName }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(member)}
      onOpenChange={(val) => {
        if (!val) onClose();
      }}
      title="Reset Two-Factor Authentication"
      description="Resets the member's TOTP secret and recovery codes, forcing them to re-enroll at their next login."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}

        <div className="rounded-lg border border-line dark:border-white/10 bg-zinc-50 dark:bg-white/[0.04] p-3 text-[13px] text-zinc-600 dark:text-zinc-300">
          <p>
            Reset 2FA for: <strong className="text-ink dark:text-white">{member.name}</strong> ({member.email})
          </p>
          <p className="mt-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
            Their existing authenticator app codes and recovery codes will immediately stop working.
          </p>
        </div>

        <Field label={`Type "${member.name}" to confirm:`}>
          <Input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            required
            autoComplete="off"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving || confirmName !== member.name}
          >
            {saving ? "Resetting..." : "Reset 2FA"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function MembersClient() {
  const { user, can } = usePortal();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [editingMember, setEditingMember] = React.useState<MemberRow | null>(null);
  const [deactivatingMember, setDeactivatingMember] = React.useState<MemberRow | null>(null);
  const [resetting2faMember, setResetting2faMember] = React.useState<MemberRow | null>(null);

  const { data, loading, error, reload } = useApi<{ members: MemberRow[]; count: number }>("/api/members");

  const filteredMembers = React.useMemo(() => {
    if (!data?.members) return [];
    if (!searchTerm.trim()) return data.members;
    const term = searchTerm.toLowerCase();
    return data.members.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term) ||
        m.roleTitle.toLowerCase().includes(term) ||
        m.accessLevel.toLowerCase().includes(term),
    );
  }, [data?.members, searchTerm]);

  const canManage = can("members.write");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Personnel"
        title="Members"
        description="Team records: role, access level, join date, status. Destructive operations require name verification."
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setAddOpen(true)}
              className="h-9"
            >
              <Plus className="mr-1.5 size-4" />
              Add member
            </Button>
          ) : null
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-sm flex-1">
            <SearchField
              placeholder="Search by name, email, or role..."
              value={searchTerm}
              onChange={setSearchTerm}
            />
          </div>
          <div className="font-mono text-[11.5px] font-medium text-zinc-500 dark:text-zinc-400">
            {filteredMembers.length} {filteredMembers.length === 1 ? "member" : "members"}
          </div>
        </div>
      </Card>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : filteredMembers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members found"
          description="No team members match your search criteria."
        />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Role at Apthex</TH>
                <TH className="w-[120px]">Access</TH>
                <TH className="w-[130px]">Joined</TH>
                <TH className="w-[120px]">Status</TH>
                {canManage ? <TH className="w-[180px] text-right">Actions</TH> : null}
              </TR>
            </THead>
            <TBody>
              {filteredMembers.map((member) => (
                <TR key={member.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} className="size-8 text-[11px]" />
                      <div>
                        <div className="font-medium text-ink dark:text-zinc-100">{member.name}</div>
                        <div className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{member.email}</div>
                      </div>
                    </div>
                  </TD>

                  <TD className="text-zinc-700 dark:text-zinc-300 font-medium">
                    {member.roleTitle}
                  </TD>

                  <TD>
                    <StatusBadge value={member.accessLevel} />
                    </TD>

                    <TD className="whitespace-nowrap text-zinc-500">
                      {formatIstDate(member.joinedOn)}
                    </TD>

                    <TD>
                      <StatusBadge value={member.status} />
                    </TD>

                    {canManage ? (
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11.5px] text-zinc-600 hover:text-ink"
                            onClick={() => setEditingMember(member)}
                            title="Edit details"
                          >
                            <Edit2 className="size-3 mr-1" />
                            Edit
                          </Button>

                          {member.status === "active" ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11.5px] text-zinc-500 hover:text-ink"
                                onClick={() => setResetting2faMember(member)}
                                title="Reset 2FA"
                              >
                                <KeyRound className="size-3 mr-1" />
                                2FA
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11.5px] text-zinc-500 hover:text-red"
                                onClick={() => setDeactivatingMember(member)}
                                title="Deactivate member"
                              >
                                <UserX className="size-3 mr-1" />
                                Deactivate
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
      )}

      {/* Modals */}
      <AddMemberModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => void reload()}
      />

      <EditMemberModal
        member={editingMember}
        onClose={() => setEditingMember(null)}
        onSaved={() => void reload()}
      />

      <DeactivateModal
        member={deactivatingMember}
        onClose={() => setDeactivatingMember(null)}
        onSaved={() => void reload()}
      />

      <Reset2faModal
        member={resetting2faMember}
        onClose={() => setResetting2faMember(null)}
        onSaved={() => void reload()}
      />
    </div>
  );
}
