import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Maximize2, Minus, Paperclip, Plus, Zap } from 'lucide-react';
import type { RecommendationLetterRecord } from '@shared/schema';
import type { TypstPreviewState } from '../typst/useTypst';
import { AttachedLetterPreview } from './AttachedLetterPreview';

interface PreviewPaneProps {
  preview: TypstPreviewState;
  mode: 'resume' | 'cover-letter';
  attachments: RecommendationLetterRecord[];
}

interface ExtractedPage {
  index: number;
  width: number;
  height: number;
  svgHtml: string;
}

/**
 * Splits a multi-page Typst SVG document into discrete page <svg> sheets so each page
 * renders as an independent paper sheet with its own shadow and visual separation.
 */
function splitTypstPages(rawSvg: string): ExtractedPage[] | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawSvg, 'image/svg+xml');
    const rootSvg = doc.querySelector('svg');
    if (!rootSvg) return null;

    const pageGroups = Array.from(rootSvg.querySelectorAll('g.typst-page'));
    if (pageGroups.length === 0) return null;

    const defs = Array.from(rootSvg.querySelectorAll(':scope > defs'))
      .map((el) => el.outerHTML)
      .join('');
    const styles = Array.from(rootSvg.querySelectorAll(':scope > style'))
      .map((el) => el.outerHTML)
      .join('');

    const pages: ExtractedPage[] = pageGroups.map((group, idx) => {
      const w = parseFloat(group.getAttribute('data-page-width') ?? '612');
      const h = parseFloat(group.getAttribute('data-page-height') ?? '792');

      // Reset vertical stack offset so each page sits cleanly at (0, 0) in its own SVG
      const clone = group.cloneNode(true) as SVGGElement;
      clone.setAttribute('transform', 'translate(0, 0)');

      const svgHtml = `<svg class="typst-doc" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${styles}${defs}<rect width="${w}" height="${h}" fill="#ffffff"/>${clone.outerHTML}</svg>`;

      return { index: idx, width: w, height: h, svgHtml };
    });

    return pages;
  } catch {
    return null;
  }
}

