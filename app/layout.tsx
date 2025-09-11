import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { LocalizationProvider } from '@/contexts/LocalizationContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Restore Photos - AI-Powered Photo Restoration',
  description: 'Transform your old photos with AI. Restore, colorize, and bring memories to life.',
  icons: {
    icon: '/fenix-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <LocalizationProvider>
          {children}
        </LocalizationProvider>
      </body>
    </html>
  );
}