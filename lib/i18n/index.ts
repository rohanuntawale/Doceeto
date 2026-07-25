"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Lightweight i18n. A single module store holds the active language so
 * every consumer re-renders together on change; strings live in DICT.
 * India-first: English, Hindi, Marathi (Nagpur) to start — add more by
 * extending LANGUAGES + DICT. Missing keys fall back to English, then key.
 */
export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "mr", label: "Marathi", native: "मराठी" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

type Dict = Record<string, string>;

const EN: Dict = {
  "greeting.morning": "Good morning",
  "greeting.afternoon": "Good afternoon",
  "greeting.evening": "Good evening",
  "nav.home": "Home",
  "nav.care": "Find care",
  "nav.meds": "Medicine",
  "nav.account": "Account",
  "nav.gigs": "Gigs",
  "nav.schedule": "Schedule",
  "nav.wallet": "Wallet",
  "home.setLocation": "Set your location",
  "home.notWell": "Not feeling well?",
  "home.needCare": "I need care",
  "home.symptomPlaceholder": "Tell us what's wrong, e.g. fever, sore throat",
  "home.findCare": "Find care nearby",
  "home.findSpecialist": "Find a {x} nearby",
  "home.homeVisit": "Home visit",
  "home.videoCall": "Video call",
  "home.medicine": "Medicine",
  "home.careToday": "Your care today",
  "home.seeAll": "See all",
  "care.title": "Symptom checker",
  "care.subtitle": "Tell me how you feel. I'll suggest the right doctor.",
  "chat.placeholder": "Describe your symptoms...",
  "chat.history": "Past chats",
  "chat.bookings": "My bookings",
  "chat.reports": "Reports",
  "chat.newChat": "New check",
  "account.title": "Account",
  "account.appearance": "Appearance",
  "account.language": "Language",
  "account.doctorView": "Open doctor view",
  "account.clearData": "Clear test data",
  "account.signOut": "Sign out",
};

const HI: Dict = {
  "greeting.morning": "सुप्रभात",
  "greeting.afternoon": "नमस्ते",
  "greeting.evening": "शुभ संध्या",
  "nav.home": "होम",
  "nav.care": "इलाज खोजें",
  "nav.meds": "दवाई",
  "nav.account": "खाता",
  "nav.gigs": "काम",
  "nav.schedule": "समय-सारणी",
  "nav.wallet": "वॉलेट",
  "home.setLocation": "अपना स्थान सेट करें",
  "home.notWell": "तबीयत ठीक नहीं?",
  "home.needCare": "मुझे इलाज चाहिए",
  "home.symptomPlaceholder": "बताएं क्या तकलीफ है, जैसे बुखार, गले में दर्द",
  "home.findCare": "पास के डॉक्टर खोजें",
  "home.findSpecialist": "पास में {x} खोजें",
  "home.homeVisit": "घर पर विज़िट",
  "home.videoCall": "वीडियो कॉल",
  "home.medicine": "दवाई",
  "home.careToday": "आज का इलाज",
  "home.seeAll": "सभी देखें",
  "care.title": "लक्षण जांच",
  "care.subtitle": "बताएं कैसा महसूस हो रहा है, मैं सही डॉक्टर सुझाऊंगा।",
  "chat.placeholder": "अपने लक्षण बताएं...",
  "chat.history": "पिछली बातचीत",
  "chat.bookings": "मेरी बुकिंग",
  "chat.reports": "रिपोर्ट",
  "chat.newChat": "नई जांच",
  "account.title": "खाता",
  "account.appearance": "रूप-रंग",
  "account.language": "भाषा",
  "account.doctorView": "डॉक्टर व्यू खोलें",
  "account.clearData": "टेस्ट डेटा साफ़ करें",
  "account.signOut": "साइन आउट",
};

const MR: Dict = {
  "greeting.morning": "शुभ सकाळ",
  "greeting.afternoon": "नमस्कार",
  "greeting.evening": "शुभ संध्याकाळ",
  "nav.home": "होम",
  "nav.care": "उपचार शोधा",
  "nav.meds": "औषध",
  "nav.account": "खाते",
  "nav.gigs": "कामे",
  "nav.schedule": "वेळापत्रक",
  "nav.wallet": "वॉलेट",
  "home.setLocation": "तुमचे स्थान सेट करा",
  "home.notWell": "बरं वाटत नाही?",
  "home.needCare": "मला उपचार हवा",
  "home.symptomPlaceholder": "काय त्रास आहे सांगा, उदा. ताप, घसा दुखणे",
  "home.findCare": "जवळचे डॉक्टर शोधा",
  "home.findSpecialist": "जवळ {x} शोधा",
  "home.homeVisit": "घरी भेट",
  "home.videoCall": "व्हिडिओ कॉल",
  "home.medicine": "औषध",
  "home.careToday": "आजचा उपचार",
  "home.seeAll": "सर्व पहा",
  "care.title": "लक्षण तपासणी",
  "care.subtitle": "कसं वाटतंय सांगा, मी योग्य डॉक्टर सुचवेन.",
  "chat.placeholder": "तुमची लक्षणे सांगा...",
  "chat.history": "मागील संवाद",
  "chat.bookings": "माझ्या बुकिंग",
  "chat.reports": "अहवाल",
  "chat.newChat": "नवी तपासणी",
  "account.title": "खाते",
  "account.appearance": "स्वरूप",
  "account.language": "भाषा",
  "account.doctorView": "डॉक्टर व्ह्यू उघडा",
  "account.clearData": "चाचणी डेटा साफ करा",
  "account.signOut": "साइन आउट",
};

const DICT: Record<LangCode, Dict> = { en: EN, hi: HI, mr: MR };

const KEY = "iyashi:lang:v1";

let current: LangCode = "en";
let hydrated = false;
let listeners: Array<() => void> = [];

function emit() {
  listeners.forEach((l) => l());
}

function hydrateOnce() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const saved = window.localStorage.getItem(KEY) as LangCode | null;
    if (saved && DICT[saved]) {
      current = saved;
      emit();
    }
  } catch {
    /* ignore */
  }
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  hydrateOnce();
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function setLang(code: LangCode) {
  if (!DICT[code]) return;
  current = code;
  try {
    window.localStorage.setItem(KEY, code);
    document.documentElement.lang = code;
  } catch {
    /* ignore */
  }
  emit();
}

function translate(code: LangCode, key: string, vars?: Record<string, string>) {
  let s = DICT[code]?.[key] ?? EN[key] ?? key;
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
  return s;
}

/** t(key, vars?) translates in the active language; also exposes lang + setLang. */
export function useT() {
  const lang = useSyncExternalStore(
    subscribe,
    () => current,
    () => "en" as LangCode,
  );
  const t = useCallback(
    (key: string, vars?: Record<string, string>) => translate(lang, key, vars),
    [lang],
  );
  return { t, lang, setLang, languages: LANGUAGES };
}
