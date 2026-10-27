import * as pdfjsLib from 'pdfjs-dist';

// Set up worker using Cloudflare CDN for reliability across environments
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  // Use official CDN worker matching version or fallback
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
}

export interface PdfExtractResult {
  title?: string;
  totalPages: number;
  pages: ExtractedPdfPage[];
  fullText: string;
}

export async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<PdfExtractResult> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pages: ExtractedPdfPage[] = [];
  const textParts: string[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    let lastY: number | null = null;
    let pageString = '';

    for (const item of textContent.items) {
      if ('str' in item) {
        // If vertical position changed substantially, insert newline for natural paragraphs
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 8) {
          pageString += '\n';
        } else if (pageString.length > 0 && !pageString.endsWith(' ') && !pageString.endsWith('\n')) {
          pageString += ' ';
        }
        pageString += item.str;
        lastY = item.transform[5];
      }
    }

    const cleanText = pageString.trim();
    pages.push({ pageNumber: pageNum, text: cleanText });
    textParts.push(`[ Page ${pageNum} ]\n\n${cleanText}`);
  }

  let title: string | undefined;
  try {
    const metadata = await pdf.getMetadata();
    if (metadata?.info && (metadata.info as any).Title && typeof (metadata.info as any).Title === 'string') {
      const docTitle = (metadata.info as any).Title.trim();
      if (docTitle.length > 0 && !docTitle.startsWith('Untitled')) {
        title = docTitle;
      }
    }
  } catch (err) {
    console.warn('Could not read PDF metadata:', err);
  }

  return {
    title,
    totalPages,
    pages,
    fullText: textParts.join('\n\n\n')
  };
}
