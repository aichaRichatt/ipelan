import pako from 'pako';
import { EpubChapter, EpubManifest } from './contentLoader';

const IS_DEV = process.env.NODE_ENV === "development";

export interface ParsedEpub {
  manifest: EpubManifest;
  contentMap: Map<string, string>;
  mediaMap: Map<string, string>;
}

export interface TocItem {
  title: string;
  href: string;
  level: number;
}

export function parseEpub(buffer: ArrayBuffer): ParsedEpub | null {
  try {
    if (IS_DEV) console.log('[EpubParser] Starting EPUB parse, size:', buffer.byteLength);

    const uint8Array = new Uint8Array(buffer);

    const containerXml = extractFileFromZip(uint8Array, 'META-INF/container.xml');
    if (!containerXml) {
      if (IS_DEV) console.warn('[EpubParser] No container.xml found');
      return null;
    }

    const rootfilePath = extractRootfilePath(containerXml);
    if (!rootfilePath) {
      if (IS_DEV) console.warn('[EpubParser] No rootfile path found');
      return null;
    }

    if (IS_DEV) console.log('[EpubParser] Rootfile path:', rootfilePath);

    const opfContent = extractFileFromZip(uint8Array, rootfilePath);
    if (!opfContent) {
      if (IS_DEV) console.warn('[EpubParser] No OPF file found');
      return null;
    }

    const opfDir = rootfilePath.includes('/')
      ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1)
      : '';

    const manifest = parseOpfManifest(opfContent, opfDir);
    if (!manifest) {
      if (IS_DEV) console.warn('[EpubParser] Failed to parse OPF');
      return null;
    }

    if (IS_DEV) {
      console.log('[EpubParser] Parsed manifest:', manifest.title);
      console.log('[EpubParser] Chapters:', manifest.chapters.length);
      console.log('[EpubParser] Media files:', Object.keys(manifest.mediaFiles).length);
    }

    const contentMap = new Map<string, string>();
    const mediaMap = new Map<string, string>();

    for (const [id, href] of Object.entries(manifest.mediaFiles)) {
      const content = extractFileFromZip(uint8Array, href);

      if (content) {
        const isHtml = href.match(/\.(html?|xhtml)$/i);
        const isMedia = href.match(/\.(jpg|jpeg|png|gif|svg|mp3|wav|ogg|m4a)$/i);

        if (isHtml) {
          contentMap.set(href, decodeUtf8(content));
        } else if (isMedia) {
          mediaMap.set(href, arrayBufferToBase64(content, getMimeType(href)));
        }
      }
    }

    if (IS_DEV) console.log('[EpubParser] Content files loaded:', contentMap.size);
    if (IS_DEV) console.log('[EpubParser] Media files loaded:', mediaMap.size);

    return { manifest, contentMap, mediaMap };
  } catch (err) {
    if (IS_DEV) console.error('[EpubParser] Parse error:', err);
    return null;
  }
}

function extractRootfilePath(containerXml: string): string | null {
  const rootfileMatch = containerXml.match(/rootfile[^>]*full-path=["']([^"']+)["']/i);
  if (rootfileMatch) {
    return rootfileMatch[1];
  }

  const rootfileMatch2 = containerXml.match(/<rootfile\s+[^>]*>/i);
  if (rootfileMatch2) {
    const fullPathMatch = rootfileMatch2[0].match(/full-path=["']([^"']+)["']/i);
    if (fullPathMatch) {
      return fullPathMatch[1];
    }
  }

  return null;
}

