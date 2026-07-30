import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { homeFor, surfaceFromPath } from "@/lib/auth/constants";
import { googleConfigured } from "@/lib/auth/google";
import { LoginForm } from "@/app/login/login-form";

export const dynamic = "force-dynamic";

/**
 * Server side, because "are you already signed in?" is now a database question
 * — the cookie is an opaque id and says nothing on its own.
 *
 * The rule that matters: a visitor asking for a surface they DON'T hold gets
 * the sign-in form, never a redirect to the dashboard they do hold. Sending
 * them home is what made /doctor and /patient render the same page.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = searchParams.next ?? "";
  const wanted = surfaceFromPath(next);

  if (wanted) {
    // Signed in for that surface already (e.g. from another tab)? Let them
    // through, without dragging ?next= along.
    if (await getSession(wanted)) redirect(next);
    return <LoginForm googleEnabled={googleConfigured()} />;
  }

  // No destination in mind — land whichever role this browser holds at home.
  const session = await getSession();
  if (session) redirect(homeFor(session.role));

  return <LoginForm />;
}
