"use client";

import { useEffect } from 'react';

/**
 * Service Worker Registration Component
 * Registers the service worker for tile caching in production
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Only register service worker in production
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    // Check if service workers are supported
    if ('serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
          });

          console.log('✅ Service Worker registered successfully:', registration);

          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('🔄 New service worker available. Reload to update.');
                  // Could show a notification to user about update
                }
              });
            }
          });

          // Handle controller change (page refresh after update)
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('🔄 Service worker controller changed');
            // Reload page to get new service worker
            window.location.reload();
          });

        } catch (error) {
          console.error('❌ Service Worker registration failed:', error);
        }
      };

      registerSW();
    } else {
      console.warn('⚠️ Service Workers not supported in this browser');
    }
  }, []);

  return null; // This component doesn't render anything
}

export default ServiceWorkerRegistration;
