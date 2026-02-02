import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Echo - Survey AI Platform",
  description: "Voice-powered surveys made simple",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
