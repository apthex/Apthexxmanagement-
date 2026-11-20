import { requirePageSession } from "@/lib/auth/session";
import { PortalShell } from "@/components/portal/shell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();
  return (
    <PortalShell
      user={{
        id: session.member.id,
        name: session.member.name,
        email: session.member.email,
        roleTitle: session.member.roleTitle,
        accessLevel: session.member.accessLevel,
      }}
    >
      {children}
    </PortalShell>
  );
}