export function PreviewPane({ preview, mode, attachments }: PreviewPaneProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [fitWidth, setFitWidth] = useState<boolean>(true);

  const splitPages = useMemo(() => {
    if (!preview.svg) return null;
    return splitTypstPages(preview.svg);
  }, [preview.svg]);

  const basePageCount = splitPages?.length ?? preview.pages.length;
  const attachedPageCount = attachments.reduce((sum, l) => sum + (l.pageCount || 1), 0);
  const totalPageCount = basePageCount + attachedPageCount;

  const widthStyle = fitWidth ? 'min(100%, 760px)' : `${Math.round((760 * zoom) / 100)}px`;

  const adjustZoom = (delta: number) => {
    setFitWidth(false);
    setZoom((z) => Math.min(180, Math.max(50, z + delta)));
  };

  // Compute starting page index for each attached letter
  let runningPage = basePageCount + 1;
  const attachedWithOffsets = attachments.map((letter) => {
    const startPage = runningPage;
    runningPage += letter.pageCount || 1;
    return { letter, startPage };
  });

  return (
    <section className="flex-1 flex flex-col min-w-0 bg-stone-200/75 overflow-hidden">
      {/* Preview Toolbar */}
      <div className="h-10 shrink-0 border-b border-stone-200/90 bg-stone-50/95 px-3.5 flex items-center justify-between gap-2 text-xs text-stone-600">
        <div className="flex items-center gap-2 min-w-0 whitespace-nowrap overflow-x-auto">
          <span className="font-medium text-stone-800 shrink-0">
            {mode === 'resume' ? 'Resume Preview' : 'Cover Letter'}
          </span>

          {totalPageCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-stone-200/80 text-stone-700 font-medium">
              {totalPageCount} {totalPageCount === 1 ? 'page' : 'pages'}
            </span>
          )}

          {attachedPageCount > 0 && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80 font-medium"
              title="Attached recommendation letter pages will be appended when exporting PDF"
            >
              <Paperclip className="w-3 h-3" />+{attachedPageCount} attached
            </span>
          )}

          {preview.compileMs !== null && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono text-[11px]"
              title={
                preview.initMs
                  ? `Typst WASM initialized in ${preview.initMs}ms · last compile ${preview.compileMs}ms`
                  : undefined
              }
            >
              <Zap className="w-3 h-3" />
              {preview.compileMs} ms
            </span>
          )}

          {preview.compiling && (
            <span className="inline-flex items-center gap-1 text-stone-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Rendering
            </span>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => adjustZoom(-10)}
            className="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-stone-200/70 text-stone-600"
            title="Zoom out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setFitWidth(true);
              setZoom(100);
            }}
            className={`px-2 h-7 rounded font-mono text-[11px] transition-colors ${
              fitWidth
                ? 'bg-stone-200 text-stone-900 font-semibold'
                : 'hover:bg-stone-200/70 text-stone-600'
            }`}
            title="Fit page to pane"
          >
            {fitWidth ? 'Fit' : `${zoom}%`}
          </button>
          <button
            type="button"
            onClick={() => adjustZoom(10)}
            className="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-stone-200/70 text-stone-600"
            title="Zoom in"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setFitWidth(false);
              setZoom(100);
            }}
            className="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-stone-200/70 text-stone-600"
            title="Actual size (100%)"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Diagnostic / Error Banner */}
      {preview.error && (
        <div className="mx-4 mt-3 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs flex items-start gap-2.5 shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <div className="min-w-0">
            <div className="font-semibold">Typst compile error</div>
            <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-red-700 overflow-x-auto">
              {preview.error}
            </pre>
          </div>
        </div>
      )}

      {/* Scrollable Paper Viewport */}
      <div className="flex-1 overflow-auto p-6 sm:p-8 flex flex-col items-center gap-6">
        {!preview.svg ? (
          <div className="my-auto flex flex-col items-center gap-3 text-stone-500">
            <Loader2 className="w-6 h-6 animate-spin text-sky-700" />
            <div className="text-sm font-medium">
              {preview.ready ? 'Rendering document…' : 'Loading Typst WASM & Merriweather fonts…'}
            </div>
          </div>
        ) : (
          <>
            {splitPages ? (
              splitPages.map((page) => (
                <div
                  key={page.index}
                  className="flex flex-col items-center gap-1.5 shrink-0"
                  style={{ width: widthStyle }}
                >
                  <div
                    className="typst-preview-root typst-page-sheet w-full"
                    dangerouslySetInnerHTML={{ __html: page.svgHtml }}
                  />
                  {totalPageCount > 1 && (
                    <span className="text-[11px] text-stone-500 font-medium">
                      Page {page.index + 1} of {totalPageCount}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div
                className="typst-preview-root typst-page-sheet shrink-0"
                style={{ width: widthStyle }}
                dangerouslySetInnerHTML={{ __html: preview.svg }}
              />
            )}

            {/* Attached Letters of Recommendation Divider + Pages */}
            {attachedWithOffsets.length > 0 && (
              <>
                <div
                  className="flex items-center gap-3 pt-1 shrink-0"
                  style={{ width: widthStyle }}
                >
                  <div className="h-px flex-1 bg-stone-300/90" />
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    <Paperclip className="w-3 h-3 text-sky-700" />
                    Attached Letters of Recommendation
                  </span>
                  <div className="h-px flex-1 bg-stone-300/90" />
                </div>

                {attachedWithOffsets.map(({ letter, startPage }) => (
                  <AttachedLetterPreview
                    key={letter.id}
                    letter={letter}
                    widthStyle={widthStyle}
                    startPageNumber={startPage}
                    totalPages={totalPageCount}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
