/**
 * Demo doctor roster, shared by both backends. Both the in-browser demo
 * store and the server file store start empty, so a fresh install shows no
 * doctors on the patient map/list. This seeds a small, realistic roster near
 * the Nagpur map center on first run, so the whole patient flow (find →
 * map/list → profile → book) works out of the box. Registering a real doctor
 * simply adds to this list; a reset clears it. Isomorphic — no browser or
 * server-only APIs — so it is safe on the client and server.
 */
import { MAP_CENTER } from "@/lib/config";
import { AVATAR_COLORS } from "@/lib/catalog";
import type { Doctor, DoctorKind, DoctorStatus, Gender } from "@/lib/types/domain";

type SeedReview = { patientName: string; rating: number; comment: string };

type SeedDoctor = {
  fullName: string;
  specialty: string;
  kind: DoctorKind;
  gender: Gender;
  experienceYears: number;
  languages: string[];
  status: DoctorStatus;
  verified: boolean;
  rating: number;
  consultFee: number;
  homeVisitFee: number;
  qualifications: string;
  education: string;
  about: string;
  registrationNo: string;
  reviews?: SeedReview[];
  /** Small offset from the map center, in degrees (~0.01° ≈ 1.1 km). */
  dLat: number;
  dLng: number;
};

const ROSTER: SeedDoctor[] = [
  {
    fullName: "Dr. Ananya Rao", specialty: "General Physician", kind: "practising", gender: "female",
    experienceYears: 9, languages: ["English", "Hindi", "Marathi"], status: "online", verified: true,
    rating: 4.8, consultFee: 400, homeVisitFee: 900,
    qualifications: "MBBS, MD (General Medicine)", education: "Seth GS Medical College, Mumbai (2013)",
    about: "Family physician focused on preventive care, everyday infections and chronic-disease management. Calm, thorough, and big on explaining the why behind every prescription.",
    registrationNo: "MMC-2013-48213", dLat: 0.006, dLng: 0.004,
    reviews: [
      { patientName: "Sanya M.", rating: 5, comment: "Very patient and clear. Explained my mother's BP medication properly." },
      { patientName: "Rahul T.", rating: 5, comment: "Came home within the hour, professional and kind." },
    ],
  },
  {
    fullName: "Dr. Vikram Deshmukh", specialty: "General Physician", kind: "practising", gender: "male",
    experienceYears: 12, languages: ["English", "Hindi", "Marathi"], status: "online", verified: true,
    rating: 4.7, consultFee: 450, homeVisitFee: 950,
    qualifications: "MBBS, MD (General Medicine)", education: "Grant Medical College, Mumbai (2010)",
    about: "Twelve years across clinic and home visits. Special interest in diabetes and thyroid care for working adults.",
    registrationNo: "MMC-2010-33902", dLat: -0.005, dLng: 0.007,
    reviews: [{ patientName: "Imtiaz K.", rating: 5, comment: "Straightforward, no unnecessary tests. Recommended." }],
  },
  {
    fullName: "Dr. Neha Kulkarni", specialty: "General Physician", kind: "resident", gender: "female",
    experienceYears: 3, languages: ["English", "Hindi"], status: "online", verified: false,
    rating: 4.5, consultFee: 300, homeVisitFee: 700,
    qualifications: "MBBS", education: "BJ Medical College, Pune (2019)",
    about: "Junior physician taking home visits alongside hospital duty. Friendly with first-time patients and students.",
    registrationNo: "MMC-2019-71140", dLat: 0.009, dLng: -0.006,
  },
  {
    fullName: "Dr. Aditya Joshi", specialty: "General Physician", kind: "practising", gender: "male",
    experienceYears: 6, languages: ["English", "Hindi"], status: "busy", verified: false,
    rating: 4.3, consultFee: 350, homeVisitFee: 800,
    qualifications: "MBBS", education: "Government Medical College, Nagpur (2016)",
    about: "General practice with a focus on quick, affordable video consults for seasonal illness and minor concerns.",
    registrationNo: "MMC-2016-60455", dLat: -0.008, dLng: -0.003,
  },
  {
    fullName: "Dr. Rohan Iyer", specialty: "Cardiologist", kind: "practising", gender: "male",
    experienceYears: 15, languages: ["English", "Hindi"], status: "online", verified: true,
    rating: 4.9, consultFee: 700, homeVisitFee: 1200,
    qualifications: "MBBS, MD, DM (Cardiology)", education: "KEM Hospital, Mumbai (2007)",
    about: "Interventional cardiologist. Sees patients for chest pain, blood pressure, palpitations and post-procedure follow-up.",
    registrationNo: "MMC-2007-19008", dLat: 0.004, dLng: 0.011,
    reviews: [
      { patientName: "Deepa R.", rating: 5, comment: "Reassuring during a scary night. Knew exactly what to check." },
      { patientName: "Family of A.S.", rating: 5, comment: "Followed up personally the next day. Rare these days." },
    ],
  },
  {
    fullName: "Dr. Meera Nair", specialty: "Pediatrician", kind: "practising", gender: "female",
    experienceYears: 11, languages: ["English", "Hindi", "Malayalam"], status: "online", verified: true,
    rating: 4.8, consultFee: 500, homeVisitFee: 1000,
    qualifications: "MBBS, MD (Pediatrics)", education: "Christian Medical College, Vellore (2011)",
    about: "Paediatrician for newborns to teens — fevers, vaccinations, growth and anxious first-time parents.",
    registrationNo: "MMC-2011-40771", dLat: 0.011, dLng: 0.006,
    reviews: [{ patientName: "Priyanka & Sam", rating: 5, comment: "Gentle with our 2-year-old. Didn't rush us at all." }],
  },
  {
    fullName: "Dr. Arjun Sharma", specialty: "Orthopedic", kind: "practising", gender: "male",
    experienceYears: 14, languages: ["English", "Hindi"], status: "busy", verified: true,
    rating: 4.6, consultFee: 600, homeVisitFee: 1100,
    qualifications: "MBBS, MS (Orthopedics)", education: "AIIMS, New Delhi (2008)",
    about: "Orthopaedic surgeon. Sprains, fractures, back and joint pain, and sports injuries. Practical, non-surgical-first approach.",
    registrationNo: "MMC-2008-22314", dLat: -0.010, dLng: 0.009,
    reviews: [{ patientName: "Karan V.", rating: 4, comment: "Good advice on my knee, avoided surgery for now." }],
  },
  {
    fullName: "Dr. Sana Sheikh", specialty: "Dermatologist", kind: "practising", gender: "female",
    experienceYears: 8, languages: ["English", "Hindi", "Urdu"], status: "online", verified: true,
    rating: 4.7, consultFee: 550, homeVisitFee: 1000,
    qualifications: "MBBS, MD (Dermatology)", education: "Osmania Medical College, Hyderabad (2014)",
    about: "Skin, hair and nails — acne, eczema, pigmentation and allergies. Evidence-based, no-nonsense routines.",
    registrationNo: "MMC-2014-51260", dLat: 0.002, dLng: -0.010,
    reviews: [{ patientName: "Aisha N.", rating: 5, comment: "Finally someone who fixed my acne without 10 products." }],
  },
  {
    fullName: "Dr. Priya Menon", specialty: "Gynecologist", kind: "practising", gender: "female",
    experienceYears: 13, languages: ["English", "Hindi", "Marathi"], status: "online", verified: true,
    rating: 4.8, consultFee: 600, homeVisitFee: 1100,
    qualifications: "MBBS, MS (Obstetrics & Gynecology)", education: "JIPMER, Puducherry (2009)",
    about: "Women's health across all ages — periods, PCOS, pregnancy care and menopause. Warm, private and unhurried.",
    registrationNo: "MMC-2009-28840", dLat: -0.006, dLng: -0.009,
    reviews: [
      { patientName: "Meghna P.", rating: 5, comment: "Made a difficult consult feel safe and normal." },
      { patientName: "R.K.", rating: 5, comment: "Extremely knowledgeable, answered every question." },
    ],
  },
  {
    fullName: "Dr. Imran Qureshi", specialty: "ENT", kind: "practising", gender: "male",
    experienceYears: 10, languages: ["English", "Hindi", "Urdu"], status: "online", verified: false,
    rating: 4.4, consultFee: 450, homeVisitFee: 900,
    qualifications: "MBBS, MS (ENT)", education: "Government Medical College, Aurangabad (2012)",
    about: "Ear, nose and throat — sinus trouble, sore throats, ear infections and hearing concerns.",
    registrationNo: "MMC-2012-45119", dLat: 0.013, dLng: -0.002,
  },
  {
    fullName: "Dr. Kavya Reddy", specialty: "Psychiatrist", kind: "practising", gender: "female",
    experienceYears: 9, languages: ["English", "Hindi", "Telugu"], status: "online", verified: true,
    rating: 4.7, consultFee: 700, homeVisitFee: 1200,
    qualifications: "MBBS, MD (Psychiatry)", education: "NIMHANS, Bengaluru (2013)",
    about: "Mental health for adults — anxiety, low mood, sleep and stress. Confidential, non-judgemental video consults.",
    registrationNo: "MMC-2013-49302", dLat: -0.003, dLng: 0.012,
    reviews: [{ patientName: "Anonymous", rating: 5, comment: "First doctor who actually listened. Felt heard." }],
  },
  // Append new entries — IDs are `doc-seed-<index>`, so inserting above would
  // renumber every doctor already booked in an existing install.
  {
    fullName: "Dr. Anil Bhatkar", specialty: "Neurologist", kind: "practising", gender: "male",
    experienceYears: 14, languages: ["English", "Hindi", "Marathi"], status: "online", verified: true,
    rating: 4.6, consultFee: 800, homeVisitFee: 1400,
    qualifications: "MBBS, MD, DM (Neurology)", education: "King Edward Memorial Hospital, Mumbai (2008)",
    about: "Brain and nerve care — migraines, seizures, giddiness, numbness and tremors. Fourteen years in stroke and epilepsy clinics.",
    registrationNo: "MMC-2008-30871", dLat: 0.009, dLng: -0.008,
    reviews: [
      { patientName: "Deepa V.", rating: 5, comment: "Sorted out migraines I'd had for years. Took the time to explain the triggers." },
      { patientName: "Mahesh P.", rating: 4, comment: "Thorough with my father's tremor. Clear about what the scans meant." },
    ],
  },
];

