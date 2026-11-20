import { useEffect, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { defaultHighlightStyle, syntaxHighlighting, bracketMatching } from '@codemirror/language';
import { AlertCircle, CheckCircle2, Wand2 } from 'lucide-react';
import { ResumeDataSchema, type ResumeData } from '@shared/schema';

interface JsonEditorProps {
  data: ResumeData;
  onChange: (next: ResumeData) => void;
}

export function JsonEditor({ data, onChange }: JsonEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isInternalChangeRef = useRef(false);
  const lastAppliedJsonRef = useRef<string>('');
  const [error, setError] = useState<string | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const initialText = JSON.stringify(data, null, 2);
    lastAppliedJsonRef.current = initialText;

    const state = EditorState.create({
      doc: initialText,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        bracketMatching(),
        json(),
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          if (isInternalChangeRef.current) return;

          const text = update.state.doc.toString();
          try {
            const parsedJson = JSON.parse(text);
            const validated = ResumeDataSchema.safeParse(parsedJson);
            if (!validated.success) {
              const firstIssue = validated.error.issues[0];
              setError(
                `Schema: ${firstIssue.path.join('.') || 'root'} — ${firstIssue.message}`
              );
              return;
            }
            setError(null);
            lastAppliedJsonRef.current = JSON.stringify(validated.data, null, 2);
            onChangeRef.current(validated.data);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid JSON');
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Sync external updates (e.g., from VisualEditor or switching resumes)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const serialized = JSON.stringify(data, null, 2);
    if (serialized === lastAppliedJsonRef.current) return;

    lastAppliedJsonRef.current = serialized;
    isInternalChangeRef.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: serialized },
    });
    isInternalChangeRef.current = false;
    setError(null);
  }, [data]);

  const handleFormat = () => {
    const view = viewRef.current;
    if (!view) return;
    try {
      const parsed = JSON.parse(view.state.doc.toString());
      const formatted = JSON.stringify(parsed, null, 2);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: formatted },
      });
    } catch {
      // ignore if currently invalid
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="h-9 shrink-0 px-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          {error ? (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span className="text-red-700 truncate font-medium">{error}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-stone-600">Valid resume.json — live synced</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleFormat}
          className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-stone-200/70 text-stone-600 font-medium"
        >
          <Wand2 className="w-3 h-3" />
          Format
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
