import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined' && 'GlobalWorkerOptions' in pdfjsLib) {
  // Use unpkg or cdnjs worker compatible with the pdfjs version
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

export function cleanDocumentText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ') // replace multiple spaces/tabs with single space
    .replace(/\n\s*\n\s*\n+/g, '\n\n') // maximum 2 consecutive newlines
    .trim();
}

export async function extractTextFromFile(file: File): Promise<{
  name: string;
  size: number;
  fileType: 'pdf' | 'docx' | 'txt' | 'md' | 'other';
  textContent: string;
}> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  let fileType: 'pdf' | 'docx' | 'txt' | 'md' | 'other' = 'other';
  let textContent = '';

  if (extension === 'txt' || file.type === 'text/plain') {
    fileType = 'txt';
    textContent = await file.text();
  } else if (extension === 'md' || extension === 'markdown') {
    fileType = 'md';
    textContent = await file.text();
  } else if (extension === 'pdf' || file.type === 'application/pdf') {
    fileType = 'pdf';
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const textPieces: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textObj = await page.getTextContent();
        const pageText = textObj.items
          // @ts-ignore
          .map((item) => item.str)
          .join(' ');
        textPieces.push(`--- Trang ${i} ---\n${pageText}`);
      }
      textContent = textPieces.join('\n\n');
    } catch (pdfErr) {
      console.warn('PDF parsing error, falling back to text read:', pdfErr);
      textContent = await file.text().catch(() => 'Không thể đọc nội dung PDF');
    }
  } else if (extension === 'docx' || extension === 'doc' || file.type.includes('word')) {
    fileType = 'docx';
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      textContent = result.value;
    } catch (docxErr) {
      console.warn('DOCX parsing error:', docxErr);
      textContent = await file.text().catch(() => 'Không thể đọc nội dung DOCX');
    }
  } else {
    // Default text fallback
    fileType = 'other';
    textContent = await file.text().catch(() => '');
  }

  const cleanedText = cleanDocumentText(textContent);

  return {
    name: file.name,
    size: file.size,
    fileType,
    textContent: cleanedText,
  };
}
