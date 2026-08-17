import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "health.doceeto.app",
  appName: "Doceeto",
  webDir: "dist",
  server: {
    // The APK is a shell around the existing Next.js patient/provider web app.
    // Keeping the page origin on the deployed app makes authentication cookies,
    // OAuth redirects, landing-page routing, and all three role flows behave
    // exactly as they do on the web instead of crossing origins from a second
    // Vite client.
    url: process.env.CAPACITOR_SERVER_URL || "https://doceeto.vercel.app",
    androidScheme: "https",
    cleartext: false,
  },
  plugins: {
    SplashScreen: { launchAutoHide: true, backgroundColor: "#F6F9F7", showSpinner: false },
    StatusBar: { overlaysWebView: false, backgroundColor: "#F6F9F7", style: "LIGHT" },
  },
};

export default config;
