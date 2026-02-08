import { SolanaProviders } from './components/providers';
import { AuthProvider } from '@/contexts/AuthContext';
import Header from './components/header';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SolanaProviders>
            <Header />
            {children}
          </SolanaProviders>
        </AuthProvider>
      </body>
    </html>
  );
}