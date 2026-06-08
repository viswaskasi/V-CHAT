import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import * as XLSX from 'xlsx';

/**
 * Parses a base64 encoded file attachment based on its MIME type and returns the extracted text.
 * @param {string} base64Data - The raw base64 data string (prefix-stripped)
 * @param {string} mimeType - The file's MIME type
 * @returns {Promise<string>} The parsed text content of the file
 */
export const parseAttachment = async (base64Data, mimeType) => {
    if (!base64Data) return '';

    // Strip data URI prefix if it exists
    const cleanBase64 = base64Data.includes(',') 
        ? base64Data.split(',')[1] 
        : base64Data;
        
    const buffer = Buffer.from(cleanBase64, 'base64');

    try {
        // 1. Handle PDF documents
        if (mimeType === 'application/pdf') {
            const parser = new pdf.PDFParse({ data: buffer });
            const parsed = await parser.getText();
            const text = parsed.text || '';
            await parser.destroy();
            return text;
        }

        // 2. Handle Spreadsheets (XLSX, XLS, CSV)
        if (
            mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimeType === 'application/vnd.ms-excel' ||
            mimeType === 'text/csv'
        ) {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            let extractedText = '';
            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const csv = XLSX.utils.sheet_to_csv(sheet);
                extractedText += `--- Sheet: ${sheetName} ---\n${csv}\n\n`;
            });
            return extractedText;
        }

        // 3. Handle Plain Text, Code files and JSON
        if (
            mimeType.startsWith('text/') ||
            mimeType === 'application/json' ||
            mimeType === 'application/javascript' ||
            mimeType === 'application/x-javascript'
        ) {
            return buffer.toString('utf-8');
        }

        // 4. Default fallback: other binary formats (don't attempt extraction)
        return '';
    } catch (error) {
        console.error(`Error parsing file attachment of type ${mimeType}:`, error);
        return `[Error extracting text from document: ${error.message}]`;
    }
};
