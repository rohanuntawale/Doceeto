import { mkdir } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const base = process.env.BASE ?? "http://localhost:3107";
const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const output = path.resolve(".next", "visual-smoke");

function cookieFrom(response) {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(/(iyashi_sid_\w+)=([^;]+)/);
  if (!match) throw new Error("Registration did not return a session cookie.");
  return { name: match[1], value: match[2] };
}

async function register(body) {
  const response = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Registration failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  return cookieFrom(response);
}

async function completePatientOnboarding(cookie) {
  const response = await fetch(`${base}/api/auth/health-profile`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${cookie.name}=${cookie.value}`,
      "x-iyashi-surface": "patient",
    },
    body: JSON.stringify({ allergies: "No known allergies" }),
  });
  if (!response.ok) throw new Error(`Onboarding save failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
}

async function visit(browser, label, pathname, cookie, { skipSplash = false, readySelector } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  if (cookie) await page.setCookie({ ...cookie, url: base });
  const response = await page.goto(`${base}${pathname}`, { waitUntil: "networkidle2", timeout: 45_000 });
  if (skipSplash) {
    await page.mouse.click(720, 500);
    await new Promise(resolve => setTimeout(resolve, 700));
  }
  if (readySelector) {
    await page.waitForSelector(readySelector, { timeout: 10_000 });
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  await page.screenshot({ path: path.join(output, `${label}.png`), fullPage: true });
  const title = await page.title();
  const url = page.url();
  await page.close();
  if (!response?.ok()) throw new Error(`${label} returned HTTP ${response?.status() ?? "no response"}.`);
  if (pageErrors.length) throw new Error(`${label} raised a browser error: ${pageErrors.join(" | ")}`);
  console.log(`PASS  ${label} — ${title || "page"} — ${url}`);
  return url;
}

async function main() {
  await mkdir(output, { recursive: true });
  const suffix = Date.now().toString(36);
  const patient = await register({
    role: "patient",
    name: "Visual Smoke Patient",
    email: `visual.patient.${suffix}@doceeto.local`,
    password: "VisualSmoke1",
  });
  const pendingDoctor = await register({
    role: "doctor",
    fullName: "Dr. Visual Smoke",
    specialty: "General Physician",
    qualifications: "MBBS",
    registrationNo: `VIS-${suffix}`,
    age: 35,
    gender: "male",
    languages: ["English"],
    email: `visual.doctor.${suffix}@doceeto.local`,
    password: "VisualSmoke1",
  });
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
  try {
    const landing = await visit(browser, "landing", "/");
    if (!landing.startsWith(base)) throw new Error("Landing page redirected unexpectedly.");
    const onboarding = await visit(browser, "patient-onboarding", "/patient/onboarding", patient, { skipSplash: true, readySelector: ".profile-page" });
    if (!onboarding.includes("/patient/onboarding")) throw new Error("New patient did not reach onboarding.");
    await completePatientOnboarding(patient);
    const profile = await visit(browser, "patient-profile", "/patient/account", patient, { skipSplash: true, readySelector: ".patient-profile-hero" });
    if (!profile.includes("/patient/account")) throw new Error("Completed patient did not reach their profile.");
    const care = await visit(browser, "mira-care", "/patient/care", patient, { skipSplash: true, readySelector: ".mira-chat" });
    if (!care.includes("/patient/care")) throw new Error("Completed patient did not reach Mira care.");
    const verification = await visit(browser, "doctor-verification", "/doctor", pendingDoctor, { skipSplash: true, readySelector: "h1" });
    if (!verification.includes("/verification?as=doctor")) throw new Error("Unverified doctor was not held for review.");
  } finally {
    await browser.close();
  }
  console.log(`Screenshots: ${output}`);
}

main().catch(error => {
  console.error("visual smoke failed:", error.message);
  process.exitCode = 1;
});
