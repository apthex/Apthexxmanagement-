import { redirect } from "next/navigation";

// Short alias for staff: /admin opens the Admin Desk (login-protected).
export default function AdminPage() {
  redirect("/desk");
}
