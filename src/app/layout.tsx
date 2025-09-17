import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'All-in-One Project',
  description: 'Team project built with Next.js',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
