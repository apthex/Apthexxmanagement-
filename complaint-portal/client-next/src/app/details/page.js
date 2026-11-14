import { redirect } from "next/navigation";

// Complaints are submitted only at /complaint. The old full-form flow
// (institute code -> category -> details) is retired.
export default function DetailsPage() {
  redirect("/complaint");
}
