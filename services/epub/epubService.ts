import { Paths, Directory, File } from 'expo-file-system';
import { downloadService } from '../sync/downloadService';
import { unzipEPUB, findFirstHtml, findFileInFolder, getEPUBBasePath } from './unzipService';
import { findOPFPath, parseOPFLite, getChapterPath, ParsedOPF } from './epubParserLite';
import { resolveChapterPath } from './pathResolver';
import { injectAbsolutePaths, wrapHTMLForEPUB, processEPUBChapter } from './epubPathHelper';

export interface EPUBChapter {
  id: string;
  title: string;
  href: string;
  content?: string;
}

export interface EPUBMetadata {
  title: string;
  author?: string;
  language?: string;
  publisher?: string;
  description?: string;
  coverUrl?: string;
}

export interface EPUBContent {
  metadata: EPUBMetadata;
  chapters: EPUBChapter[];
  totalPages: number;
}

export interface EPUBDisplayOptions {
  fontSize: number;
  fontFamily: string;
  backgroundColor: string;
  textColor: string;
  lineHeight: number;
  audioEnabled: boolean;
}

const DEFAULT_OPTIONS: EPUBDisplayOptions = {
  fontSize: 18,
  fontFamily: 'System',
  backgroundColor: '#FAF9F6',
  textColor: '#1F2937',
  lineHeight: 1.6,
  audioEnabled: true,
};

class EPUBService {
  private cacheDir: Directory;
  private currentContent: EPUBContent | null = null;

  constructor() {
    this.cacheDir = new Directory(Paths.cache, 'epub');
    this.ensureCacheDir();
  }

  private async ensureCacheDir(): Promise<void> {
    if (!this.cacheDir.exists) {
      await this.cacheDir.create();
    }
  }

  async loadEPUB(epubUrl: string): Promise<EPUBContent> {
    const localPath = await downloadService.downloadEPUB(epubUrl);
    
    const epubContent = await this.parseEPUB(localPath);
    this.currentContent = epubContent;
    
    return epubContent;
  }

  async loadAndExtractEPUB(epubUrl: string): Promise<{ basePath: string; htmlPath: string | null }> {
    const localPath = await downloadService.downloadEPUB(epubUrl);
    const basePath = await getEPUBBasePath(localPath);
    
    await unzipEPUB(localPath);
    const htmlPath = await findFirstHtml(basePath);
    
    return { basePath, htmlPath };
  }

  async loadEPUBWithParser(epubUrl: string): Promise<{
    parsed: ParsedOPF;
    firstChapterPath: string;
    opfDir: string;
  }> {
    const localPath = await downloadService.downloadEPUB(epubUrl);
    const basePath = await getEPUBBasePath(localPath);
    
    await unzipEPUB(localPath);
    
    const opfPath = await findOPFPath(basePath);
    const parsed = await parseOPFLite(opfPath);
    
    if (!parsed.spine.length) {
      throw new Error('No chapters found in spine');
    }
    
    const firstChapterPath = await getChapterPath(parsed, 0);
    
    return {
      parsed,
      firstChapterPath: 'file://' + firstChapterPath,
      opfDir: parsed.opfDir,
    };
  }

  getChapterPathFromSpine(parsed: ParsedOPF, index: number): string | null {
    const relativePath = parsed.spine[index];
    if (!relativePath) return null;
    return 'file://' + resolveChapterPath(parsed.opfPath, relativePath);
  }

  private async parseEPUB(localPath: string): Promise<EPUBContent> {
    const content: EPUBContent = {
      metadata: {
        title: 'Leçon',
        language: 'fr',
      },
      chapters: [],
      totalPages: 1,
    };

    const epubFile = new File(this.cacheDir, 'current.epub');
    if (!epubFile.exists) {
      const sourceFile = new File(localPath);
      if (sourceFile.exists) {
        await sourceFile.copy(epubFile);
      }
    }

    try {
      const basePath = await getEPUBBasePath(localPath);
      await unzipEPUB(localPath);
      const htmlPath = await findFirstHtml(basePath);
      
      if (htmlPath) {
        const opfPath = await findFileInFolder(basePath, (name) => 
          name.endsWith('.opf')
        );
        
        content.chapters = [
          {
            id: 'chapter-1',
            title: 'Chapitre',
            href: htmlPath.replace('file://', ''),
            content: this.getDefaultLessonContent(),
          },
        ];
      } else {
        content.chapters = [
          {
            id: 'chapter-1',
            title: 'Chapitre 1',
            href: '',
            content: this.getDefaultLessonContent(),
          },
        ];
      }
    } catch {
      content.chapters = [
        {
          id: 'chapter-1',
          title: 'Chapitre 1',
          href: '',
          content: this.getDefaultLessonContent(),
        },
      ];
    }

    return content;
  }

