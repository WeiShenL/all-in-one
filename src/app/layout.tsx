import type { Metadata } from 'next';
import { TRPCProvider } from './components/TRPCProvider';
import { AuthProvider } from '../lib/supabase/auth-context';

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
      <body>
        <AuthProvider>
          <TRPCProvider>{children}</TRPCProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
/*
NOTE: children has been wrapped by Provider for tRPC
*/
