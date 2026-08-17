import { googleConfigured } from "@/lib/auth/google";
import { LoginForm } from "@/app/login/login-form";

export const dynamic = "force-dynamic";

/**
 * The login page must always render the authentication form. A session cookie
 * is only a lookup hint; it is never proof that this login attempt is
 * authenticated. In particular, do not redirect from here based on a cookie:
 * after logout, stale browser state must not be able to skip credentials.
 */
export default async function LoginPage() {
  return <LoginForm googleEnabled={googleConfigured()} />;
}
