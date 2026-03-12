import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3DZAAP Print Manager",
  description: "SaaS para gestão de pequenos negócios de impressão 3D.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>{children}</body>
    </html>
  );
}
