#!/usr/bin/env node
/**
 * Create a minimal test EPUB for offline testing
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../assets/storage/books/test_mini.epub');
const EXTRACT_DIR = path.join(__dirname, '../extracted_epub/test_mini');

// Clean up
if (fs.existsSync(OUTPUT_DIR)) fs.unlinkSync(OUTPUT_DIR);
if (fs.existsSync(EXTRACT_DIR)) {
  fs.rmSync(EXTRACT_DIR, { recursive: true });
}

// Create minimal EPUB structure
fs.mkdirSync(EXTRACT_DIR, { recursive: true });

// mimetype
fs.writeFileSync(path.join(EXTRACT_DIR, 'mimetype'), 'application/epub+zip');

// META-INF/container.xml
fs.mkdirSync(path.join(EXTRACT_DIR, 'META-INF'));
fs.writeFileSync(path.join(EXTRACT_DIR, 'META-INF/container.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

// OEBPS/content.opf
fs.mkdirSync(path.join(EXTRACT_DIR, 'OEBPS'));
fs.mkdirSync(path.join(EXTRACT_DIR, 'OEBPS/Text'));
fs.mkdirSync(path.join(EXTRACT_DIR, 'OEBPS/Images'));
fs.mkdirSync(path.join(EXTRACT_DIR, 'OEBPS/Audio'));
fs.mkdirSync(path.join(EXTRACT_DIR, 'OEBPS/Styles'));

fs.writeFileSync(path.join(EXTRACT_DIR, 'OEBPS/content.opf'), `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test IPELAN - Pulaar</dc:title>
    <dc:language>fr</dc:language>
    <dc:identifier id="uid">test-ipelan-001</dc:identifier>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter1" href="Text/chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="Text/chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="Styles/style.css" media-type="text/css"/>
    <item id="cover" href="Images/cover.png" media-type="image/png" properties="cover-image"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
  </spine>
</package>`);

// nav.xhtml (navigation)
fs.writeFileSync(path.join(EXTRACT_DIR, 'OEBPS/nav.xhtml'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
  <nav epub:type="toc"><h1>Table des matières</h1>
    <ol><li><a href="Text/chapter1.xhtml">Chapitre 1 - Salutations</a></li>
        <li><a href="Text/chapter2.xhtml">Chapitre 2 - Nombres</a></li></ol>
  </nav>
</body>
</html>`);

// Chapter 1
fs.writeFileSync(path.join(EXTRACT_DIR, 'OEBPS/Text/chapter1.xhtml'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <link rel="stylesheet" type="text/css" href="../Styles/style.css"/>
  <title>Chapitre 1 - Salutations</title>
</head>
<body>
  <h1>🎓 Chapitre 1: Les Salutations en Pulaar</h1>
  
  <p>Bienvenue dans ta première leçon de Pulaar ! Découvre les salutations de base.</p>
  
  <h2>📚 Vocabulaire</h2>
  
  <div class="word-card">
    <span class="pulaar">Min ka dere?</span>
    <span class="french">Comment allez-vous?</span>
    <button class="audio-btn" onclick="playAudio('salut1')">🔊 Écouter</button>
  </div>
  
  <div class="word-card">
    <span class="pulaar">Mii njax</span>
    <span class="french">Je vais bien</span>
    <button class="audio-btn" onclick="playAudio('salut2')">🔊 Écouter</button>
  </div>
  
  <div class="word-card">
    <span class="pulaar">Baani</span>
    <span class="french">Au revoir</span>
    <button class="audio-btn" onclick="playAudio('salut3')">🔊 Écouter</button>
  </div>
  
  <h2>💬 Dialogue</h2>
  <p><strong>A:</strong> Min ka dere? (Comment allez-vous?)</p>
  <p><strong>B:</strong> Mii njax, nde yii? (Je vais bien, et toi?)</p>
  
  <h2>✏️ Exercice</h2>
  <p>Essaie de prononcer ces mots à voix haute !</p>
  
  <div class="nav-buttons">
    <button onclick="window.location.href='chapter2.xhtml'">Suivant →</button>
  </div>
</body>
</html>`);

// Chapter 2
fs.writeFileSync(path.join(EXTRACT_DIR, 'OEBPS/Text/chapter2.xhtml'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <link rel="stylesheet" type="text/css" href="../Styles/style.css"/>
  <title>Chapitre 2 - Nombres</title>
</head>
<body>
  <h1>🔢 Chapitre 2: Les Nombres en Pulaar</h1>
  
  <h2>📚 Les chiffres</h2>
  
  <div class="word-card">
    <span class="pulaar">Go'o</span>
    <span class="french">1 (un)</span>
  </div>
  
  <div class="word-card">
    <span class="pulaar">Diidi</span>
    <span class="french">2 (deux)</span>
  </div>
  
  <div class="word-card">
    <span class="pulaar">Tati</span>
    <span class="french">3 (trois)</span>
  </div>
  
  <div class="word-card">
    <span class="pulaar">Nayi</span>
    <span class="french">4 (quatre)</span>
  </div>
  
  <div class="word-card">
    <span class="pulaar">Jowi</span>
    <span class="french">5 (cinq)</span>
  </div>
  
  <div class="nav-buttons">
    <button onclick="window.location.href='chapter1.xhtml'">← Précédent</button>
  </div>
</body>
</html>`);

// CSS
fs.writeFileSync(path.join(EXTRACT_DIR, 'OEBPS/Styles/style.css'), `
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 18px;
  line-height: 1.6;
  color: #1F2937;
  background-color: #FAF9F6;
  padding: 20px;
  margin: 0;
}
h1 { color: #002366; font-size: 1.8em; margin-bottom: 20px; text-align: center; }
h2 { color: #1e40af; margin-top: 25px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
.word-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin: 12px 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.pulaar { font-size: 1.4em; font-weight: bold; color: #002366; }
.french { color: #64748b; }
.audio-btn {
  background: linear-gradient(135deg, #4a90e2, #3b82f6);
  color: white;
  border: none;
  border-radius: 20px;
  padding: 8px 20px;
  cursor: pointer;
}
.nav-buttons { display: flex; justify-content: center; margin-top: 30px; }
.nav-buttons button {
  background: #002366;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
}
`);

// Create a placeholder cover image (1x1 PNG = ~70 bytes)
const pngHeader = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,0,0,0,12,73,68,65,84,8,215,99,100,136,0,0,0,2,0,1,237,121,253,0,0,0,13,73,69,78,68,174,66,96,130,0,0,0,0,73,69,78,68,174,66,96,130]);
fs.writeFileSync(path.join(EXTRACT_DIR, 'OEBPS/Images/cover.png'), pngHeader);

console.log('✅ Mini EPUB created at:', OUTPUT_DIR);
console.log('📁 Also extracted to:', EXTRACT_DIR);
