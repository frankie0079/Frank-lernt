import type { Metadata, Viewport } from "next";
import { Alfa_Slab_One, Oswald, Work_Sans } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Display — plakative Vintage-Slab-Serif (Aloha-Sixty titles, hero, event names)
const alfaSlabOne = Alfa_Slab_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

// Headline — kondensiert, Caps für Eyebrows, Kickers, Badges
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-headline",
});

// Body — clean sans
const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "EventDocs — Gemeinsam dokumentieren",
  description:
    "Kollaborative Event-Dokumentation. Fotos, Videos, Sprachmemos und Texte in Echtzeit teilen.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EventDocs",
  },
};

export const viewport: Viewport = {
  themeColor: "#C94A2B", // Aloha-Sixty terracotta
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
      </head>
      <body
        className={`${alfaSlabOne.variable} ${oswald.variable} ${workSans.variable} font-sans antialiased hyphens-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
      >
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
