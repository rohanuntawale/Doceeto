import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Clock3, Mail } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function VerificationPage({ searchParams }: { searchParams: { as?: string } }) {
  const role = searchParams.as === "nurse" ? "nurse" : "doctor";
  const session = await getSession(role);
  if (!session) redirect(`/login?as=${role}`);
  const provider = await db.getDoctorById(session.userId);
  if (provider?.verified) redirect(`/${role}`);
  return <main className="min-h-screen bg-[#f5f6f3] px-5 py-16 text-[#153d32]">
    <div className="mx-auto max-w-xl rounded-3xl border border-[#153d32]/15 bg-white p-7 sm:p-10">
      <Link href="/" className="font-serif text-3xl font-bold">Doceeto</Link>
      <Clock3 className="mt-10 h-10 w-10" />
      <p className="mt-6 text-xs font-semibold uppercase tracking-widest">Application received</p>
      <h1 className="mt-3 font-serif text-4xl">Your practice, one check away.</h1>
      <p className="mt-5 leading-relaxed text-[#53655d]">Thank you, {session.name}. Our in-house team will review your registration and contact you through your account email for any supporting details. Your platform access opens after approval.</p>
      <dl className="my-7 divide-y divide-[#153d32]/10 rounded-2xl border border-[#153d32]/10 px-4">
        <div className="py-4"><dt className="text-xs uppercase">Registration submitted</dt><dd className="mt-1 font-medium">{provider?.registrationNo || "Please contact support to complete your registration"}</dd></div>
        <div className="py-4"><dt className="text-xs uppercase">Status</dt><dd className="mt-1 flex items-center gap-2"><ShieldCheck size={18} /> Awaiting team verification</dd></div>
      </dl>
      <p className="flex gap-2 text-sm"><Mail size={18} className="shrink-0" />Keep an eye on your inbox. You can return here to check your approval.</p>
      <div className="mt-8 flex flex-wrap gap-4"><a href={`/verification?as=${role}`} className="rounded-xl bg-[#153d32] px-5 py-3 text-sm font-semibold text-white">Check status</a><Link href="/contact" className="rounded-xl border border-[#153d32]/20 px-5 py-3 text-sm font-semibold">Contact our team</Link></div>
    </div>
  </main>;
}
