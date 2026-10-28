import type { Metadata } from "next";
import "./globals.css";
import "./workflows.css";
import "./accounts.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "./signal-desk.css";
import "./visual-effects.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "m8m — Automation studio", template: "%s · m8m" },
  description:
    "Build and run workflows, manage AI agents, and connect services in m8m.",
  icons: { icon: "/m4m-icon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
