import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Absurdly Yours · 骚有介事",
  description: "Ordinary life. Outrageously well put. A little voice, a little wit, an entirely excessive amount of flair.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
