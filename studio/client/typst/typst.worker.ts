/// <reference lib="webworker" />
import {
  createTypstCompiler,
  createTypstRenderer,
  loadFonts,
  type TypstCompiler,
  type TypstRenderer,
} from '@myriaddreamin/typst.ts';
import { CompileFormatEnum } from '@myriaddreamin/typst.ts/dist/esm/compiler.mjs';
import compilerWasmUrl from '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url';
import rendererWasmUrl from '@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url';
import singleColumnTemplate from '../../templates/single-column.typ?raw';
import coverLetterTemplate from '../../templates/cover-letter.typ?raw';

const FONT_FILES = [
  'Merriweather-Regular.ttf',
  'Merriweather-Bold.ttf',
  'Merriweather-Italic.ttf',
  'Merriweather-BoldItalic.ttf',
  'MerriweatherSans-Regular.ttf',
  'MerriweatherSans-Bold.ttf',
  'MerriweatherSans-Italic.ttf',
  'MerriweatherSans-BoldItalic.ttf',
];

export interface WorkerCompileRequest {
  id: number;
  type: 'render-svg' | 'compile-pdf';
  mode: 'resume' | 'cover-letter';
  resumeJson: string;
  configJson: string;
  coverLetterTypst?: string;
}

export interface PageMeta {
  pageOffset: number;
  width: number;
  height: number;
}

export type WorkerResponse =
  | { type: 'ready'; initMs: number }
  | {
      id: number;
      type: 'svg-result';
      svg: string;
      pages: PageMeta[];
      compileMs: number;
      diagnostics: string[];
    }
  | {
      id: number;
      type: 'pdf-result';
      pdf: Uint8Array;
      compileMs: number;
    }
  | {
      id: number;
      type: 'error';
      message: string;
      diagnostics?: string[];
    };

let compiler: TypstCompiler | null = null;
let renderer: TypstRenderer | null = null;
let initPromise: Promise<void> | null = null;

async function ensureInitialized() {
  if (compiler && renderer) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const start = performance.now();

    const fontBuffers = await Promise.all(
      FONT_FILES.map(async (file) => {
        const url = new URL(`/fonts/${file}`, self.location.origin).toString();
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch font ${file}: ${res.status}`);
        }
        return new Uint8Array(await res.arrayBuffer());
      })
    );

    const c = createTypstCompiler();
    const r = createTypstRenderer();

    await Promise.all([
      c.init({
        getModule: () => new URL(compilerWasmUrl, self.location.origin).toString(),
        beforeBuild: [loadFonts(fontBuffers, { assets: false })],
      }),
      r.init({
        getModule: () => new URL(rendererWasmUrl, self.location.origin).toString(),
      }),
    ]);

    c.addSource('/single-column.typ', singleColumnTemplate);
    c.addSource('/cover-letter.typ', coverLetterTemplate);

    compiler = c;
    renderer = r;

    const initMs = Math.round(performance.now() - start);
    self.postMessage({ type: 'ready', initMs } satisfies WorkerResponse);
  })();

  return initPromise;
}

function formatDiagnostics(diags: unknown[] | undefined): string[] {
  if (!diags || diags.length === 0) return [];
  return diags.map((d) => {
    if (typeof d === 'string') return d;
    if (d && typeof d === 'object') {
      const m = d as { severity?: string; path?: string; range?: string; message?: string };
      const loc = [m.path, m.range].filter(Boolean).join(':');
      return `${m.severity ?? 'error'}${loc ? ` (${loc})` : ''}: ${m.message ?? JSON.stringify(d)}`;
    }
    return String(d);
  });
}

self.onmessage = async (event: MessageEvent<WorkerCompileRequest | { type: 'init' }>) => {
  const msg = event.data;

  if (msg.type === 'init') {
    try {
      await ensureInitialized();
    } catch (err) {
      self.postMessage({
        id: 0,
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      } satisfies WorkerResponse);
    }
    return;
  }

  try {
    await ensureInitialized();
    if (!compiler || !renderer) {
      throw new Error('Typst WASM not initialized');
    }

    const start = performance.now();

    compiler.addSource('/resume.json', msg.resumeJson);
    compiler.addSource('/config.json', msg.configJson);

    const mainFilePath = msg.mode === 'cover-letter' ? '/cover-letter.typ' : '/single-column.typ';
    if (msg.mode === 'cover-letter') {
      compiler.addSource('/cover-letter-body.typ', msg.coverLetterTypst ?? '');
    }

    if (msg.type === 'compile-pdf') {
      const compiled = await compiler.compile({
        mainFilePath,
        format: CompileFormatEnum.pdf,
        diagnostics: 'full',
      });

      const diagnostics = formatDiagnostics(compiled.diagnostics);
      if (!compiled.result) {
        self.postMessage({
          id: msg.id,
          type: 'error',
          message: diagnostics[0] ?? 'Failed to compile PDF',
          diagnostics,
        } satisfies WorkerResponse);
        return;
      }

      const compileMs = Math.round(performance.now() - start);
      const pdfBytes = new Uint8Array(compiled.result);
      self.postMessage(
        {
          id: msg.id,
          type: 'pdf-result',
          pdf: pdfBytes,
          compileMs,
        } satisfies WorkerResponse,
        [pdfBytes.buffer]
      );
      return;
    }

    // SVG live preview
    const compiled = await compiler.compile({
      mainFilePath,
      format: CompileFormatEnum.vector,
      diagnostics: 'full',
    });

    const diagnostics = formatDiagnostics(compiled.diagnostics);
    if (!compiled.result) {
      self.postMessage({
        id: msg.id,
        type: 'error',
        message: diagnostics[0] ?? 'Compilation failed',
        diagnostics,
      } satisfies WorkerResponse);
      return;
    }

    const artifact = compiled.result;
    const rendered = await renderer.runWithSession(
      { format: 'vector', artifactContent: artifact },
      async (session) => {
        const pagesInfo = session.retrievePagesInfo();
        const svg = await session.renderSvg({
          data_selection: { body: true, defs: true, css: true, js: false },
        });
        return {
          svg,
          pages: pagesInfo.map((p) => ({
            pageOffset: p.pageOffset,
            width: p.width,
            height: p.height,
          })),
        };
      }
    );

    const compileMs = Math.round(performance.now() - start);
    self.postMessage({
      id: msg.id,
      type: 'svg-result',
      svg: rendered.svg,
      pages: rendered.pages,
      compileMs,
      diagnostics,
    } satisfies WorkerResponse);
  } catch (err) {
    self.postMessage({
      id: msg.id,
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    } satisfies WorkerResponse);
  }
};
