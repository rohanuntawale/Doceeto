"use client";

import Link from "next/link";
import { Wallet, ArrowDownToLine, TrendingUp, Banknote } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useTransactions, useActions } from "@/lib/hooks/data";
import { walletBalance } from "@/lib/demo/store";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";
import { COMMISSION_RATE } from "@/lib/config";
import { formatINR, formatINRCompact, timeAgo } from "@/lib/utils/format";
import { useMounted } from "@/lib/hooks/use-mounted";

export default function EarningsPage() {
  const me = useCurrentDoctor();
  const txns = useTransactions();
  const { requestPayout } = useActions();
  const toast = useToast();
  const mounted = useMounted();

  if (!me) return null;

  const mine = txns.filter((t) => t.doctorId === me.id);
  const balance = walletBalance(mine, me.id);
  const earned = mine.filter((t) => t.kind === "earning").reduce((a, t) => a + t.net, 0);
  const paidOut = mine.filter((t) => t.kind === "payout").reduce((a, t) => a - t.net, 0);

  function withdraw() {
    if (balance <= 0) {
      toast.push({ tone: "info", title: "Nothing to withdraw yet" });
      return;
    }
    requestPayout(me!.id);
    toast.push({
      tone: "success",
      title: "Payout on its way",
      desc: `${formatINR(balance)} is being sent to your bank.`,
    });
  }

  return (
    <>
      <PageHeader kanji="円" label="DOCTOR · WALLET" title="Wallet" />

      <Card className="border-terracotta/30 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="label flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Available balance
            </div>
            <div className="metric mt-1 text-4xl text-cream">{formatINR(balance)}</div>
          </div>
          <Button onClick={withdraw} disabled={balance <= 0}>
            <ArrowDownToLine className="h-4 w-4" /> Withdraw to bank
          </Button>
        </div>
      </Card>

      {/* dense: the poster-size variant clips ₹-values at 3-up on a phone */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatCard
          dense
          value={formatINRCompact(earned)}
          label="Total earned"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          dense
          value={formatINRCompact(paidOut)}
          label="Paid out"
          icon={<Banknote className="h-4 w-4" />}
        />
        <StatCard dense value={`${Math.round(COMMISSION_RATE * 100)}%`} label="Platform fee" />
      </div>

      <Card className="mt-5">
        <CardHeader label="LEDGER" title="Transactions" />
        {mine.length === 0 ? (
          <div className="p-4">
            <EmptyState
              kanji="円"
              title="No transactions yet"
              desc="Completed visits credit your wallet here."
              action={
                <Link
                  href="/doctor/requests"
                  className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-on-accent"
                >
                  Open requests
                </Link>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {mine.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                    t.kind === "payout"
                      ? "bg-white/5 text-[var(--text-muted)]"
                      : "bg-status-ok/15 text-status-ok"
                  }`}
                >
                  {t.kind === "payout" ? (
                    <ArrowDownToLine className="h-4 w-4" />
                  ) : (
                    <TrendingUp className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-cream">
                    {t.kind === "payout" ? "Withdrawal to bank" : `Visit · ${t.patientName}`}
                  </p>
                  <p className="text-xs text-[var(--text-faint)]">
                    {t.kind === "earning"
                      ? `${formatINR(t.gross)} fee · ${formatINR(t.commission)} fee taken${
                          t.method ? ` · ${t.method}` : ""
                        }`
                      : ""}
                    {mounted ? ` ${timeAgo(t.createdAt)}` : ""}
                  </p>
                </div>
                <span
                  className={`metric text-base ${t.net >= 0 ? "text-status-ok" : "text-cream"}`}
                >
                  {t.net >= 0 ? "+" : "−"}
                  {formatINR(Math.abs(t.net))}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
