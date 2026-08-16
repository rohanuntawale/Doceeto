"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Clock, Send, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const TOPICS = ["General enquiry", "Partnership", "Investor relations", "Press", "Support"];

export default function ContactPage() {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", topic: TOPICS[0], message: "" });
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
    toast.push({
      tone: "success",
      title: "Message sent",
      desc: "Thanks. The Doceeto team will get back to you shortly.",
    });
    setForm({ name: "", email: "", topic: TOPICS[0], message: "" });
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-5 py-12 md:px-8 md:py-16">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-terracotta" />
            <span className="label">Contact</span>
          </div>
          <h1 className="mt-5 font-serif text-4xl leading-tight text-cream md:text-6xl">
            Get in <span className="text-salmon">touch.</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-[var(--text-muted)]">
            Partnerships, press, investment, or support: tell us what you need
            and we’ll respond.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          {/* Form */}
          <form
            onSubmit={submit}
            className="rounded-card border border-[var(--border)] bg-espresso-800 p-6 shadow-card"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input
                  className={inputCls}
                  required
                  value={form.name}
                  onChange={(e) => set("name")(e.target.value)}
                  placeholder="Your name"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className={inputCls}
                  required
                  value={form.email}
                  onChange={(e) => set("email")(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Topic">
                <select
                  className={inputCls}
                  value={form.topic}
                  onChange={(e) => set("topic")(e.target.value)}
                >
                  {TOPICS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Message">
                <textarea
                  rows={5}
                  className={`${inputCls} resize-none`}
                  required
                  value={form.message}
                  onChange={(e) => set("message")(e.target.value)}
                  placeholder="How can we help?"
                />
              </Field>
            </div>
            <Button type="submit" className="mt-5 w-full sm:w-auto">
              <Send className="h-4 w-4" /> {sent ? "Send another" : "Send message"}
            </Button>
          </form>

          {/* Info */}
          <div className="space-y-3">
            <InfoCard
              icon={<MapPin className="h-4 w-4" />}
              title="Where we are"
              lines={["Doceeto Health", "Nagpur, Maharashtra, India"]}
            />
            <InfoCard
              icon={<Clock className="h-4 w-4" />}
              title="Response time"
              lines={["Within 24 hours,", "every day."]}
            />
            {/* A faster channel than the form, the page had no mailto at all. */}
            <a
              href="mailto:hello@doceeto.health"
              className="block rounded-card border border-[var(--border)] bg-espresso-800 p-5 shadow-card transition-colors hover:border-terracotta/40"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-cream">
                <Send className="h-4 w-4 text-salmon" /> Email us directly
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">hello@doceeto.health</p>
            </a>
            <div className="rounded-card border border-terracotta/25 bg-terracotta/10 p-5">
              <div className="font-serif text-lg text-salmon">Doceeto</div>
              <p className="mt-2 text-sm text-cream">Healing, on demand.</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Building the single front door to care in India.
              </p>
              <Link
                href="/"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-salmon hover:underline"
              >
                Open Doceeto <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function InfoCard({
  icon,
  title,
  lines,
}: {
  icon: React.ReactNode;
  title: string;
  lines: string[];
}) {
  return (
    <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-5 shadow-card">
      <div className="flex items-center gap-2 text-salmon">
        {icon}
        <span className="label text-salmon">{title}</span>
      </div>
      <div className="mt-2 text-sm text-cream">
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
    </div>
  );
}
