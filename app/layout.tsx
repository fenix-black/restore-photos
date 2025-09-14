import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { LocalizationProvider } from '@/contexts/LocalizationContext';
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Restore Photos - AI-Powered Photo Restoration',
  description: 'Transform your old photos with AI. Restore, colorize, and bring memories to life.',
  keywords: ['photo restoration', 'AI', 'image enhancement', 'old photos', 'colorize', 'restore memories'],
  authors: [{ name: 'Fenix' }],
  creator: 'Fenix',
  publisher: 'Fenix',
  
  // Open Graph metadata for social sharing (Facebook, Instagram, LinkedIn)
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
        type: 'image/png',
      },
      // Square image for Instagram stories/posts
      {
        url: '/og-square.png',
        width: 1080,
        height: 1080,
        alt: 'Restore Photos - AI Photo Restoration',
        type: 'image/png',
      },
    ],
    // Additional Facebook/Instagram specific metadata
    videos: undefined, // Explicitly no video for cleaner sharing
  },
  
  // Twitter Card metadata
  twitter: {
    card: 'summary_large_image',
    site: '@fenixblack_ai',
    creator: '@fenixblack_ai',
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
        {/* Facebook/Instagram specific meta tags */}
        <meta property="fb:app_id" content="61577735513391" />
        <meta property="og:image:secure_url" content="https://restore.fenixblack.ai/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:updated_time" content={new Date().toISOString()} />
        <meta property="article:author" content="FenixBlack.ai" />
        <meta property="article:publisher" content="https://www.fenixblack.ai" />
        {/* Instagram specific optimization */}
        <meta name="instagram:card" content="summary_large_image" />
        {/* Additional social optimization */}
        <meta name="theme-color" content="#1a1a2e" />
        <meta name="msapplication-TileColor" content="#1a1a2e" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Restore Photos",
              "description": "Transform your old photos with AI. Restore, colorize, and bring memories to life.",
              "url": "https://restore.fenixblack.ai",
              "applicationCategory": "MultimediaApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "screenshot": [
                "https://restore.fenixblack.ai/og-image.png",
                "https://restore.fenixblack.ai/og-square.png"
              ],
              "creator": {
                "@type": "Organization",
                "name": "Fenix",
                "url": "https://www.fenixblack.ai",
                "logo": "https://restore.fenixblack.ai/fenix-icon.png"
              },
              "potentialAction": {
                "@type": "UseAction",
                "target": "https://restore.fenixblack.ai"
              }
            })
          }}
        />
      </head>
      <body className={inter.className}>
        <LocalizationProvider>
          {children}
        </LocalizationProvider>
        <Analytics />
      </body>
    </html>
  );
}