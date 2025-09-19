import type { Metadata } from 'next'
import { TRPCProvider } from './components/TRPCProvider'

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
    <html lang="en">
      <body>
        <TRPCProvider>
          {children}
        </TRPCProvider>
      </body>
    </html>
  );
}
/*
NOTE: children has been wrapped by Provider for tRPC
*/
