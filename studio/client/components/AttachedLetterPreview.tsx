import { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { AlertCircle, Loader2, Paperclip } from 'lucide-react';
import type { RecommendationLetterRecord } from '@shared/schema';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

interface RenderedPdfPage {
  pageNumber: number;
  dataUrl: string;
  aspectRatio: number;
}

function PdfLetterPages({
  letter,
  widthStyle,
  startPageNumber,
  totalPages,
}: {
  letter: RecommendationLetterRecord;
  widthStyle: string;
  startPageNumber: number;
  totalPages: number;
}) {
  const [pages, setPages] = useState<RenderedPdfPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPages(null);
    setError(null);

    (async () => {
      try {
        const res = await fetch(letter.fileUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdfDoc = await loadingTask.promise;

        const rendered: RenderedPdfPage[] = [];
        for (let p = 1; p <= pdfDoc.numPages; p++) {
          const page = await pdfDoc.getPage(p);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas 2D context unavailable');

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          rendered.push({
            pageNumber: p,
            dataUrl: canvas.toDataURL('image/png'),
            aspectRatio: viewport.width / viewport.height,
          });
        }

        if (!cancelled) {
          setPages(rendered);
        }
        await loadingTask.destroy();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render attached PDF');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [letter.id, letter.fileUrl]);

  if (error) {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-center gap-2"
        style={{ width: widthStyle }}
      >
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>
          Could not preview attached PDF &ldquo;{letter.title}&rdquo;: {error}
        </span>
      </div>
    );
  }

  if (!pages) {
    return (
      <div
        className="typst-page-sheet aspect-[8.5/11] flex flex-col items-center justify-center gap-2 text-stone-400"
        style={{ width: widthStyle }}
      >
        <Loader2 className="w-5 h-5 animate-spin text-sky-700" />
        <span className="text-xs">Rendering {letter.title}…</span>
      </div>
    );
  }

  return (
    <>
      {pages.map((pg, idx) => (
        <div
          key={`${letter.id}-p-${pg.pageNumber}`}
          className="flex flex-col items-center gap-1.5 shrink-0"
          style={{ width: widthStyle }}
        >
          <div className="typst-page-sheet w-full bg-white">
            <img
              src={pg.dataUrl}
              alt={`${letter.title} — page ${pg.pageNumber}`}
              className="block w-full h-auto"
            />
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-stone-500 font-medium">
            <Paperclip className="w-3 h-3 text-sky-700" />
            <span>
              {letter.title}
              {letter.authorName ? ` (${letter.authorName})` : ''}
            </span>
            <span className="text-stone-400">·</span>
            <span>
              Page {startPageNumber + idx} of {totalPages}
            </span>
          </span>
        </div>
      ))}
    </>
  );
}

export function AttachedLetterPreview({
  letter,
  widthStyle,
  startPageNumber,
  totalPages,
}: {
  letter: RecommendationLetterRecord;
  widthStyle: string;
  startPageNumber: number;
  totalPages: number;
}) {
  if (letter.mimeType === 'application/pdf') {
    return (
      <PdfLetterPages
        letter={letter}
        widthStyle={widthStyle}
        startPageNumber={startPageNumber}
        totalPages={totalPages}
      />
    );
  }

  // PNG / JPG letter rendered centered on a US Letter paper sheet matching pdf-lib export
  return (
    <div
      className="flex flex-col items-center gap-1.5 shrink-0"
      style={{ width: widthStyle }}
    >
      <div className="typst-page-sheet w-full aspect-[8.5/11] bg-white p-[4.5%] flex items-center justify-center">
        <img
          src={letter.fileUrl}
          alt={letter.title}
          className="max-w-full max-h-full object-contain"
        />
      </div>
      <span className="inline-flex items-center gap-1.5 text-[11px] text-stone-500 font-medium">
        <Paperclip className="w-3 h-3 text-sky-700" />
        <span>
          {letter.title}
          {letter.authorName ? ` (${letter.authorName})` : ''}
        </span>
        <span className="text-stone-400">·</span>
        <span>
          Page {startPageNumber} of {totalPages}
        </span>
      </span>
    </div>
  );
}
