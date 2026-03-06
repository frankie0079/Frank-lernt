import type { Metadata, Viewport } from "next";
import { Caveat } from "next/font/google";
import "./globals.css";

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: "Die Wandervögel — Gemeinsam unterwegs",
  description:
    "Reisebegleiter-Plattform für unsere Wandergruppe. Tourenübersicht, Reisetagebuch, Fotogalerie und interaktive Karte.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Wandervögel",
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
      <body className={`${caveat.variable} antialiased hyphens-auto`}>
        {children}
      </body>
    </html>
  );
}
