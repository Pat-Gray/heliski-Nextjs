"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import PrintDailyPlan from "./print-daily-plan";
import type { Run, Area, SubArea } from "@/lib/schemas/schema";

interface PrintData {
  areas: Area[];
  subAreas: SubArea[];
  filteredRuns: Run[];
  selectedAreas: Set<string>;
  currentDate: string;
  greenCount: number;
  orangeCount: number;
  redCount: number;
}

interface PrintContextType {
  setPrintData: (data: PrintData) => void;
  triggerPrint: () => void;
}

const PrintContext = createContext<PrintContextType | undefined>(undefined);

export function PrintProvider({ children }: { children: ReactNode }) {
  const [printData, setPrintData] = useState<PrintData | null>(null);

  const triggerPrint = () => {
    if (printData) {
      console.log('🖨️ Print provider: triggering print...');
      // Small delay to ensure content is rendered
      setTimeout(() => {
        try {
          window.print();
          console.log('✅ Print dialog opened successfully');
          // Reset after printing
          setTimeout(() => {
            setPrintData(null);
          }, 1000);
        } catch (error) {
          console.error('❌ Print failed:', error);
          // Try again after a short delay
          setTimeout(() => {
            console.log('🖨️ Retrying print...');
            window.print();
          }, 500);
        }
      }, 100);
    } else {
      console.warn('⚠️ No print data available');
    }
  };

  return (
    <PrintContext.Provider value={{ setPrintData, triggerPrint }}>
      {children}
      {/* Print component is always rendered but hidden by CSS during normal viewing */}
      {printData && (
        <PrintDailyPlan
          areas={printData.areas}
          subAreas={printData.subAreas}
          filteredRuns={printData.filteredRuns}
          selectedAreas={printData.selectedAreas}
          currentDate={printData.currentDate}
          greenCount={printData.greenCount}
          orangeCount={printData.orangeCount}
          redCount={printData.redCount}
        />
      )}
    </PrintContext.Provider>
  );
}

export function usePrint() {
  const context = useContext(PrintContext);
  if (context === undefined) {
    throw new Error("usePrint must be used within a PrintProvider");
  }
  return context;
}
