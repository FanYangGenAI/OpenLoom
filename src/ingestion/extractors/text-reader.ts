import { readFile } from 'fs/promises';
import { extname } from 'path';

export interface TextReadResult {
  text: string;
  author?: string;      // from docx document properties
  title?: string;       // from docx document properties
}

/**
 * Read the text content of a document file.
 * - .txt / .md / .markdown: read as UTF-8 directly
 * - .docx / .doc: extract via mammoth
 */
export async function readTextContent(filePath: string): Promise<TextReadResult> {
  const ext = extname(filePath).toLowerCase();

  if (ext === '.txt' || ext === '.md' || ext === '.markdown') {
    const text = await readFile(filePath, 'utf-8');
    return { text };
  }

  if (ext === '.docx' || ext === '.doc') {
    return readDocx(filePath);
  }

  throw new Error(`Unsupported text format: ${ext}`);
}

async function readDocx(filePath: string): Promise<TextReadResult> {
  const mammoth = await import('mammoth');

  const [bodyResult, rawXml] = await Promise.all([
    mammoth.extractRawText({ path: filePath }),
    mammoth.convertToHtml({ path: filePath }).catch(() => null),
  ]);

  const text = bodyResult.value.trim();

  // Try to extract core document properties (author, title) from docx XML
  let author: string | undefined;
  let title: string | undefined;

  try {
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(filePath);
    const coreXmlEntry = zip.getEntry('docProps/core.xml');
    if (coreXmlEntry) {
      const coreXml = coreXmlEntry.getData().toString('utf-8');
      const creatorMatch = coreXml.match(/<dc:creator[^>]*>(.*?)<\/dc:creator>/);
      const titleMatch = coreXml.match(/<dc:title[^>]*>(.*?)<\/dc:title>/);
      if (creatorMatch?.[1]) author = creatorMatch[1].trim();
      if (titleMatch?.[1]) title = titleMatch[1].trim();
    }
  } catch {
    // docProps extraction is best-effort; silently skip on failure
  }

  return { text, author, title };
}
