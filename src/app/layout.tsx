import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import { getCurrentUser } from "@/lib/auth";
import { Header } from "@/components/Header";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Briefcast",
  description: "Follow your own podcasts. Get a written brief and a spoken recap.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="grain" />
        <Header user={user} />
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">{children}</main>
      </body>
    </html>
  );
}
