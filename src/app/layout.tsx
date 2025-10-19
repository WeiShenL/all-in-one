import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { TRPCProvider } from './components/TRPCProvider';
import { AuthProvider } from '../lib/supabase/auth-context';
import { NotificationProvider } from '../lib/context/NotificationContext';
import { ToastContainer } from './components/ToastContainer';

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
    <html lang='en'>
      <body className={inter.className}>
        <AuthProvider>
          <TRPCProvider>
            <NotificationProvider autoRemoveDelay={60000}>
              {children}
              <ToastContainer />
            </NotificationProvider>
          </TRPCProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
/*
NOTE: children has been wrapped by Provider for tRPC
*/
