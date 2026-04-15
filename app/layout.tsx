import type { Metadata } from 'next';
import { Chakra_Petch, Geist_Mono } from 'next/font/google';
import './globals.css';

const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-chakra-petch',
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Admin emmchier',
  description: 'Multi-space admin dashboard for Contentful assets and entries.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${chakraPetch.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${chakraPetch.className} flex min-h-full flex-col bg-white text-neutral-900`}>
        {children}
      </body>
    </html>
  );
}
