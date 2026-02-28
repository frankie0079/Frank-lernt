import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import "./globals.css";

export const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: "Die Wandervögel — Gemeinsam unterwegs",
  description:
    "Reisebegleiter-Plattform für unsere Wandergruppe. Tourenübersicht, Reisetagebuch, Fotogalerie und interaktive Karte.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${caveat.variable} antialiased`} style={{ hyphens: "auto" }}>
        {children}
      </body>
    </html>
  );
}
