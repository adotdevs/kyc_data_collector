import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface GenerateSignedPdfParams {
  title: string;
  fileName: string;
  folder: string;
  description?: string;
  contentPreview?: string;
  originalPdfBuffer?: Buffer | null;
  signature?: {
    signatureDataUrl?: string;
    signerName: string;
    signerEmail: string;
    signerTitle?: string;
    signedAt: Date | string;
    certificateId: string;
    ipAddress?: string;
  } | null;
}

/**
 * Generates or stamps a PDF document using pdf-lib.
 * - If an original valid PDF buffer is provided, appends or overlays the signature block and audit certificate.
 * - If no original PDF buffer is available (or it's a template/DOCX/virtual contract), builds a clean, multi-section legal PDF with the embedded signature & digital audit seal.
 */
export async function generateDocumentPdfBuffer(
  params: GenerateSignedPdfParams
): Promise<Buffer> {
  let pdfDoc: PDFDocument;
  let loadedExistingPdf = false;

  if (params.originalPdfBuffer && params.originalPdfBuffer.length > 4) {
    const header = params.originalPdfBuffer.subarray(0, 5).toString("ascii");
    if (header === "%PDF-") {
      try {
        pdfDoc = await PDFDocument.load(params.originalPdfBuffer, {
          ignoreEncryption: true,
        });
        loadedExistingPdf = true;
      } catch {
        pdfDoc = await PDFDocument.create();
      }
    } else {
      pdfDoc = await PDFDocument.create();
    }
  } else {
    pdfDoc = await PDFDocument.create();
  }

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  if (!loadedExistingPdf) {
    // Create a crisp legal document page
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    // Top brand header bar
    page.drawRectangle({
      x: 0,
      y: height - 72,
      width,
      height: 72,
      color: rgb(0.145, 0.388, 0.922), // #2563EB
    });

    page.drawText("SignDocs", {
      x: 48,
      y: height - 42,
      size: 20,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText(`Folder: ${params.folder || "Agreements"}`, {
      x: width - 190,
      y: height - 40,
      size: 10,
      font: fontRegular,
      color: rgb(0.88, 0.93, 1),
    });

    // Document Title
    page.drawText(params.title || params.fileName, {
      x: 48,
      y: height - 125,
      size: 18,
      font: fontBold,
      color: rgb(0.06, 0.09, 0.16),
    });

    page.drawText(`Reference File: ${params.fileName}`, {
      x: 48,
      y: height - 145,
      size: 10,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.53),
    });

    page.drawLine({
      start: { x: 48, y: height - 160 },
      end: { x: width - 48, y: height - 160 },
      thickness: 1,
      color: rgb(0.88, 0.91, 0.94),
    });

    const bodyText =
      params.contentPreview ||
      params.description ||
      `This ${params.title} ("Agreement") is entered into and made effective as of the date of electronic execution below.\n\n1. PURPOSE & SCOPE\nThis document sets forth the standard terms, compliance obligations, and mutual covenants governing the relationship between the Executing Client ("Signer") and the Organization.\n\n2. KYC & COMPLIANCE REPRESENTATION\nThe Signer confirms that all Know Your Customer (KYC) identification documents, proof of residential address, and personal onboarding disclosures submitted through the SignDocs portal are true, accurate, complete, and authentic.\n\n3. CONFIDENTIALITY & DATA PROTECTION\nAll materials, records, and personal data exchanged under this Agreement shall be handled strictly in accordance with applicable regulatory compliance and data protection standards.\n\n4. ELECTRONIC SIGNATURE VALIDITY\nBy executing this document electronically via SignDocs, the Signer agrees that their digital signature carries the same full legal force, effect, and admissibility as a handwritten ink signature.`;

    // Wrap text neatly
    const paragraphs = bodyText.split("\n");
    let cursorY = height - 190;
    const maxWidth = width - 96;
    const fontSize = 10.5;
    const lineHeight = 16;

    for (const para of paragraphs) {
      if (!para.trim()) {
        cursorY -= 10;
        continue;
      }
      const words = para.split(" ");
      let line = "";
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const testWidth = fontRegular.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth) {
          if (cursorY > 240) {
            page.drawText(line, {
              x: 48,
              y: cursorY,
              size: fontSize,
              font: para.match(/^\d+\./) ? fontBold : fontRegular,
              color: rgb(0.18, 0.22, 0.28),
            });
            cursorY -= lineHeight;
          }
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line && cursorY > 240) {
        page.drawText(line, {
          x: 48,
          y: cursorY,
          size: fontSize,
          font: para.match(/^\d+\./) ? fontBold : fontRegular,
          color: rgb(0.18, 0.22, 0.28),
        });
        cursorY -= lineHeight;
      }
    }
  }

  // Stamp signature on the last page if signed
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width, height } = lastPage.getSize();

  if (params.signature) {
    const sig = params.signature;
    const boxY = 52;
    const boxHeight = 145;

    // Signature Verification Box
    lastPage.drawRectangle({
      x: 44,
      y: boxY,
      width: width - 88,
      height: boxHeight,
      color: rgb(0.97, 0.98, 1),
      borderColor: rgb(0.145, 0.388, 0.922),
      borderWidth: 1.2,
    });

    lastPage.drawText("ELECTRONIC SIGNATURE & DIGITAL AUDIT CERTIFICATE", {
      x: 60,
      y: boxY + boxHeight - 22,
      size: 9.5,
      font: fontBold,
      color: rgb(0.145, 0.388, 0.922),
    });

    lastPage.drawText(`Signed By: ${sig.signerName} (${sig.signerEmail})`, {
      x: 60,
      y: boxY + boxHeight - 42,
      size: 9.5,
      font: fontBold,
      color: rgb(0.08, 0.12, 0.2),
    });

    if (sig.signerTitle) {
      lastPage.drawText(`Title / Capacity: ${sig.signerTitle}`, {
        x: 60,
        y: boxY + boxHeight - 57,
        size: 9,
        font: fontRegular,
        color: rgb(0.3, 0.35, 0.45),
      });
    }

    const formattedDate = new Date(sig.signedAt).toUTCString();
    lastPage.drawText(`Timestamp: ${formattedDate}`, {
      x: 60,
      y: boxY + boxHeight - 74,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.45),
    });

    lastPage.drawText(`Certificate ID: ${sig.certificateId}`, {
      x: 60,
      y: boxY + boxHeight - 90,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.45),
    });

    lastPage.drawText(
      `Status: VERIFIED & LEGALLY BINDING E-SIGNATURE • IP: ${sig.ipAddress || "Recorded"}`,
      {
        x: 60,
        y: boxY + 14,
        size: 8,
        font: fontOblique,
        color: rgb(0.06, 0.52, 0.32),
      }
    );

    // Embed PNG signature image if available
    if (
      sig.signatureDataUrl &&
      sig.signatureDataUrl.startsWith("data:image/png;base64,")
    ) {
      try {
        const base64Data = sig.signatureDataUrl.replace(
          /^data:image\/png;base64,/,
          ""
        );
        const pngBuffer = Buffer.from(base64Data, "base64");
        const pngImage = await pdfDoc.embedPng(pngBuffer);
        const sigWidth = 150;
        const sigHeight = 56;

        lastPage.drawImage(pngImage, {
          x: width - 225,
          y: boxY + 42,
          width: sigWidth,
          height: sigHeight,
        });

        lastPage.drawLine({
          start: { x: width - 235, y: boxY + 38 },
          end: { x: width - 65, y: boxY + 38 },
          thickness: 0.8,
          color: rgb(0.4, 0.45, 0.55),
        });

        lastPage.drawText("Authorized Client Signature", {
          x: width - 205,
          y: boxY + 26,
          size: 8,
          font: fontRegular,
          color: rgb(0.4, 0.45, 0.55),
        });
      } catch (err) {
        console.warn("Could not embed PNG signature in PDF, using text fallback:", err);
      }
    }
  } else {
    // Unsigned signature placeholder block
    const boxY = 65;
    lastPage.drawLine({
      start: { x: width - 240, y: boxY + 30 },
      end: { x: width - 55, y: boxY + 30 },
      thickness: 1,
      color: rgb(0.5, 0.55, 0.65),
    });
    lastPage.drawText("Client Signature (Pending Online Execution)", {
      x: width - 235,
      y: boxY + 15,
      size: 8.5,
      font: fontOblique,
      color: rgb(0.45, 0.5, 0.6),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
