import type { Metadata, Viewport } from "next";
import { Archivo, Martian_Mono } from "next/font/google";
import "./globals.css";

// Archivo carries a width axis (62-125), so one family covers expanded numerals,
// editorial statements and condensed vertical labels.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

// Martian Mono for telemetry, serials, measurements and UI.
const martian = Martian_Mono({
  variable: "--font-martian",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "VANTA / R1",
  description:
    "VANTA R1. A 164 kg, 214 hp road machine. 99 units worldwide, $48,000. Allocation by request.",
  openGraph: {
    title: "VANTA / R1",
    description: "99 units worldwide. Allocation by request.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#060708",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${martian.variable}`}>
      <body>
        <noscript>
          {/* without JavaScript the film cannot run: lay the scenes out as a plain document */}
          <style>{`.scene{height:auto!important}.scene-stage{position:relative!important;opacity:1!important;height:100svh}.from-below{transform:none!important}.loader-root,.layer-stage{display:none!important}`}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
