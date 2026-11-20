import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Plus, Trash2 } from 'lucide-react';
import type { CoverLetterRecord } from '@shared/schema';

interface CoverLetterEditorProps {
  letters: CoverLetterRecord[];
  activeLetter: CoverLetterRecord | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onChange: (patch: Partial<Pick<CoverLetterRecord, 'title' | 'company' | 'bodyMarkdown'>>) => void;
}

export function CoverLetterEditor({
  letters,
  activeLetter,
  onSelect,
  onCreate,
  onDelete,
  onChange,
}: CoverLetterEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isInternalRef = useRef(false);
  const activeIdRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!editorContainerRef.current) return;

    const state = EditorState.create({
      doc: activeLetter?.bodyMarkdown ?? '',
      extensions: [
        highlightActiveLine(),
        history(),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': {
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
            fontSize: '14px',
            lineHeight: '1.65',
            padding: '16px',
          },
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || isInternalRef.current) return;
          onChangeRef.current({ bodyMarkdown: update.state.doc.toString() });
        }),
      ],
    });

    const view = new EditorView({ state, parent: editorContainerRef.current });
    viewRef.current = view;
    activeIdRef.current = activeLetter?.id ?? null;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Replace doc when switching between different cover letters
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (activeLetter?.id === activeIdRef.current) return;
    activeIdRef.current = activeLetter?.id ?? null;
    const nextDoc = activeLetter?.bodyMarkdown ?? '';
    isInternalRef.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: nextDoc },
    });
    isInternalRef.current = false;
  }, [activeLetter?.id, activeLetter?.bodyMarkdown]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Letter selector + metadata */}
      <div className="p-3.5 border-b border-stone-200 bg-stone-50/80 space-y-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <select
            value={activeLetter?.id ?? ''}
            onChange={(e) => onSelect(e.target.value)}
            className="flex-1 h-8 px-2.5 text-sm font-medium rounded-md border border-stone-200 bg-white focus:border-sky-500 outline-none"
          >
            {letters.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title} {l.company ? `— ${l.company}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onCreate}
            className="h-8 px-2.5 inline-flex items-center gap-1 text-xs font-medium rounded-md bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/80"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
          {activeLetter && letters.length > 1 && (
            <button
              type="button"
              onClick={() => onDelete(activeLetter.id)}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-stone-400 hover:text-red-600 hover:bg-red-50"
              title="Delete cover letter"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {activeLetter && (
          <div className="grid grid-cols-2 gap-2">
            <input
              value={activeLetter.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Letter title"
              className="h-8 px-2.5 text-xs rounded-md border border-stone-200 bg-white focus:border-sky-500 outline-none"
            />
            <input
              value={activeLetter.company}
              onChange={(e) => onChange({ company: e.target.value })}
              placeholder="Target company"
              className="h-8 px-2.5 text-xs rounded-md border border-stone-200 bg-white focus:border-sky-500 outline-none"
            />
          </div>
        )}

        <div className="text-[11px] text-stone-500">
          Supports Markdown: <code className="bg-stone-200/70 px-1 rounded">**bold**</code>,{' '}
          <code className="bg-stone-200/70 px-1 rounded">*italic*</code>,{' '}
          <code className="bg-stone-200/70 px-1 rounded">### heading</code>,{' '}
          <code className="bg-stone-200/70 px-1 rounded">- bullets</code>,{' '}
          <code className="bg-stone-200/70 px-1 rounded">[link](url)</code>. Header &amp; accent color
          sync from the active resume.
        </div>
      </div>

      {/* Markdown editor */}
      <div ref={editorContainerRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
