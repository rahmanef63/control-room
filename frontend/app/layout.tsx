import type { Metadata } from 'next';
import './globals.css';
import { ConvexClientProvider } from '@/lib/convex';

export const metadata: Metadata = {
  title: 'VPS Control Room',
  description: 'VPS monitoring and control dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
