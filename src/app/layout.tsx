import type { Metadata, Viewport } from "next";
import { Caveat, Dancing_Script } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
});

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing",
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
  themeColor: "#25918a",
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
      <body className={`${caveat.variable} ${dancingScript.variable} antialiased hyphens-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
