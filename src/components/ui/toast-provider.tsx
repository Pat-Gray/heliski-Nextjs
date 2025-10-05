"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { Toast, ToastTitle, ToastDescription, ToastClose } from "./toast";

interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

interface ToastContextType {
  toasts: ToastData[];
  toast: (toast: Omit<ToastData, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const toast = useCallback(({ title, description, variant = "default" }: Omit<ToastData, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { id, title, description, variant };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col-reverse gap-2 max-w-[420px] w-full">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          className="mb-0"
        >
          <div className="grid gap-1">
            <ToastTitle>{toast.title}</ToastTitle>
            {toast.description && (
              <ToastDescription>{toast.description}</ToastDescription>
            )}
          </div>
          <ToastClose onClick={() => dismiss(toast.id)} />
        </Toast>
      ))}
    </div>
  );
}
