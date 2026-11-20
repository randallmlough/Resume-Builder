import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../public/fonts');

const WANTED = [
  // Merriweather (serif)
  {
    name: 'Merriweather-Regular.ttf',
    urls: [
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/static/Merriweather-Regular.ttf',
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/Merriweather-Regular.ttf',
      'https://raw.githubusercontent.com/SorkinType/Merriweather/master/fonts/ttf/Merriweather-Regular.ttf',
    ],
  },
  {
    name: 'Merriweather-Bold.ttf',
    urls: [
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/static/Merriweather-Bold.ttf',
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/Merriweather-Bold.ttf',
      'https://raw.githubusercontent.com/SorkinType/Merriweather/master/fonts/ttf/Merriweather-Bold.ttf',
    ],
  },
  {
    name: 'Merriweather-Italic.ttf',
    urls: [
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/static/Merriweather-Italic.ttf',
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/Merriweather-Italic.ttf',
      'https://raw.githubusercontent.com/SorkinType/Merriweather/master/fonts/ttf/Merriweather-Italic.ttf',
    ],
  },
  {
    name: 'Merriweather-BoldItalic.ttf',
    urls: [
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/static/Merriweather-BoldItalic.ttf',
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/Merriweather-BoldItalic.ttf',
      'https://raw.githubusercontent.com/SorkinType/Merriweather/master/fonts/ttf/Merriweather-BoldItalic.ttf',
    ],
  },
  // Merriweather Sans (body)
  {
    name: 'MerriweatherSans-Regular.ttf',
    urls: [
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweathersans/static/MerriweatherSans-Regular.ttf',
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweathersans/MerriweatherSans-Regular.ttf',
      'https://raw.githubusercontent.com/SorkinType/Merriweather-Sans/master/fonts/ttf/MerriweatherSans-Regular.ttf',
    ],
  },
  {
    name: 'MerriweatherSans-Bold.ttf',
    urls: [
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweathersans/static/MerriweatherSans-Bold.ttf',
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweathersans/MerriweatherSans-Bold.ttf',
      'https://raw.githubusercontent.com/SorkinType/Merriweather-Sans/master/fonts/ttf/MerriweatherSans-Bold.ttf',
    ],
  },
  {
    name: 'MerriweatherSans-Italic.ttf',
    urls: [
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweathersans/static/MerriweatherSans-Italic.ttf',
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweathersans/MerriweatherSans-Italic.ttf',
      'https://raw.githubusercontent.com/SorkinType/Merriweather-Sans/master/fonts/ttf/MerriweatherSans-Italic.ttf',
    ],
  },
  {
    name: 'MerriweatherSans-BoldItalic.ttf',
    urls: [
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweathersans/static/MerriweatherSans-BoldItalic.ttf',
      'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweathersans/MerriweatherSans-BoldItalic.ttf',
      'https://raw.githubusercontent.com/SorkinType/Merriweather-Sans/master/fonts/ttf/MerriweatherSans-BoldItalic.ttf',
    ],
  },
];

await fs.mkdir(outDir, { recursive: true });

let downloaded = 0;
for (const font of WANTED) {
  let ok = false;
  for (const url of font.urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 10000) {
          await fs.writeFile(path.join(outDir, font.name), buf);
          console.log(`Downloaded ${font.name} (${(buf.length / 1024).toFixed(1)} KB) from ${url}`);
          downloaded++;
          ok = true;
          break;
        }
      }
    } catch {
      // try next URL
    }
  }
  if (!ok) {
    console.error(`Failed to download ${font.name}`);
  }
}

console.log(`Done: ${downloaded}/${WANTED.length} fonts downloaded.`);
if (downloaded < WANTED.length) {
  process.exit(1);
}
