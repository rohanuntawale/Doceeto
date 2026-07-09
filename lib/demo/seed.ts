import type {
  Doctor,
  Ambulance,
  SosEvent,
  ConsultRequest,
  Order,
  Review,
} from "@/lib/types/domain";

/** minutes-ago → ISO timestamp helper (relative to load). */
const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

// Points scattered around Pune for a believable map.
const AVATAR = ["#C15A38", "#C9A876", "#7C8B63", "#E0A890", "#8A6F52"];

export function seedDoctors(): Doctor[] {
  return [
    {
      id: "doc-1",
      fullName: "Dr. Ananya Rao",
      specialty: "General Physician",
      status: "online",
      verified: true,
      rating: 4.8,
      consultFee: 400,
      homeVisitFee: 900,
      avatarColor: AVATAR[0],
      lat: 18.5308,
      lng: 73.8475,
      lastSeen: ago(1),
    },
    {
      id: "doc-2",
      fullName: "Dr. Vikram Shah",
      specialty: "Cardiologist",
      status: "online",
      verified: true,
      rating: 4.9,
      consultFee: 800,
      homeVisitFee: 1600,
      avatarColor: AVATAR[2],
      lat: 18.5089,
      lng: 73.8271,
      lastSeen: ago(2),
    },
    {
      id: "doc-3",
      fullName: "Dr. Meera Iyer",
      specialty: "Pediatrician",
      status: "busy",
      verified: true,
      rating: 4.7,
      consultFee: 500,
      homeVisitFee: 1100,
      avatarColor: AVATAR[3],
      lat: 18.5642,
      lng: 73.7769,
      lastSeen: ago(4),
    },
    {
      id: "doc-4",
      fullName: "Dr. Rohan Kulkarni",
      specialty: "Orthopedic",
      status: "offline",
      verified: true,
      rating: 4.6,
      consultFee: 700,
      homeVisitFee: 1400,
      avatarColor: AVATAR[4],
      lat: 18.4967,
      lng: 73.9089,
      lastSeen: ago(90),
    },
    {
      id: "doc-5",
      fullName: "Dr. Sana Qureshi",
      specialty: "General Physician",
      status: "online",
      verified: false,
      rating: 4.4,
      consultFee: 350,
      homeVisitFee: 800,
      avatarColor: AVATAR[1],
      lat: 18.5793,
      lng: 73.8143,
      lastSeen: ago(3),
    },
  ];
}

export function seedAmbulances(): Ambulance[] {
  return [
    { id: "amb-1", vehicleNo: "MH12 AB 1234", driverName: "Suresh P.", status: "free", lat: 18.5314, lng: 73.8446 },
    { id: "amb-2", vehicleNo: "MH12 CD 5678", driverName: "Imran K.", status: "dispatched", lat: 18.5121, lng: 73.8302 },
    { id: "amb-3", vehicleNo: "MH14 EF 9012", driverName: "Ganesh M.", status: "free", lat: 18.5601, lng: 73.7801 },
    { id: "amb-4", vehicleNo: "MH12 GH 3456", driverName: "Prakash D.", status: "busy", lat: 18.4989, lng: 73.9051 },
  ];
}

/** The current doctor "me" for the doctor cockpit in demo mode. */
export const DEMO_DOCTOR_ID = "doc-1";

/** AuraMed dark stores (infrastructure catalog, not activity). */
export const DARK_STORES = [
  "Iyashi Store · Baner",
  "Iyashi Store · Kothrud",
  "Iyashi Store · Aundh",
  "Iyashi Store · Shivaji Nagar",
];

/** A small OTC/common-med catalog for the patient medicine flow. */
export const MED_CATALOG = [
  { name: "Paracetamol 650mg", price: 45 },
  { name: "Azithromycin 500mg", price: 120 },
  { name: "Cetirizine 10mg", price: 30 },
  { name: "ORS sachets", price: 25 },
  { name: "Pantoprazole 40mg", price: 85 },
  { name: "Vitamin D3 sachets", price: 90 },
  { name: "Salbutamol inhaler", price: 210 },
  { name: "Amlodipine 5mg", price: 60 },
];

