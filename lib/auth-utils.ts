import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Get the current session or redirect to login.
 * Use in Server Components and Server Actions.
 */
export async function getRequiredSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}
