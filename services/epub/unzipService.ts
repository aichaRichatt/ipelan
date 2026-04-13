import { unzip } from 'react-native-zip-archive';
import { Paths, Directory, File } from 'expo-file-system';

const EPUB_EXTRACT_DIR = new Directory(Paths.cache, 'epub/extracted');

export async function unzipEPUB(epubPath: string): Promise<string> {
  await EPUB_EXTRACT_DIR.create();

  const targetPath = epubPath.replace('.epub', '');
  const targetDir = new Directory(targetPath);

  if (targetDir.exists) {
    await targetDir.delete();
  }

  await unzip(epubPath, targetPath);

  return targetPath;
}

export async function findFirstHtml(folderPath: string): Promise<string | null> {
  const dir = new Directory(folderPath);
  
  if (!dir.exists) return null;

  const entries = await dir.list();

  for (const entry of entries) {
    if (entry instanceof File) {
      const name = entry.name.toLowerCase();
      if (name.endsWith('.html') || name.endsWith('.xhtml')) {
        return entry.uri;
      }
    } else if (entry instanceof Directory) {
      const result = await findFirstHtml(entry.uri);
      if (result) return result;
    }
  }

  return null;
}

export async function findFileInFolder(
  folderPath: string,
  predicate: (filename: string) => boolean
): Promise<string | null> {
  const dir = new Directory(folderPath);
  
  if (!dir.exists) return null;

  const entries = await dir.list();

  for (const entry of entries) {
    if (entry instanceof File) {
      if (predicate(entry.name)) {
        return entry.uri;
      }
    } else if (entry instanceof Directory) {
      const result = await findFileInFolder(entry.uri, predicate);
      if (result) return result;
    }
  }

  return null;
}

export async function getEPUBBasePath(epubPath: string): Promise<string> {
  return epubPath.replace('.epub', '');
}
