import { redirect } from "next/navigation";

// Complaints are submitted only at /complaint. The old multi-step category
// picker is retired — anyone landing here goes straight to the quick form.
export default function CategoryPage() {
  redirect("/complaint");
}
