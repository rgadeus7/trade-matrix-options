export const metadata = {
  title: 'Trade Matrix Options Collector',
  description: 'API for collecting TradeStation options chain data',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
