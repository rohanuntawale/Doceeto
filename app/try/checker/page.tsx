import { CheckerDemo, CheckerPageHeader } from "@/components/try/checker-demo";

export const metadata = {
  title: "Symptom check · Doceeto",
  description:
    "Describe a symptom and get a plain-language read on what it might be and who treats it. Two free checks, no account needed.",
};

export default function TryCheckerPage() {
  return (
    <div className="flex h-full flex-col">
      {/* The title is the first thing to go when the window is short. On a
          laptop it sets the scene; on a 600px-tall window it would push the
          composer off screen, and a chat you cannot type into is worse than a
          chat with no headline. The card carries its own "Symptom check"
          header, so nothing is lost when this collapses. */}
      {/* A client wrapper only so this heading can follow the language the
          visitor picks inside the chat below, a Marathi conversation under an
          English headline is the giveaway that the translation is skin-deep. */}
      <div className="hidden shrink-0 [@media(min-height:760px)]:block">
        <CheckerPageHeader />
      </div>

      <div className="min-h-0 flex-1">
        <CheckerDemo />
      </div>
    </div>
  );
}
