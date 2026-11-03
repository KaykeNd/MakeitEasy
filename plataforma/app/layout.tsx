import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Make it Easy | Inglês no seu ritmo",
  description: "Aprenda inglês um passo de cada vez com Make it Easy.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