/** Build the seed roster as full Doctor rows near the map center. */
export function seedDoctors(): Doctor[] {
  const now = new Date().toISOString();
  return ROSTER.map((d, i) => ({
    id: `doc-seed-${i + 1}`,
    fullName: d.fullName,
    specialty: d.specialty,
    kind: d.kind,
    gender: d.gender,
    experienceYears: d.experienceYears,
    languages: d.languages,
    status: d.status,
    verified: d.verified,
    rating: d.rating,
    consultFee: d.consultFee,
    homeVisitFee: d.homeVisitFee,
    avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
    lat: MAP_CENTER.lat + d.dLat,
    lng: MAP_CENTER.lng + d.dLng,
    lastSeen: now,
    qualifications: d.qualifications,
    education: d.education,
    about: d.about,
    registrationNo: d.registrationNo,
  }));
}

/** Sample patient reviews for the seed roster (so profiles aren't empty). */
export function seedReviews() {
  const now = new Date().toISOString();
  const out: {
    id: string;
    requestId: string;
    doctorId: string;
    patientName: string;
    rating: number;
    comment: string;
    createdAt: string;
  }[] = [];
  ROSTER.forEach((d, i) => {
    (d.reviews ?? []).forEach((r, j) => {
      out.push({
        id: `rev-seed-${i + 1}-${j + 1}`,
        requestId: `req-seed-${i + 1}-${j + 1}`,
        doctorId: `doc-seed-${i + 1}`,
        patientName: r.patientName,
        rating: r.rating,
        comment: r.comment,
        createdAt: now,
      });
    });
  });
  return out;
}
