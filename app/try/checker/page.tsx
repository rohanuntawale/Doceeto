import { PageHeader } from "@/components/layout/page-header";
import { CheckerDemo } from "@/components/try/checker-demo";

export const metadata = {
  title: "Symptom check · Doceeto",
  description:
    "Describe a symptom and get a plain-language read on what it might be and who treats it. Two free checks, no account needed.",
};

export default function TryCheckerPage() {
  return (
    <>
      <PageHeader label="Two free checks" title="What's going on?" />
      <CheckerDemo />
    </>
  );
}
