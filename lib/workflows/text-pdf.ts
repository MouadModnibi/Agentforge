import { PDFDocument, StandardFonts, PageSizes, type PDFFont } from "pdf-lib";

// Text-only PDF: no HTML, links, embedded scripts, remote fonts or network calls.
export async function createTextPdf(text: string): Promise<Uint8Array> {
  const clean = text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u202f\t]/g, " ")
    .trim();
  if (!clean) throw new Error("Add some text before downloading a PDF.");
  if (clean.length > 50000)
    throw new Error("PDF export supports up to 50,000 characters.");
  if (clean.includes("[REDACTED]"))
    throw new Error("Review and correct the redacted text before downloading.");
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  try {
    normal.encodeText(clean.replace(/\n/g, " "));
  } catch {
    throw new Error(
      "This PDF font supports French and English text. Remove unsupported symbols before downloading.",
    );
  }
  pdf.setTitle("Workflow document");
  pdf.setCreator("m4m");
  const [width, height] = PageSizes.A4;
  const margin = 56,
    size = 11,
    leading = 16,
    available = width - margin * 2;
  let page = pdf.addPage(PageSizes.A4),
    y = height - 64;
  const line = (value: string, font: PDFFont) => {
    if (y < margin + leading) {
      page = pdf.addPage(PageSizes.A4);
      y = height - 64;
    }
    page.drawText(value, { x: margin, y, size, font });
    y -= leading;
  };
  for (const paragraph of clean.split(/\n\s*\n/)) {
    const font = /^(Subject|Objet)\s*:/i.test(paragraph) ? bold : normal;
    for (const sourceLine of paragraph.split("\n")) {
      let current = "";
      for (const word of sourceLine.trim().split(/ +/)) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= available) {
          current = candidate;
          continue;
        }
        if (current) {
          line(current, font);
          current = "";
        }
        // Split long URLs/identifiers rather than clipping outside the margins.
        for (const character of word) {
          if (
            current &&
            font.widthOfTextAtSize(current + character, size) > available
          ) {
            line(current, font);
            current = "";
          }
          current += character;
        }
      }
      if (current) line(current, font);
    }
    y -= 12;
  }
  return pdf.save();
}
