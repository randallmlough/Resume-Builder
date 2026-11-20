import { PDFDocument } from 'pdf-lib';
import type { RecommendationLetterRecord } from '@shared/schema';

const US_LETTER_WIDTH = 612; // 8.5 in * 72 pt/in
const US_LETTER_HEIGHT = 792; // 11 in * 72 pt/in
const IMAGE_MARGIN = 28; // ~0.4 in margin around image pages

/**
 * Merges a Typst-compiled PDF with any attached letters of recommendation (PDF, PNG, or JPG)
 * in their exact user-configured order, completely client-side via pdf-lib.
 */
export async function mergePdfWithAttachments(
  basePdfBytes: Uint8Array,
  attachments: RecommendationLetterRecord[]
): Promise<Uint8Array> {
  if (attachments.length === 0) {
    return basePdfBytes;
  }

  const merged = await PDFDocument.load(basePdfBytes);

  for (const letter of attachments) {
    const res = await fetch(letter.fileUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch attached letter "${letter.title}" (${res.status})`);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());

    if (letter.mimeType === 'application/pdf') {
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const copiedPages = await merged.copyPages(srcDoc, srcDoc.getPageIndices());
      for (const page of copiedPages) {
        merged.addPage(page);
      }
    } else if (letter.mimeType === 'image/png' || letter.mimeType === 'image/jpeg') {
      const image =
        letter.mimeType === 'image/png'
          ? await merged.embedPng(bytes)
          : await merged.embedJpg(bytes);

      const page = merged.addPage([US_LETTER_WIDTH, US_LETTER_HEIGHT]);
      const maxW = US_LETTER_WIDTH - IMAGE_MARGIN * 2;
      const maxH = US_LETTER_HEIGHT - IMAGE_MARGIN * 2;
      const scale = Math.min(maxW / image.width, maxH / image.height, 1);
      const drawW = image.width * scale;
      const drawH = image.height * scale;

      page.drawImage(image, {
        x: (US_LETTER_WIDTH - drawW) / 2,
        y: (US_LETTER_HEIGHT - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    }
  }

  return merged.save();
}
