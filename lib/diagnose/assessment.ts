import type { DAnswer, DQuestion } from "./engine";

const TOPICS = [
  { id: "onset", match: /how long|when.*start|duration|onset/i, prompt: "When did this start, and has it happened before?", options: ["Today, for the first time", "A few days ago", "Weeks or longer", "It keeps coming back"] },
  { id: "location", match: /where|location|spread|radiat/i, prompt: "Where do you feel it most, and does it spread anywhere?", options: ["One specific area", "Several areas", "My whole body", "I am not sure"] },
  { id: "severity", match: /how bad|how severe|severity|daily activit/i, prompt: "How much is this affecting your usual activities right now?", options: ["Mild, I can carry on", "Moderate, I need to slow down", "Severe, I cannot do usual activities", "I am not sure"] },
  { id: "course", match: /getting better|getting worse|changed|progress|constant|comes and goes/i, prompt: "How has it changed since it started?", options: ["Getting better", "About the same", "Getting worse", "It comes and goes"] },
  { id: "associated", match: /other symptom|anything else|along with|associated/i, prompt: "What other symptoms have you noticed along with this?", options: ["No other symptoms", "Fever or chills", "Nausea or vomiting", "I want to describe them"] },
  { id: "triggers", match: /better or worse|trigger|reliev|after eating|exertion/i, prompt: "What makes it better or worse, such as movement, meals, rest, or taking medicine?", options: ["Rest helps", "Movement makes it worse", "Meals seem related", "No clear pattern"] },
  { id: "medication", match: /medicin|medication|allerg|treatment|taken/i, prompt: "What medicines or remedies have you tried for this, and do you have any medication allergies?", options: ["Nothing tried, no known allergies", "I take medicines regularly", "I have medication allergies", "I will type the details"] },
  { id: "background", match: /medical history|health condition|pregnan|surgery|surger|medical background/i, prompt: "Is there any relevant medical history, recent surgery, pregnancy, or change to your health record we should consider?", options: ["No relevant history or changes", "An existing health condition", "Recent surgery or treatment", "Pregnancy or possible pregnancy", "I will type the details"] },
] as const;

export function assessmentQuestion(seed: string, answers: Pick<DAnswer, "prompt" | "label" | "questionId">[]): DQuestion | null {
  if (!seed.trim() && answers.length === 0) return null;
  const topic = TOPICS.find(topic => !answers.some(answer =>
    answer.label.trim().length > 0 && (answer.questionId === `assessment-${topic.id}` || topic.match.test(answer.prompt)),
  ));
  if (!topic) return null;
  return {
    id: `assessment-${topic.id}`,
    prompt: topic.prompt,
    hint: "You can type your own answer. Include details you feel matter, or say you are unsure.",
    options: topic.options.map((label, index) => ({ value: `detail-${index}`, label })),
  };
}
