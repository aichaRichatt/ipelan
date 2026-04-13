export function resolveOPFPath(opfPath: string): string {
  const stack = opfPath.split('/');
  stack.pop();
  return stack.join('/');
}

export function resolveAssetPath(opfDir: string, relativePath: string): string {
  const stack = opfDir.split('/');
  const parts = relativePath.split('/');

  for (const part of parts) {
    if (part === '..') {
      stack.pop();
    } else if (part !== '.' && part !== '') {
      stack.push(part);
    }
  }

  return stack.join('/');
}

export function resolveChapterPath(opfPath: string, chapterRelativePath: string): string {
  const opfDir = resolveOPFPath(opfPath);
  return resolveAssetPath(opfDir, chapterRelativePath);
}
