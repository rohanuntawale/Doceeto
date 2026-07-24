import { redirect } from "next/navigation";

// Doctor onboarding now lives on the landing (the single sign-up).
export default function SignupRedirect() {
  redirect("/?as=doctor");
}
