import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Echo — AI Research Interview Platform",
  description:
    "Automate qualitative user research interviews with AI-powered outbound phone calls. Create campaigns, conduct interviews, and analyze transcripts at scale.",
  keywords: ["AI", "research", "interviews", "qualitative", "voice", "surveys"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
