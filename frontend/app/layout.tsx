import type { Metadata, Viewport } from 'next';

import { RegisterServiceWorker } from '@/components/pwa/register-sw';
import { ConvexClientProvider } from '@/lib/convex';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://vps.rahmanef.com'),
  title: {
    default: 'VPS Control Room',
    template: '%s · VPS Control Room',
  },
  description: 'Live VPS operations cockpit for apps, agents, terminals, security, and audit trails.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Control Room',
  },
  applicationName: 'VPS Control Room',
  icons: {
    icon: '/icon',
    apple: '/apple-icon',
  },
};

export const viewport: Viewport = {
  themeColor: '#22d3ee',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <RegisterServiceWorker />
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
