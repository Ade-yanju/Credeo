import type { Metadata, Viewport } from "next";
// import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { InstallBanner } from "@/components/install-banner";

const inter = { variable: "font-inter" };
const playfair = { variable: "font-playfair" };

/*
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});
*/

export const metadata: Metadata = {
  title: "Vodium Ledger — Africa's credit infrastructure layer",
  description:
    "WhatsApp-first credit tracking and intelligence for African vendors. Track who owes you, recover faster, score smarter.",
  metadataBase: new URL("https://vodiumledger.com"),
  applicationName: "Vodium Ledger",
  appleWebApp: {
    capable: true,
    title: "Vodium",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    // iOS ignores SVG touch icons — it needs a real PNG or the home-screen
    // tile falls back to a page screenshot.
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Vodium Ledger",
    description: "The credit infrastructure of African vendor commerce.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // extend under notches; pair with env(safe-area-inset-*)
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-vodium-cream text-vodium-black">
        {children}
        <PwaRegister />
        <InstallBanner />
      </body>
    </html>
  );
}
