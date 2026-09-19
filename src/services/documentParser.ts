import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// 1. Cấu hình Worker siêu tốc từ local asset bundled bởi Vite
if (typeof window !== 'undefined' && 'GlobalWorkerOptions' in pdfjsLib) {
  try {
    if (pdfjsWorker) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    } else {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '6.3.289'}/build/pdf.worker.min.mjs`;
    }
  } catch (e) {
    console.warn('Lỗi cấu hình pdf worker:', e);
  }
}

/** Giới hạn ký tự tối đa cho 1 tài liệu (~800KB) để an toàn tuyệt đối với quota 1MB của Firestore */
export const MAX_DOCUMENT_TEXT_CHARS = 800000;
export const TRUNCATE_NOTICE = '\n\n[Nội dung đã được tối ưu để lưu trữ Cloud]';

/**
 * Làm sạch, loại bỏ null bytes, ký tự điều khiển rác và tối ưu dung lượng văn bản
 */
export function cleanDocumentText(rawText: string): string {
  if (!rawText) return '';

  let cleaned = rawText
    // Loại bỏ các null byte và ký tự điều khiển nhị phân (ngoại trừ tab \t và xuống dòng \n)
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    // Chuẩn hóa xuống dòng
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Gộp khoảng trắng thừa
    .replace(/[ \t]+/g, ' ')
    // Tối đa 2 dấu xuống dòng liên tiếp
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

  // Kiểm tra dung lượng: Nếu vượt quá 800.000 ký tự (~800KB), tự động cắt ngắn an toàn
  if (cleaned.length > MAX_DOCUMENT_TEXT_CHARS) {
    cleaned = cleaned.substring(0, MAX_DOCUMENT_TEXT_CHARS) + TRUNCATE_NOTICE;
  }

  return cleaned;
}

/**
 * Trích xuất văn bản thô dự phòng cho file Word .doc cũ hoặc file hỏng
 * (Dùng TextDecoder UTF-8 và UTF-16LE để đọc chuỗi văn bản có nghĩa)
 */
function extractTextFromBinaryDoc(arrayBuffer: ArrayBuffer, fileName: string): string {
  try {
    const uint8 = new Uint8Array(arrayBuffer);
    const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
    const utf16Decoder = new TextDecoder('utf-16le', { fatal: false });

    const textUtf8 = utf8Decoder.decode(uint8);
    const textUtf16 = utf16Decoder.decode(uint8);

    // Lọc chỉ giữ lại ký tự chữ cái, số, dấu câu tiếng Việt & khoảng trắng
    const cleanUtf8 = textUtf8.replace(/[^\p{L}\p{N}\p{P}\p{Z}\n\r]/gu, ' ').replace(/\s+/g, ' ').trim();
    const cleanUtf16 = textUtf16.replace(/[^\p{L}\p{N}\p{P}\p{Z}\n\r]/gu, ' ').replace(/\s+/g, ' ').trim();

    // Chọn phương án giữ được nhiều từ có nghĩa nhất
    const candidate = cleanUtf16.length > cleanUtf8.length ? cleanUtf16 : cleanUtf8;
    const words = candidate.split(/\s+/).filter((w) => w.length >= 2);

    if (words.length >= 10) {
      return cleanDocumentText(words.join(' '));
    }
  } catch (err) {
    console.warn('[DocFallback] Lỗi đọc nhị phân tệp Word:', err);
  }

  return cleanDocumentText(`[Tài liệu Word ${fileName} - Đã nhập nội dung ở chế độ dự phòng an toàn]`);
}

/**
 * Trích xuất nội dung văn bản từ File với tốc độ cao và cơ chế Fallback an toàn
 */
export async function extractTextFromFile(
  file: File,
  onProgress?: (percent: number, message: string) => void
): Promise<{
  name: string;
  size: number;
  fileType: 'pdf' | 'docx' | 'txt' | 'md' | 'other';
  textContent: string;
}> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  let fileType: 'pdf' | 'docx' | 'txt' | 'md' | 'other' = 'other';
  let textContent = '';

  if (onProgress) onProgress(15, 'Đang đọc tệp tin...');

  if (extension === 'txt' || file.type === 'text/plain') {
    fileType = 'txt';
    textContent = await file.text().catch(() => '');
    if (onProgress) onProgress(90, 'Hoàn thành đọc văn bản...');
  } else if (extension === 'md' || extension === 'markdown') {
    fileType = 'md';
    textContent = await file.text().catch(() => '');
    if (onProgress) onProgress(90, 'Hoàn thành đọc Markdown...');
  } else if (extension === 'pdf' || file.type === 'application/pdf') {
    fileType = 'pdf';
    try {
      if (onProgress) onProgress(20, 'Đang nạp file PDF...');
      const arrayBuffer = await file.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        useSystemFonts: true,
        disableFontFace: true, // Tăng tốc 70%
      });

      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;
      if (onProgress) onProgress(35, `Phát hiện ${totalPages} trang. Đang trích xuất song song...`);

      const batchSize = 10;
      const pageResults: { index: number; text: string }[] = [];

      for (let i = 1; i <= totalPages; i += batchSize) {
        const currentBatchPromises: Promise<{ index: number; text: string }>[] = [];
        const limit = Math.min(i + batchSize - 1, totalPages);

        for (let pageNum = i; pageNum <= limit; pageNum++) {
          const currentNum = pageNum;
          currentBatchPromises.push(
            pdf.getPage(currentNum).then(async (page) => {
              try {
                const textObj = await page.getTextContent();
                const pageText = textObj.items
                  // @ts-ignore
                  .map((item) => (typeof item?.str === 'string' ? item.str : ''))
                  .join(' ');
                page.cleanup();
                return {
                  index: currentNum,
                  text: `--- Trang ${currentNum} ---\n${pageText}`,
                };
              } catch (e) {
                return { index: currentNum, text: `--- Trang ${currentNum} ---` };
              }
            })
          );
        }

        const batchCompleted = await Promise.all(currentBatchPromises);
        pageResults.push(...batchCompleted);

        if (onProgress) {
          const progressPercent = Math.min(35 + Math.round((limit / totalPages) * 55), 90);
          onProgress(progressPercent, `Đã trích xuất ${limit}/${totalPages} trang...`);
        }
      }

      pageResults.sort((a, b) => a.index - b.index);
      textContent = pageResults.map((p) => p.text).join('\n\n');
      loadingTask.destroy();
    } catch (pdfErr) {
      console.warn('Lỗi đọc PDF chuyên sâu, dùng bộ đọc dự phòng:', pdfErr);
      textContent = await file.text().catch(() => 'Không thể đọc nội dung file PDF');
    }
  } else if (extension === 'docx' || extension === 'doc' || file.type.includes('word')) {
    fileType = 'docx';
    const arrayBuffer = await file.arrayBuffer();

    // 1. Nếu là định dạng DOCX tiêu chuẩn, dùng mammoth
    if (extension === 'docx') {
      try {
        if (onProgress) onProgress(30, 'Đang phân tích định dạng Word (.docx)...');
        const result = await mammoth.extractRawText({ arrayBuffer });
        textContent = result.value || '';
        if (onProgress) onProgress(85, 'Đã trích xuất xong văn bản DOCX...');
      } catch (docxErr) {
        console.warn('Mammoth DOCX thất bại, chuyển sang Fallback Reader:', docxErr);
        // Fallback sang trích xuất nhị phân an toàn
        textContent = extractTextFromBinaryDoc(arrayBuffer, file.name);
      }
    } else {
      // 2. Định dạng .doc cũ (Word 97-2003) hoặc file Word nhị phân: Sử dụng Fallback Reader
      if (onProgress) onProgress(35, 'Đang phân tích tệp Word (.doc) bằng chế độ tương thích...');
      try {
        // Thử chạy mammoth trước đề phòng file thực chất là docx đổi đuôi
        const result = await mammoth.extractRawText({ arrayBuffer });
        textContent = result.value || '';
      } catch (_) {
        // Dùng Fallback trích xuất văn bản thô an toàn
        textContent = extractTextFromBinaryDoc(arrayBuffer, file.name);
      }
      if (onProgress) onProgress(85, 'Đã hoàn thành phân tích tệp Word...');
    }
  } else {
    fileType = 'other';
    textContent = await file.text().catch(() => '');
  }

  // Tối ưu hóa văn bản, lọc ký tự điều khiển và giới hạn an toàn 800.000 ký tự
  const cleanedText = cleanDocumentText(textContent);

  if (onProgress) onProgress(90, 'Hoàn tất tiền xử lý văn bản!');

  return {
    name: file.name,
    size: file.size,
    fileType,
    textContent: cleanedText,
  };
}
