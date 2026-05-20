// Client-side export helpers (no backend required).
import { jsPDF } from "jspdf";
import type { Book } from "@/src/types";

export async function exportBookAsPDF(book: Book) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  // Title page
  doc.setFont("times", "bold");
  doc.setFontSize(30);
  doc.text(book.title, pageWidth / 2, 100, { align: "center" });
  doc.setFontSize(18);
  doc.text("By AI Author", pageWidth / 2, 120, { align: "center" });

  // Table of contents
  doc.addPage();
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.text("Table of Contents", margin, 30);
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  book.chapters.forEach((ch, i) => {
    doc.text(`Chapter ${ch.number}: ${ch.title}`, margin, 50 + i * 10);
  });

  // Chapters
  book.chapters.forEach(ch => {
    doc.addPage();
    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.text(`Chapter ${ch.number}: ${ch.title}`, margin, 30);

    doc.setFont("times", "normal");
    doc.setFontSize(11);
    const lines: string[] = doc.splitTextToSize(ch.content || "", pageWidth - margin * 2);

    let y = 50;
    lines.forEach(line => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 6;
    });
  });

  doc.save(`${book.title}.pdf`);
}

export function exportBookAsMarkdown(book: Book) {
  let md = `# ${book.title}\n\n`;
  book.chapters.forEach(ch => {
    md += `## Chapter ${ch.number}: ${ch.title}\n\n${ch.content}\n\n`;
  });

  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${book.title}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
