import { db } from "@/lib/db";
import { sanitizeSession } from "./history";

export async function patientContext(patientId: string, activeId?: string) {
  const [history, prescriptions] = await Promise.all([db.getChatHistory(patientId), db.getPrescriptions()]);
  const nodes: { id: string; type: string; source: string; text: string }[] = [];
  const edges: { from: string; relation: string; to: string }[] = [];
  for (const raw of history) {
    const session = sanitizeSession(raw);
    if (!session || session.id === activeId) continue;
    const id = `episode:${session.id}`;
    nodes.push({ id, type: "past_patient_report", source: new Date(session.startedAt).toISOString(), text: JSON.stringify({ complaint: session.seed, answers: session.answers.map(answer => ({ question: answer.prompt, patientSaid: answer.label })), unconfirmedAiSuggestion: session.conclusion?.summary ?? session.conclusion?.conditions }) });
    edges.push({ from: "patient", relation: "reported_in_past", to: id });
  }
  for (const prescription of prescriptions.filter(item => item.patientId === patientId)) {
    const id = `prescription:${prescription.id}`;
    nodes.push({ id, type: "clinician_record", source: prescription.id, text: JSON.stringify({ diagnosis: prescription.diagnosis, medicines: prescription.items }) });
    edges.push({ from: "patient", relation: "has_prescription_not_confirmed_current", to: id });
  }
  const budget = 40000;
  let used = 0;
  const included = nodes.filter(node => { if (used + node.text.length > budget) return false; used += node.text.length; return true; });
  const ids = new Set(included.map(node => node.id));
  return JSON.stringify({ nodes: included, edges: edges.filter(edge => ids.has(edge.to)), omittedRecords: nodes.length - included.length });
}