export function seedSos(): SosEvent[] {
  return [
    {
      id: "sos-1",
      patientName: "Ravi Deshmukh",
      category: "cardiac",
      status: "open",
      address: "Baner Road, near Aundh flyover",
      lat: 18.5601,
      lng: 73.7869,
      ambulanceId: null,
      doctorId: null,
      notes: "Chest pain, breathing difficulty. Bystander reporting.",
      createdAt: ago(1),
      resolvedAt: null,
    },
    {
      id: "sos-2",
      patientName: "Unknown",
      category: "trauma",
      status: "enroute",
      address: "Nagar Road, Kharadi junction",
      lat: 18.5512,
      lng: 73.9436,
      ambulanceId: "amb-2",
      doctorId: "doc-2",
      notes: "Two-wheeler accident. Golden-hour dispatch active.",
      createdAt: ago(6),
      resolvedAt: null,
    },
    {
      id: "sos-3",
      patientName: "Lata Bhosale",
      category: "respiratory",
      status: "assigned",
      address: "Kothrud, Mayur Colony",
      lat: 18.5074,
      lng: 73.8077,
      ambulanceId: "amb-1",
      doctorId: null,
      notes: "Severe asthma attack.",
      createdAt: ago(3),
      resolvedAt: null,
    },
    {
      id: "sos-4",
      patientName: "Amit Save",
      category: "other",
      status: "resolved",
      address: "Viman Nagar, Phoenix area",
      lat: 18.5679,
      lng: 73.9143,
      ambulanceId: "amb-4",
      doctorId: "doc-4",
      notes: "Fainting episode, stabilized on site.",
      createdAt: ago(42),
      resolvedAt: ago(20),
    },
  ];
}

export function seedRequests(): ConsultRequest[] {
  return [
    {
      id: "req-1",
      patientName: "Priya Nair",
      type: "video",
      status: "pending",
      symptoms: "Fever 3 days, sore throat, mild cough.",
      fee: 400,
      address: "Online consult",
      lat: 18.5308,
      lng: 73.8475,
      createdAt: ago(1),
      doctorId: null,
    },
    {
      id: "req-2",
      patientName: "Sunil Gokhale",
      type: "home_visit",
      status: "pending",
      symptoms: "Elderly, high BP, needs check-up at home.",
      fee: 900,
      address: "Deccan Gymkhana, FC Road",
      lat: 18.5167,
      lng: 73.8412,
      createdAt: ago(4),
      doctorId: null,
    },
    {
      id: "req-3",
      patientName: "Neha Kale",
      type: "video",
      status: "accepted",
      symptoms: "Skin rash, follow-up on medication.",
      fee: 400,
      address: "Online consult",
      lat: 18.5308,
      lng: 73.8475,
      createdAt: ago(22),
      doctorId: "doc-1",
    },
    {
      id: "req-4",
      patientName: "Karan Mehta",
      type: "clinic",
      status: "completed",
      symptoms: "Annual health review.",
      fee: 400,
      address: "Iyashi partner clinic, Aundh",
      lat: 18.5602,
      lng: 73.8077,
      createdAt: ago(180),
      doctorId: "doc-1",
    },
  ];
}

export function seedOrders(): Order[] {
  return [
    {
      id: "ord-1",
      patientName: "Priya Nair",
      status: "out_for_delivery",
      items: [
        { name: "Paracetamol 650mg", qty: 1 },
        { name: "Azithromycin 500mg", qty: 1 },
      ],
      total: 245,
      address: "Baner, Pune",
      darkStore: "Iyashi Store · Baner",
      etaMins: 6,
      createdAt: ago(4),
    },
    {
      id: "ord-2",
      patientName: "Sunil Gokhale",
      status: "packed",
      items: [{ name: "Amlodipine 5mg", qty: 2 }],
      total: 180,
      address: "Deccan, Pune",
      darkStore: "Iyashi Store · Shivaji Nagar",
      etaMins: 9,
      createdAt: ago(2),
    },
    {
      id: "ord-3",
      patientName: "Lata Bhosale",
      status: "placed",
      items: [
        { name: "Salbutamol inhaler", qty: 1 },
        { name: "Montelukast 10mg", qty: 1 },
      ],
      total: 420,
      address: "Kothrud, Pune",
      darkStore: "Iyashi Store · Kothrud",
      etaMins: 11,
      createdAt: ago(1),
    },
    {
      id: "ord-4",
      patientName: "Karan Mehta",
      status: "delivered",
      items: [{ name: "Vitamin D3 sachets", qty: 4 }],
      total: 320,
      address: "Aundh, Pune",
      darkStore: "Iyashi Store · Aundh",
      etaMins: 0,
      createdAt: ago(48),
    },
  ];
}

export function seedReviews(): Review[] {
  return [
    { id: "rev-1", patientName: "Neha K.", rating: 5, comment: "Came home within the hour. Kind and thorough.", createdAt: ago(120) },
    { id: "rev-2", patientName: "Karan M.", rating: 5, comment: "Explained everything clearly. Prescription arrived in minutes.", createdAt: ago(300) },
    { id: "rev-3", patientName: "Sunil G.", rating: 4, comment: "Good consult, slightly delayed but worth it.", createdAt: ago(1440) },
  ];
}
