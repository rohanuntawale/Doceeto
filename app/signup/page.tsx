import { redirect } from "next/navigation";

// Doctor onboarding now lives in the unified /register flow.
export default function SignupRedirect() {
  redirect("/register?as=doctor");
}