export function parseOpfManifest(opfContent: string, baseDir: string): EpubManifest | null {
  try {
    const manifest: EpubManifest = {
      title: 'EPUB',
      chapters: [],
      mediaFiles: {},
    };

    const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i) ||
      opfContent.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      manifest.title = decodeXmlEntities(titleMatch[1].trim());
    }

    const authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
    if (authorMatch) {
      manifest.author = decodeXmlEntities(authorMatch[1].trim());
    }

    const langMatch = opfContent.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/i);
    if (langMatch) {
      manifest.language = langMatch[1].trim();
    }

    const manifestMatches = opfContent.match(/<manifest>([\s\S]*?)<\/manifest>/i);
    if (!manifestMatches) return manifest;

    const manifestContent = manifestMatches[1];
    const itemMatches = manifestContent.match(/<item\s+[^>]*>/gi) || [];

    const spineMatches = opfContent.match(/<spine[^>]*>([\s\S]*?)<\/spine>/i);
    const spineContent = spineMatches ? spineMatches[1] : '';
    const itemrefMatches = spineContent.match(/<itemref[^>]*>/gi) || [];

    const idToHref: Record<string, string> = {};
    const idToMediaType: Record<string, string> = {};

    for (const item of itemMatches) {
      const idMatch = item.match(/id=["']([^"']+)["']/i);
      const hrefMatch = item.match(/href=["']([^"']+)["']/i);
      const mediaMatch = item.match(/media-type=["']([^"']+)["']/i);

      if (idMatch && hrefMatch) {
        const id = idMatch[1];
        const href = baseDir + hrefMatch[1];
        const mediaType = mediaMatch ? mediaMatch[1] : '';

        idToHref[id] = href;
        idToMediaType[id] = mediaType;
        manifest.mediaFiles[id] = href;
      }
    }

    const chapters: EpubChapter[] = [];
    let order = 0;

    for (const itemref of itemrefMatches) {
      const idrefMatch = itemref.match(/idref=["']([^"']+)["']/i);
      if (idrefMatch) {
        const id = idrefMatch[1];
        const href = idToHref[id];
        const mediaType = idToMediaType[id];

        if (href && (mediaType.includes('html') || mediaType.includes('xml') || mediaType === 'application/xhtml+xml')) {
          chapters.push({
            id,
            title: getChapterTitleFromHref(href, order),
            href,
            order: order++,
          });
        }
      }
    }

    if (chapters.length === 0) {
      for (const [id, href] of Object.entries(idToHref)) {
        const mediaType = idToMediaType[id];
        if (href.match(/\.(html?|xhtml)$/i)) {
          chapters.push({
            id,
            title: getChapterTitleFromHref(href, order),
            href,
            order: order++,
          });
        }
      }
    }

    manifest.chapters = chapters;

    const coverItem = itemMatches.find(item =>
      item.includes('cover') && item.includes('properties="cover-image"') ||
      item.match(/id=["'][^"']*cover[^"']*["']/i)
    );

    if (coverItem) {
      const hrefMatch = coverItem.match(/href=["']([^"']+)["']/i);
      if (hrefMatch) {
        manifest.coverImage = baseDir + hrefMatch[1];
      }
    }

    return manifest;
  } catch (err) {
    if (IS_DEV) console.error('[EpubParser] OPF parse error:', err);
    return null;
  }
}

function getChapterTitleFromHref(href: string, index: number): string {
  const filename = href.split('/').pop() || '';
  const title = filename.replace(/\.(html?|xhtml)$/i, '').replace(/[-_]/g, ' ');

  if (title && title.length > 0) {
    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  return `Chapitre ${index + 1}`;
}

function extractFileFromZip(uint8Array: Uint8Array, filename: string): string | null {
  const filenameLower = filename.toLowerCase();

  let offset = 0;
  const entries: { name: string; offset: number; size: number }[] = [];

  const signature = readUint32LE(uint8Array, offset);
  if (signature !== 0x04034b50) {
    return null;
  }

  offset = 0;
  while (offset < uint8Array.length) {
    const sig = readUint32LE(uint8Array, offset);

    if (sig === 0x04034b50) {
      const nameLen = readUint16LE(uint8Array, offset + 26);
      const extraLen = readUint16LE(uint8Array, offset + 28);
      const compSize = readUint32LE(uint8Array, offset + 18);
      const uncompSize = readUint32LE(uint8Array, offset + 22);

      const nameBytes = uint8Array.slice(offset + 30, offset + 30 + nameLen);
      const name = Array.from(nameBytes).map(b => String.fromCharCode(b)).join('');

      const dataOffset = offset + 30 + nameLen + extraLen;

      entries.push({
        name: name.toLowerCase(),
        offset: dataOffset,
        size: uncompSize > 0 ? uncompSize : compSize,
      });

      offset = dataOffset + compSize;
    } else if (sig === 0x02014b50 || sig === 0x06054b50) {
      break;
    } else {
      offset++;
    }
  }

  const entry = entries.find(e => e.name === filenameLower);
  if (!entry) {
    const partialMatch = entries.find(e => filenameLower.endsWith(e.name) || e.name.endsWith(filenameLower.split('/').pop() || ''));
    if (partialMatch) {
      return decompressData(uint8Array.slice(partialMatch.offset, partialMatch.offset + partialMatch.size), partialMatch.size);
    }
    return null;
  }

  return decompressData(uint8Array.slice(entry.offset, entry.offset + entry.size), entry.size);
}

function extractFileBinaryFromZip(uint8Array: Uint8Array, filename: string): Uint8Array | null {
  const filenameLower = filename.toLowerCase();

  let offset = 0;
  while (offset < uint8Array.length) {
    const sig = readUint32LE(uint8Array, offset);

    if (sig === 0x04034b50) {
      const nameLen = readUint16LE(uint8Array, offset + 26);
      const extraLen = readUint16LE(uint8Array, offset + 28);
      const compSize = readUint32LE(uint8Array, offset + 18);
      const compMethod = readUint16LE(uint8Array, offset + 8);

      const nameBytes = uint8Array.slice(offset + 30, offset + 30 + nameLen);
      const name = Array.from(nameBytes).map(b => String.fromCharCode(b)).join('');

      const dataOffset = offset + 30 + nameLen + extraLen;

      if (name.toLowerCase() === filenameLower) {
        if (compMethod === 0) {
          return uint8Array.slice(dataOffset, dataOffset + compSize);
        } else if (compMethod === 8) {
          const compressed = uint8Array.slice(dataOffset, dataOffset + compSize);
          return decompressDeflate(compressed, compSize);
        }
      }

      offset = dataOffset + compSize;
    } else if (sig === 0x02014b50 || sig === 0x06054b50) {
      break;
    } else {
      offset++;
    }
  }

  return null;
}

function decompressData(data: Uint8Array, expectedSize: number): string | null {
  if (data.length === 0) return '';

  const firstByte = data[0];
  const secondByte = data[1];

  if (firstByte === 0x1f && secondByte === 0x8b) {
    return null;
  }

  if (firstByte === 0x78) {
    try {
      const decompressed = decompressDeflate(data, expectedSize);
      if (decompressed) {
        return decodeUtf8(decompressed);
      }
    } catch {
    }
  }

  return decodeUtf8(data);
}

function decompressDeflate(data: Uint8Array, expectedSize: number): Uint8Array | null {
  try {
    const decompressed = pako.inflate(data);
    return new Uint8Array(decompressed);
  } catch {
    return null;
  }
}

function readUint16LE(buffer: Uint8Array, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8);
}

