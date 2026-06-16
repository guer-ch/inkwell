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
  doc.setFontSize(20);
  doc.text("Table of Contents", margin, 30);
  doc.setFont("times", "normal");
  doc.setFontSize(11);

  let tocY = 45;
  Object.entries(chaptersByVolume).forEach(([volNumStr, volData]) => {
    if (hasMultipleVolumes) {
      if (tocY > pageHeight - 30) {
        doc.addPage();
        tocY = 30;
      }
      doc.setFont("times", "bold");
      doc.text(volData.title, margin, tocY);
      tocY += 8;
    }
    doc.setFont("times", "normal");
    volData.chapters.forEach(ch => {
      if (tocY > pageHeight - 20) {
        doc.addPage();
        tocY = 30;
      }
      doc.text(`Chapter ${ch.number}: ${ch.title}`, margin + 5, tocY);
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
      doc.setFontSize(24);
      doc.text(`Volume ${volNum}`, pageWidth / 2, 100, { align: "center" });
      doc.setFontSize(16);
      doc.text(volData.title, pageWidth / 2, 115, { align: "center" });
    }

    volData.chapters.forEach(ch => {
      doc.addPage();
      doc.setFont("times", "bold");
      doc.setFontSize(22);
      
      // Print Volume title at the top of the page if it exists
      if (ch.volumeTitle) {
        doc.setFontSize(10);
        doc.setFont("times", "italic");
        doc.text(ch.volumeTitle, margin, 20);
        doc.setFont("times", "bold");
        doc.setFontSize(22);
      }
      
      doc.text(`Chapter ${ch.number}: ${ch.title}`, margin, 35);

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

