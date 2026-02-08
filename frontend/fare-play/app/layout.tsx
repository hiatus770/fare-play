import { SolanaProviders } from './components/providers';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SolanaProviders>
          {children}
        </SolanaProviders>
      </body>
    </html>
  );
}