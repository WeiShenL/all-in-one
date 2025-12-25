import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { TRPCProvider } from './components/TRPCProvider';
import { AuthProvider } from '../lib/supabase/auth-context';
import { NotificationProvider } from '../lib/context/NotificationContext';
import { ToastContainer } from './components/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'All In One - Smart Task Management System',
  description:
    'Empower your team to stay productive with flexible work arrangements. Organize tasks, collaborate seamlessly, and track performance.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' className={`${geist.variable} ${geistMono.variable}`}>
      <body className='font-sans antialiased'>
        <ErrorBoundary>
          <AuthProvider>
            <TRPCProvider>
              <NotificationProvider autoRemoveDelay={60000}>
                {children}
                <ToastContainer />
              </NotificationProvider>
            </TRPCProvider>
          </AuthProvider>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  );
}
/*
NOTE: children has been wrapped by Provider for tRPC
*/
