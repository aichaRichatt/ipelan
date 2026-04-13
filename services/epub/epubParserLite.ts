import { File } from 'expo-file-system';
import { DOMParser } from 'xmldom';

export interface ParsedOPF {
  spine: string[];
  opfPath: string;
  opfDir: string;
}

export async function findOPFPath(basePath: string): Promise<string> {
  const containerPath = `${basePath}/META-INF/container.xml`;
  const containerFile = new File(containerPath);

  if (!containerFile.exists) {
    throw new Error('Invalid EPUB: missing container.xml');
  }

  const xml = await containerFile.text();
  const match = xml.match(/full-path="([^"]+)"/);

  if (!match) {
    throw new Error('OPF path not found in container.xml');
  }

  return `${basePath}/${match[1]}`;
}

export async function parseOPFLite(opfPath: string): Promise<ParsedOPF> {
  const opfFile = new File(opfPath);
  
  if (!opfFile.exists) {
    throw new Error('OPF file not found: ' + opfPath);
  }

  const xml = await opfFile.text();
  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  const manifestItems = doc.getElementsByTagName('item');
  const spineItems = doc.getElementsByTagName('itemref');

  const manifestMap: Record<string, string> = {};

  for (let i = 0; i < manifestItems.length; i++) {
    const item = manifestItems[i];
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');

    if (id && href) {
      manifestMap[id] = href;
    }
  }

  const spine: string[] = [];

  for (let i = 0; i < spineItems.length; i++) {
    const item = spineItems[i];
    const idref = item.getAttribute('idref');

    if (idref && manifestMap[idref]) {
      spine.push(manifestMap[idref]);
    }
  }

  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/'));

  return {
    spine,
    opfPath,
    opfDir,
  };
}

export async function getChapterPath(parsed: ParsedOPF, index: number): Promise<string | null> {
  if (index < 0 || index >= parsed.spine.length) {
    return null;
  }

  const relativePath = parsed.spine[index];
  return `${parsed.opfDir}/${relativePath}`;
}

export async function getChapterContent(chapterPath: string): Promise<string> {
  const file = new File(chapterPath);
  
  if (!file.exists) {
    throw new Error('Chapter file not found: ' + chapterPath);
  }
  
  const content = await file.text();
  return content;
}
