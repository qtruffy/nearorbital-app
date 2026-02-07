import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  viewportFit: 'cover',
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'NearOrbital — Real-Time Satellite Tracking',
  description:
    'NearOrbital provides real-time satellite tracking with accurate orbital data and live position updates.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.className} antialiased`}>{children}</body>
    </html>
  );
}
