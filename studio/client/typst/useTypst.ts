import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResumeConfig, ResumeData } from '@shared/schema';
import { markdownToTypst } from '@shared/markdownToTypst';
import type { PageMeta, WorkerCompileRequest, WorkerResponse } from './typst.worker';

export interface TypstPreviewState {
  ready: boolean;
  initMs: number | null;
  compiling: boolean;
  svg: string | null;
  pages: PageMeta[];
  compileMs: number | null;
  error: string | null;
  diagnostics: string[];
}

export function useTypst(
  mode: 'resume' | 'cover-letter',
  data: ResumeData | null,
  config: ResumeConfig | null,
  coverLetterMarkdown: string
) {
  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);
  const latestSvgReqIdRef = useRef(0);
  const pendingPdfRef = useRef<Map<number, { resolve: (b: Uint8Array) => void; reject: (e: Error) => void }>>(
    new Map()
  );

  const [state, setState] = useState<TypstPreviewState>({
    ready: false,
    initMs: null,
    compiling: false,
    svg: null,
    pages: [],
    compileMs: null,
    error: null,
    diagnostics: [],
  });

  useEffect(() => {
    const worker = new Worker(new URL('./typst.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;

      if (msg.type === 'ready') {
        setState((prev) => ({ ...prev, ready: true, initMs: msg.initMs }));
        return;
      }

      if (msg.type === 'pdf-result') {
        const pending = pendingPdfRef.current.get(msg.id);
        if (pending) {
          pendingPdfRef.current.delete(msg.id);
          pending.resolve(msg.pdf);
        }
        return;
      }

      if (msg.type === 'svg-result') {
        if (msg.id < latestSvgReqIdRef.current) return; // stale compile
        setState((prev) => ({
          ...prev,
          compiling: false,
          svg: msg.svg,
          pages: msg.pages,
          compileMs: msg.compileMs,
          error: null,
          diagnostics: msg.diagnostics,
        }));
        return;
      }

      if (msg.type === 'error') {
        const pending = pendingPdfRef.current.get(msg.id);
        if (pending) {
          pendingPdfRef.current.delete(msg.id);
          pending.reject(new Error(msg.message));
          return;
        }
        setState((prev) => ({
          ...prev,
          compiling: false,
          error: msg.message,
          diagnostics: msg.diagnostics ?? [],
        }));
      }
    };

    worker.onerror = (err) => {
      setState((prev) => ({
        ...prev,
        compiling: false,
        error: err.message || 'Typst worker crashed',
      }));
    };

    worker.postMessage({ type: 'init' });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Trigger fast debounced live SVG compile whenever content changes
  useEffect(() => {
    if (!data || !config || !workerRef.current) return;

    const timer = window.setTimeout(() => {
      const id = ++reqIdRef.current;
      latestSvgReqIdRef.current = id;
      setState((prev) => ({ ...prev, compiling: true }));

      const payload: WorkerCompileRequest = {
        id,
        type: 'render-svg',
        mode,
        resumeJson: JSON.stringify(data),
        configJson: JSON.stringify(config),
        coverLetterTypst: mode === 'cover-letter' ? markdownToTypst(coverLetterMarkdown) : undefined,
      };
      workerRef.current?.postMessage(payload);
    }, 35);

    return () => window.clearTimeout(timer);
  }, [mode, data, config, coverLetterMarkdown]);

  const compilePdf = useCallback(async (): Promise<Uint8Array> => {
    if (!data || !config || !workerRef.current) {
      throw new Error('Typst compiler not ready');
    }
    const id = ++reqIdRef.current;
    return new Promise<Uint8Array>((resolve, reject) => {
      pendingPdfRef.current.set(id, { resolve, reject });
      const payload: WorkerCompileRequest = {
        id,
        type: 'compile-pdf',
        mode,
        resumeJson: JSON.stringify(data),
        configJson: JSON.stringify(config),
        coverLetterTypst: mode === 'cover-letter' ? markdownToTypst(coverLetterMarkdown) : undefined,
      };
      workerRef.current?.postMessage(payload);
    });
  }, [mode, data, config, coverLetterMarkdown]);

  return { ...state, compilePdf };
}
