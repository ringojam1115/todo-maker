import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "PLN — Goal-driven TODO",
  description: "Set goals, get AI-generated daily TODOs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className="h-full"
    >
      <body
        className="h-full"
        style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        {children}
      </body>
    </html>
  );
}