function readUint32LE(buffer: Uint8Array, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
}

function decodeUtf8(buffer: Uint8Array | string): string {
  if (typeof buffer === 'string') return buffer;

  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  } catch {
    return Array.from(buffer).map(b => String.fromCharCode(b)).join('');
  }
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'm4a': 'audio/mp4',
    'html': 'text/html',
    'xhtml': 'application/xhtml+xml',
    'css': 'text/css',
    'js': 'application/javascript',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

function arrayBufferToBase64(buffer: string | Uint8Array, mimeType: string): string {
  let binary = '';
  if (typeof buffer === 'string') {
    binary = buffer;
  } else {
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export function processEpubHtml(
  html: string,
  mediaMap: Map<string, string>,
  baseHref: string
): string {
  let processed = html;

  processed = processed.replace(
    /<img([^>]*?)src=["']([^"']*)["']([^>]*)>/gi,
    (match, before, src, after) => {
      const mediaId = findMediaByHref(src, Array.from(mediaMap.keys()));
      if (mediaId && mediaMap.has(mediaId)) {
        return `<img${before}src="${mediaMap.get(mediaId)}"${after}>`;
      }
      return match;
    }
  );

  processed = processed.replace(
    /<(audio|video)([^>]*)>/gi,
    (match, tag, attrs) => {
      let newAttrs = attrs;

      newAttrs = newAttrs.replace(
        /src=["']([^"']*)["']/gi,
        (m: string, src: string) => {
          const mediaId = findMediaByHref(src, Array.from(mediaMap.keys()));
          if (mediaId && mediaMap.has(mediaId)) {
            return `src="${mediaMap.get(mediaId)}"`;
          }
          return m;
        }
      );

      return `<${tag}${newAttrs} controls>`;
    }
  );

  return processed;
}

function findMediaByHref(href: string, mediaKeys: string[]): string | null {
  const normalizedHref = href.replace(/^\.\//, '').replace(/\.\.\//g, '');

  for (const key of mediaKeys) {
    if (key.includes(normalizedHref) || normalizedHref.includes(key.split('/').pop() || '')) {
      return key;
    }
  }

  return null;
}

export function extractAudioFromEpub(parsed: ParsedEpub): { href: string; dataUrl: string; title: string }[] {
  const audioFiles: { href: string; dataUrl: string; title: string }[] = [];

  for (const [href, dataUrl] of parsed.mediaMap) {
    if (href.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      const filename = href.split('/').pop() || 'audio';
      audioFiles.push({
        href,
        dataUrl,
        title: filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      });
    }
  }

  return audioFiles;
}

export function extractImagesFromEpub(parsed: ParsedEpub): { href: string; dataUrl: string }[] {
  const images: { href: string; dataUrl: string }[] = [];

  for (const [href, dataUrl] of parsed.mediaMap) {
    if (href.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
      images.push({ href, dataUrl });
    }
  }

  return images;
}
