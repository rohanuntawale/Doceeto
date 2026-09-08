"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { HelpCircle, KeyRound, LifeBuoy, LockKeyhole, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Modal, modalPanelCls } from "@/components/ui/modal";

export function AccountSecuritySupport() {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);

  return (
    <>
      <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-white/70 shadow-soft">
        <div className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">Account centre</p>
          <h2 className="mt-1 text-lg font-semibold text-cream">Security, help & support</h2>
        </div>
        <div className="grid divide-y divide-[var(--border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <AccountAction icon={<KeyRound className="h-4 w-4" />} title="Password & sessions" detail="Change your password and sign out other devices." action="Change password" onClick={() => setPasswordOpen(true)} />
          <AccountAction icon={<ShieldCheck className="h-4 w-4" />} title="Privacy & account safety" detail="Review the privacy policy and learn how your data is used." action="View privacy" href="/privacy" />
          <AccountAction icon={<MessageSquare className="h-4 w-4" />} title="Raise a support ticket" detail="Send a detailed account, care, or technical issue to our team." action="New ticket" onClick={() => setTicketOpen(true)} />
          <AccountAction icon={<HelpCircle className="h-4 w-4" />} title="Help centre" detail="Read answers about bookings, care, verification, and your account." action="Open help" href="/support" />
        </div>
      </section>
      <PasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <TicketDialog open={ticketOpen} onClose={() => setTicketOpen(false)} />
    </>
  );
}

function AccountAction({ icon, title, detail, action, href, onClick }: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  action: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-cream">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-[var(--text-muted)]">{detail}</span>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">{action} <span aria-hidden>→</span></span>
      </span>
    </>
  );
  const className = "flex min-h-[154px] items-start gap-3 px-5 py-5 text-left transition-colors hover:bg-[var(--surface)]/55 sm:px-6";
  return href ? <Link className={className} href={href}>{content}</Link> : <button type="button" className={className} onClick={onClick}>{content}</button>;
}

function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) return setError("The new passwords do not match.");
    setSaving(true);
    try {
      const response = await apiFetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not change your password.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change your password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form onClick={(event) => event.stopPropagation()} onSubmit={submit} className={modalPanelCls}>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><LockKeyhole className="h-5 w-5" /></span>
          <div><h2 className="text-lg font-semibold text-cream">Change password</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Other signed-in devices will be signed out for your safety.</p></div>
        </div>
        <div className="mt-5 space-y-3">
          <PasswordField label="Current password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          <PasswordField label="New password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" hint="At least 8 characters, including a letter and a number." />
          <PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-status-critical">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Updating…" : "Update password"}</Button></div>
      </form>
    </Modal>
  );
}

function PasswordField({ label, value, onChange, autoComplete, hint }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string; hint?: string }) {
  return <label className="block"><span className="text-sm font-medium text-cream">{label}</span><input required type="password" autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-cream outline-none focus:border-primary focus:ring-1 focus:ring-primary/30" />{hint && <span className="mt-1.5 block text-xs text-[var(--text-faint)]">{hint}</span>}</label>;
}

function TicketDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [category, setCategory] = useState("account");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch("/api/support/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, subject, message }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not create your support ticket.");
      setTicketId(body.ticketId);
      setSubject("");
      setMessage("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create your support ticket.");
    } finally {
      setSaving(false);
    }
  }

  return <Modal open={open} onClose={onClose}><form onClick={(event) => event.stopPropagation()} onSubmit={submit} className={modalPanelCls}>
    <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><LifeBuoy className="h-5 w-5" /></span><div><h2 className="text-lg font-semibold text-cream">Raise a support ticket</h2><p className="mt-1 text-sm text-[var(--text-muted)]">This goes directly to Doceeto support.</p></div></div>
    {ticketId ? <div className="mt-5 rounded-2xl border border-[rgb(var(--c-status-ok))]/25 bg-[rgb(var(--c-status-ok))]/10 p-4 text-sm text-[rgb(var(--c-status-ok))]"><strong>Ticket submitted: {ticketId}</strong><p className="mt-1 text-xs leading-relaxed">Our team has been emailed and will reply to the email connected to your account.</p></div> : <><div className="mt-5 space-y-3"><label className="block"><span className="text-sm font-medium text-cream">Category</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-cream outline-none focus:border-primary"><option value="account">Account & sign-in</option><option value="care">Care or booking</option><option value="payment">Payment</option><option value="technical">Technical issue</option><option value="other">Something else</option></select></label><label className="block"><span className="text-sm font-medium text-cream">Subject</span><input required minLength={4} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-cream outline-none focus:border-primary" placeholder="What do you need help with?" /></label><label className="block"><span className="text-sm font-medium text-cream">Tell us what happened</span><textarea required minLength={12} maxLength={2000} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-cream outline-none focus:border-primary" placeholder="Include steps, dates, or any error message you saw." /></label></div>{error && <p role="alert" className="mt-3 text-sm text-status-critical">{error}</p>}</>}
    <div className="mt-5 flex items-center justify-between gap-2"><a className="inline-flex items-center gap-1 text-xs text-primary hover:underline" href="mailto:shivansh1411@gmail.com"><Mail className="h-3.5 w-3.5" /> Email support</a><div className="flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>{ticketId ? "Close" : "Cancel"}</Button>{!ticketId && <Button type="submit" disabled={saving}>{saving ? "Sending…" : "Submit ticket"}</Button>}</div></div>
  </form></Modal>;
}
