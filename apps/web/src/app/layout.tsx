import type { Metadata } from 'next'
import { Kanit } from 'next/font/google'
import './globals.css'
import { Providers } from '@/lib/providers'

const kanit = Kanit({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-kanit',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Serene PMS — ระบบบริหารจัดการที่พัก',
  description: 'ระบบบริหารจัดการรีสอร์ทและโรงแรม Serene PMS',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${kanit.variable} font-kanit antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
