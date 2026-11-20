import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoadingBlock } from "@/components/portal/ui";
import { SetupFlow } from "./setup-flow";

export const metadata: Metadata = { title: "Set up account" };

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <LoadingBlock label="Loading setup" />
        </AuthShell>
      }
    >
      <SetupFlow />
    </Suspense>
  );
}
