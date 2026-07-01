// Client-side export helpers (no backend required).
import { jsPDF } from "jspdf";
import type { Book } from "@/src/types";

export async function exportBookAsPDF(book: Book) {
  let pdfFormat: string | [number, number] = 'a4';
  let margin = 20;

  if (book.bookFormat === 'KDP Format (6x9 Trade)') {
    pdfFormat = [152.4, 228.6]; // 6" x 9" in mm
    margin = 15;
  } else if (book.bookFormat === 'Google Play Books (5x8 ePUB/Compact)') {
    pdfFormat = [127, 203.2]; // 5" x 8" in mm
    margin = 12;
  }

  const doc = new jsPDF({
    format: pdfFormat,
    unit: 'mm'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Title page
  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.text(book.title, pageWidth / 2, pageHeight / 2 - 30, { align: "center" });
  doc.setFontSize(16);
  doc.text(`By ${book.authorName || "AI Writer"}`, pageWidth / 2, pageHeight / 2 - 12, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(9);
  let coverY = pageHeight / 2 + 10;
  if (book.bookFormat) {
    doc.text(`Format: ${book.bookFormat}`, pageWidth / 2, coverY, { align: "center" });
    coverY += 6;
  }
  if (book.isbn) {
    doc.text(`ISBN: ${book.isbn}`, pageWidth / 2, coverY, { align: "center" });
  }

  // Group chapters by volume
  const chaptersByVolume: { [key: number]: { title: string; chapters: typeof book.chapters } } = {};
  book.chapters.forEach(ch => {
    const volNum = ch.volumeNumber || 1;
    const volTitle = ch.volumeTitle || `Volume ${volNum}`;
    if (!chaptersByVolume[volNum]) {
      chaptersByVolume[volNum] = { title: volTitle, chapters: [] };
    }
    chaptersByVolume[volNum].chapters.push(ch);
  });

  const hasMultipleVolumes = Object.keys(chaptersByVolume).length > 1;

  // Table of contents
  doc.addPage();
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.text("Table of Contents", margin, margin + 10);
  doc.setFont("times", "normal");
  doc.setFontSize(10);

  let tocY = margin + 25;
  Object.entries(chaptersByVolume).forEach(([volNumStr, volData]) => {
    if (hasMultipleVolumes) {
      if (tocY > pageHeight - 30) {
        doc.addPage();
        tocY = margin;
      }
      doc.setFont("times", "bold");
      doc.text(volData.title, margin, tocY);
      tocY += 8;
    }
    doc.setFont("times", "normal");
    volData.chapters.forEach(ch => {
      if (tocY > pageHeight - 20) {
        doc.addPage();
        tocY = margin;
      }
      doc.text(`Chapter ${ch.number}: ${ch.title}`, margin + 4, tocY);
      tocY += 7;
    });
    tocY += 5; // extra spacing between volumes
  });

  // Volumes and Chapters content
  Object.entries(chaptersByVolume).forEach(([volNumStr, volData]) => {
    const volNum = parseInt(volNumStr);

    // If multiple volumes, add a Volume Divider Page
    if (hasMultipleVolumes) {
      doc.addPage();
      doc.setFont("times", "bold");
      doc.setFontSize(22);
      doc.text(`Volume ${volNum}`, pageWidth / 2, pageHeight / 2 - 20, { align: "center" });
      doc.setFontSize(14);
      doc.text(volData.title, pageWidth / 2, pageHeight / 2 - 5, { align: "center" });

      if (book.volumeIsbns && book.volumeIsbns[volNum - 1]) {
        doc.setFont("times", "normal");
        doc.setFontSize(9);
        doc.text(`ISBN: ${book.volumeIsbns[volNum - 1]}`, pageWidth / 2, pageHeight / 2 + 15, { align: "center" });
      }
    }

    volData.chapters.forEach(ch => {
      doc.addPage();
      doc.setFont("times", "bold");
      doc.setFontSize(18);
      
      // Print Volume title at the top of the page if it exists
      if (ch.volumeTitle) {
        doc.setFontSize(9);
        doc.setFont("times", "italic");
        doc.text(ch.volumeTitle, margin, margin);
        doc.setFont("times", "bold");
        doc.setFontSize(18);
      }
      
      doc.text(`Chapter ${ch.number}: ${ch.title}`, margin, margin + 15);

      doc.setFont("times", "normal");
      doc.setFontSize(10);
      const lines: string[] = doc.splitTextToSize(ch.content || "", pageWidth - margin * 2);

      let y = margin + 28;
      lines.forEach(line => {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 5.5;
      });
    });
  });

  doc.save(`${book.title}.pdf`);
}

export function exportBookAsMarkdown(book: Book) {
  let md = `# ${book.title}\n\n`;

  // Group chapters by volume
  const chaptersByVolume: { [key: number]: { title: string; chapters: typeof book.chapters } } = {};
  book.chapters.forEach(ch => {
    const volNum = ch.volumeNumber || 1;
    const volTitle = ch.volumeTitle || `Volume ${volNum}`;
    if (!chaptersByVolume[volNum]) {
      chaptersByVolume[volNum] = { title: volTitle, chapters: [] };
    }
    chaptersByVolume[volNum].chapters.push(ch);
  });

  const hasMultipleVolumes = Object.keys(chaptersByVolume).length > 1;

  Object.entries(chaptersByVolume).forEach(([volNumStr, volData]) => {
    if (hasMultipleVolumes) {
      md += `# ${volData.title}\n\n`;
    }
    volData.chapters.forEach(ch => {
      md += `## Chapter ${ch.number}: ${ch.title}\n\n${ch.content}\n\n`;
    });
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

