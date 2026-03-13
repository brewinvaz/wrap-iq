import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProviderWrapper } from "@/components/ThemeProviderWrapper";
import RulerOverlay from "@/components/RulerOverlay";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "WrapFlow",
  description:
    "WrapFlow is a shop management platform for vehicle wrap and paint protection film (PPF) businesses. Track projects, manage schedules, and streamline operations.",
  openGraph: {
    title: "WrapFlow",
    description:
      "Shop management platform for vehicle wrap and PPF businesses. Track projects, manage schedules, and streamline operations.",
    type: "website",
  },
};

const themeScript = `(function(){var t=localStorage.getItem('wrapiq-theme')||'dark';if(t==='system'){var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',d?'dark':'light')}else{document.documentElement.setAttribute('data-theme',t)}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${jakarta.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProviderWrapper>
          <RulerOverlay />
          {children}
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
