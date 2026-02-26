import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkillCredit",
  description: "Share skills. Earn credits. Keep learning.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,800;0,900&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}