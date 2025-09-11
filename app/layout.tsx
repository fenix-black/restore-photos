import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { LocalizationProvider } from '@/contexts/LocalizationContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Restore Photos - AI-Powered Photo Restoration',
  description: 'Transform your old photos with AI. Restore, colorize, and bring memories to life.',
  keywords: ['photo restoration', 'AI', 'image enhancement', 'old photos', 'colorize', 'restore memories'],
  authors: [{ name: 'Fenix' }],
  creator: 'Fenix',
  publisher: 'Fenix',
  
  // Open Graph metadata for social sharing
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://restore.fenixblack.ai',
    siteName: 'Restore Photos',
    title: 'Restore Photos - AI-Powered Photo Restoration',
    description: 'Transform your old photos with AI. Restore, colorize, and bring memories to life.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Restore Photos - AI Photo Restoration',
      },
    ],
  },
  
  // Twitter Card metadata
  twitter: {
    card: 'summary_large_image',
    site: '@fenix',
    creator: '@fenix',
    title: 'Restore Photos - AI-Powered Photo Restoration',
    description: 'Transform your old photos with AI. Restore, colorize, and bring memories to life.',
    images: ['/og-image.png'],
  },
  
  // Additional metadata
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
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
      <head>
        <link rel="icon" href="/fenix-icon.png" type="image/png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Restore Photos",
              "description": "Transform your old photos with AI. Restore, colorize, and bring memories to life.",
              "url": "https://restore-photos.vercel.app",
              "applicationCategory": "MultimediaApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "creator": {
                "@type": "Organization",
                "name": "Fenix"
              }
            })
          }}
        />
      </head>
      <body className={inter.className}>
        <LocalizationProvider>
          {children}
        </LocalizationProvider>
      </body>
    </html>
  );
}