  private getDefaultLessonContent(): string {
    return `
      <div class="lesson-content">
        <h1>Bienvenue dans ta leçon !</h1>
        <p>Cette leçon va t'apprendre les bases du Pulaar.</p>
        
        <div class="vocabulary-section">
          <h2>📖 Vocabulaire</h2>
          
          <div class="word-card">
            <div class="pulaar-word">Jaa</div>
            <div class="translation">Oui</div>
            <button class="audio-btn" onclick="playAudio('jaa')">🔊 Écouter</button>
          </div>
          
          <div class="word-card">
            <div class="pulaar-word">Ala</div>
            <div class="translation">Non</div>
            <button class="audio-btn" onclick="playAudio('ala')">🔊 Écouter</button>
          </div>
          
          <div class="word-card">
            <div class="pulaar-word">Ndeyni</div>
            <div class="translation">Merci</div>
            <button class="audio-btn" onclick="playAudio('ndeyni')">🔊 Écouter</button>
          </div>
          
          <div class="word-card">
            <div class="pulaar-word">Baadi</div>
            <div class="translation">Au revoir</div>
            <button class="audio-btn" onclick="playAudio('baadi')">🔊 Écouter</button>
          </div>
        </div>
        
        <div class="example-section">
          <h2>💬 Exemples</h2>
          <p><strong>Jaa</strong> — Oui, je comprends.</p>
          <p><strong>Ala</strong> — Non, merci.</p>
          <p><strong>Ndeyni</strong> — Merci beaucoup !</p>
          <p><strong>Baadi</strong> — Au revoir, à bientôt !</p>
        </div>
        
        <div class="practice-section">
          <h2>✏️ Pratique</h2>
          <p>Essaie de prononcer ces mots à voix haute et écoute la correction.</p>
        </div>
      </div>
    `;
  }

  generateHTML(content: EPUBContent, options: Partial<EPUBDisplayOptions> = {}, basePath?: string): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const baseUrl = basePath ? `file://${basePath}/` : '';
    
    return `
      <!DOCTYPE html>
      <html lang="${content.metadata.language || 'fr'}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <base href="${baseUrl}">
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: ${opts.fontSize}px;
            line-height: ${opts.lineHeight};
            color: ${opts.textColor};
            background-color: ${opts.backgroundColor};
            padding: 20px;
            padding-bottom: 100px;
            -webkit-font-smoothing: antialiased;
          }
          
          h1 {
            font-size: 1.5em;
            color: #002366;
            margin-bottom: 20px;
            text-align: center;
          }
          
          h2 {
            font-size: 1.2em;
            color: #1e40af;
            margin: 25px 0 15px 0;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 8px;
          }
          
          p {
            margin-bottom: 15px;
            text-align: justify;
          }
          
          .vocabulary-section {
            background: white;
            border-radius: 16px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          }
          
          .word-card {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }
          
          .pulaar-word {
            font-size: 1.4em;
            font-weight: bold;
            color: #002366;
          }
          
          .translation {
            color: #64748b;
            font-size: 1em;
          }
          
          .audio-btn {
            background: linear-gradient(135deg, #4a90e2 0%, #3b82f6 100%);
            color: white;
            border: none;
            border-radius: 20px;
            padding: 8px 20px;
            font-size: 0.9em;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          
          .audio-btn:active {
            transform: scale(0.95);
          }
          
          .example-section {
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            border-radius: 0 12px 12px 0;
            padding: 16px;
            margin: 20px 0;
          }
          
          .practice-section {
            background: #ecfdf5;
            border-left: 4px solid #10b981;
            border-radius: 0 12px 12px 0;
            padding: 16px;
            margin: 20px 0;
            text-align: center;
          }
          
          .progress-indicator {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: #e5e7eb;
          }
          
          .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #4a90e2, #002366);
            transition: width 0.3s ease;
          }
        </style>
      </head>
      <body>
        <div class="progress-indicator">
          <div class="progress-bar" id="progressBar" style="width: 0%"></div>
        </div>
        ${content.chapters.map(ch => ch.content || '').join('')}
        <script>
          window.addEventListener('scroll', () => {
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrolled = (window.scrollY / scrollHeight) * 100;
            document.getElementById('progressBar').style.width = scrolled + '%';
          });
          
          function playAudio(wordId) {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'playAudio',
              wordId: wordId
            }));
          }
          
          document.addEventListener('DOMContentLoaded', () => {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'pageReady'
            }));
          });
        </script>
      </body>
      </html>
    `;
  }

  generateMockLessonHTML(): string {
    const mockContent: EPUBContent = {
      metadata: {
        title: 'Salutations en Pulaar',
        author: 'IPELAN',
        language: 'fr',
      },
      chapters: [
        {
          id: 'ch1',
          title: 'Les Salutations',
          href: '',
          content: this.getDefaultLessonContent(),
        },
      ],
      totalPages: 1,
    };

    return this.generateHTML(mockContent);
  }

  generateHTMLForExtractedEPUB(chapterUri: string, opfDir: string): string {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 18px;
            line-height: 1.6;
            color: #1F2937;
            background-color: #FAF9F6;
            padding: 20px;
            padding-bottom: 100px;
            -webkit-font-smoothing: antialiased;
          }
          img { max-width: 100%; height: auto; display: block; margin: 16px auto; }
          audio { width: 100%; margin: 16px 0; }
          h1, h2, h3 { color: #002366; margin: 16px 0 8px 0; }
          p { margin-bottom: 12px; }
          a { color: #4a90e2; }
        </style>
        <script>
          window.addEventListener('scroll', () => {
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrolled = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'scrollProgress',
              progress: scrolled
            }));
          });
          function playAudio(wordId) {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'playAudio',
              wordId: wordId
            }));
          }
          document.addEventListener('DOMContentLoaded', () => {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'pageReady'
            }));
          });
        </script>
      </head>
      <body>
        <div id="content">
          <p>Naviguez vers la leçon depuis le menu principal.</p>
        </div>
      </body>
      </html>
    `;
  }

  generateHTMLWithContent(htmlContent: string, opfDir: string): string {
    return processEPUBChapter(htmlContent, opfDir);
  }

  async clearCache(): Promise<void> {
    if (this.cacheDir.exists) {
      await this.cacheDir.delete();
    }
    await this.ensureCacheDir();
    this.currentContent = null;
  }

  getDisplayOptions(options: Partial<EPUBDisplayOptions> = {}): EPUBDisplayOptions {
    return { ...DEFAULT_OPTIONS, ...options };
  }
}

export const epubService = new EPUBService();
