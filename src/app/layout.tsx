import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
// @streamdown/math renders equations as KaTeX markup, which is unstyled and
// overlapping without this stylesheet. Required, not decorative.
import "katex/dist/katex.min.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// A serif for the wordmark and empty state - the register of a textbook rather
// than a SaaS dashboard. Used sparingly; the UI itself stays sans.
const sourceSerif = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Aristo",
    template: "%s · Aristo",
  },
  description:
    "A study assistant for Cambridge candidates - syllabus-grounded answers, exam technique, and past-paper practice.",
  applicationName: "Aristo",
  appleWebApp: {
    capable: true,
    title: "Aristo",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout resize when the on-screen keyboard opens instead of the
  // keyboard covering the composer.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#101419" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // next-themes writes the class before paint; React would otherwise warn
      // about the server/client mismatch it deliberately creates.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body
        // Not for anything this app renders. Extensions that proofread as you
        // type - Grammarly writes `data-gr-ext-installed`, and it is far from
        // the only one - stamp attributes onto <body> before React hydrates,
        // and React reports the difference as a mismatch the author cannot fix.
        // Suppressed one level deep, so a genuine mismatch inside the tree is
        // still reported.
        suppressHydrationWarning
        className="flex min-h-full flex-col"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
