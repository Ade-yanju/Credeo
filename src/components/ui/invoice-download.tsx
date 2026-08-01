"use client";

import { Download } from "lucide-react";

export function InvoiceDownloadButton({ brand, pdfPath }: { brand: string; pdfPath: string }) {
  return (
    <a
      href={pdfPath}
      target="_blank"
      rel="noreferrer"
      className="no-print w-full mt-4 py-2.5 rounded-xl text-sm font-bold text-vodium-black inline-flex items-center justify-center gap-2"
      style={{ backgroundColor: brand }}
    >
      <Download size={15} /> Download PDF
    </a>
  );
}
