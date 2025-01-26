import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'IceNode Dashboard',
  description: 'Avalanche Transaction Explorer',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                {/* Logo */}
                <div className="logo-container">
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-[#E84142] to-[#1B1B1B] bg-clip-text text-transparent">
                    ICE<span className="text-blue-600">NODE</span>
                  </h1>
                </div>
                <span className="text-sm text-gray-500">Avalanche Blockchain Explorer</span>
              </div>
              {/* Navigation */}
              <div className="flex space-x-4">
                <Link href="/" className="text-gray-700 hover:text-blue-600">Transactions</Link>
                <Link href="/contracts" className="text-gray-700 hover:text-blue-600">Smart Contracts</Link>
                <Link href="/events" className="text-gray-700 hover:text-blue-600">Events</Link>
                <Link href="/wallets" className="text-gray-700 hover:text-blue-600">Wallets</Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
