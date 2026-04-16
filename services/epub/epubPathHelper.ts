export function injectAbsolutePaths(html: string, baseDir: string): string {
  const fixPath = (relativePath: string): string => {
    if (!relativePath) return relativePath;
    if (relativePath.startsWith('http') || relativePath.startsWith('data:')) {
      return relativePath;
    }
    const cleaned = relativePath.replace(/^(\.\/|\.\.\/)+/, '');
    return `file://${baseDir}/${cleaned}`;
  };

  let result = html;

  result = result.replace(/<img([^>]+)src="([^"]+)"/gi, (match, attrs, src) => {
    return `<img${attrs}src="${fixPath(src)}"`;
  });

  result = result.replace(/<link([^>]+)href="([^"]+\.css)"/gi, (match, attrs, href) => {
    return `<link${attrs}href="${fixPath(href)}"`;
  });

  result = result.replace(/<audio([^>]*)src="([^"]+)"/gi, (match, attrs, src) => {
    return `<audio${attrs}src="${fixPath(src)}"`;
  });

  result = result.replace(/<source([^>]+)src="([^"]+)"/gi, (match, attrs, src) => {
    return `<source${attrs}src="${fixPath(src)}"`;
  });

  result = result.replace(/style="([^"]*)background[\s-]*:[\s]*url\(['"]?([^'")]+)['"]?\)/gi, (match, existingStyle, url) => {
    const fixedUrl = fixPath(url);
    return `style="${existingStyle}background: url('${fixedUrl}')`;
  });

  result = result.replace(/background-image:\s*url\(['"]?([^'")]+)['"]?/gi, (match, url) => {
    return `background-image: url('${fixPath(url)}')`;
  });

  return result;
}

export function wrapHTMLForEPUB(content: string, baseDir?: string): string {
  const baseUrl = baseDir ? `file://${baseDir}/` : '';

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
      ${baseDir ? `<base href="${baseUrl}">` : ''}
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 18px;
          line-height: 1.6;
          color: #1F2937;
          background-color: #FAF9F6;
          padding: 16px;
          padding-bottom: 100px;
          -webkit-font-smoothing: antialiased;
        }
        img { max-width: 100%; height: auto; display: block; margin: 12px auto; border-radius: 8px; }
        audio { width: 100%; margin: 12px 0; display: block; }
        video { max-width: 100%; height: auto; display: block; margin: 12px auto; }
        h1, h2, h3 { color: #002366; margin: 16px 0 12px 0; }
        h1 { font-size: 1.5em; text-align: center; }
        h2 { font-size: 1.2em; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
        p { margin-bottom: 12px; text-align: justify; }
        a { color: #4a90e2; }
        ul, ol { margin: 12px 0; padding-left: 24px; }
        li { margin-bottom: 8px; }
        blockquote { 
          background: #f8fafc; 
          border-left: 4px solid #4a90e2; 
          padding: 12px 16px; 
          margin: 16px 0; 
          border-radius: 0 8px 8px 0;
        }
        .vocab-card {
          background: white;
          border-radius: 12px;
          padding: 16px;
          margin: 12px 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border-left: 4px solid #4a90e2;
        }
      </style>
      <script>
        document.addEventListener('DOMContentLoaded', () => {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'pageReady'
          }));
        });
        
        window.addEventListener('scroll', () => {
          const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
          const scrolled = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'scrollProgress',
            progress: scrolled
          }));
        });

        document.querySelectorAll('audio').forEach(audio => {
          audio.addEventListener('play', (e) => {
            e.preventDefault();
            const src = audio.currentSrc || audio.src;
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'AUDIO_PLAY',
              src: src
            }));
          });
        });

        document.querySelectorAll('[onclick]').forEach(el => {
          if (el.getAttribute('onclick')?.includes('playAudio')) {
            el.addEventListener('click', (e) => {
              e.preventDefault();
              const onclick = el.getAttribute('onclick') || '';
              const match = onclick.match(/playAudio\s*\(\s*['"]([^'"]+)['"]\s*\)/);
              if (match) {
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'AUDIO_PLAY',
                  wordId: match[1]
                }));
              }
            });
          }
        });
      </script>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `;
}

export function processEPUBChapter(html: string, opfDir: string): string {
  const processed = injectAbsolutePaths(html, opfDir);
  return wrapHTMLForEPUB(processed, opfDir);
}
