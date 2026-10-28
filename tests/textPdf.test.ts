import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createTextPdf } from "@/lib/workflows/text-pdf";

describe("workflow text PDF export", () => {
  it("creates a real A4 PDF for French accents and English text", async () => {
    const bytes = await createTextPdf(
      "Objet : Candidature DevOps\n\nMadame, Monsieur,\n\nÉtudiant ingénieur à Guéliz, je recherche un stage de six mois.\n\nCordialement,\nMouad MODNIBI",
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89, 1);
  });
  it("wraps long paragraphs and unbroken URLs over multiple pages", async () => {
    const bytes = await createTextPdf(
      "Application experience and project details. ".repeat(400) +
        "\n\nhttps://example.com/" +
        "a".repeat(800),
    );
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getPageCount()).toBeLessThan(20);
  });
  it("requires review instead of exporting broken redacted contact details", async () => {
    await expect(
      createTextPdf("Email: [REDACTED]@example.com"),
    ).rejects.toThrow("Review and correct");
  });
  it("rejects empty, oversized and unsupported text with actionable errors", async () => {
    await expect(createTextPdf(" \n ")).rejects.toThrow("Add some text");
    await expect(createTextPdf("a".repeat(50001))).rejects.toThrow("50,000");
    await expect(createTextPdf("Hello 🚀")).rejects.toThrow(
      "unsupported symbols",
    );
  });
});
