import type { Metadata } from "next";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { QueryProvider } from "@/components/query-provider";
import { PrintProvider } from "@/components/print-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { ToastProvider } from "@/components/ui/toast-provider";
import { AppLayout } from "../components/app-layout";
import ServiceWorkerRegistration from "@/components/service-worker-registration";

export const metadata: Metadata = {
  title: "Heli Ski Run Coding",
  description: "Heli Ski Run Coding",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        <AuthProvider>
          <QueryProvider>
            <PrintProvider>
              <ToastProvider>
                <AppLayout>
                  {children}
                </AppLayout>
                <ServiceWorkerRegistration />
              </ToastProvider>
            </PrintProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
