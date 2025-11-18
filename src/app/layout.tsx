import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { TRPCProvider } from './components/TRPCProvider';
import { AuthProvider } from '../lib/supabase/auth-context';
import { NotificationProvider } from '../lib/context/NotificationContext';
import { ToastContainer } from './components/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'All-in-One Project',
  description: 'Team project built with Next.js',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' style={{ margin: 0, padding: 0 }}>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100%;
              height: 100%;
            }
          `,
          }}
        />
      </head>
      <body className={inter.className} style={{ margin: 0, padding: 0 }}>
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
      </body>
    </html>
  );
}
/*
NOTE: children has been wrapped by Provider for tRPC
*/
