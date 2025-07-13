import './globals.css';

export const metadata = {
  title: 'Conversation Flow Builder - Retell AI',
  description: 'Design your conversational workflow with Retell AI voice integration',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
