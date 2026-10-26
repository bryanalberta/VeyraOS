import * as React from "react";
import { SalesHistoryContent } from "./sales-history-content";

export default function SalesHistoryPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
        </div>
      }
    >
      <SalesHistoryContent />
    </React.Suspense>
  );
}
