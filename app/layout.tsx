import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Solar4U — DIY solar, without the guesswork", template: "%s · Solar4U" },
  description: "Compare solar equipment prices, plan a residential system, model production, build wiring diagrams and learn with other DIY builders.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Solar4U — DIY solar, without the guesswork",
    description: "Compare real prices, plan a system, validate wiring, and learn with DIY solar builders.",
    type: "website",
    images: [{ url: "/og.png", width: 1734, height: 907, alt: "Solar4U DIY solar planning workbench" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Solar4U — DIY solar, without the guesswork",
    description: "Compare real prices, plan a system, validate wiring, and learn with DIY solar builders.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
