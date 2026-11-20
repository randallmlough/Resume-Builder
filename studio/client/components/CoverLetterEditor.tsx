import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Code,
  FileCode2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Plus,
  Redo2,
  Trash2,
  Type,
  Undo2,
  Unlink,
} from 'lucide-react';
import type { CoverLetterRecord } from '@shared/schema';
import { markdownToHtml, tiptapJsonToMarkdown, type RichNode } from '@shared/coverLetterFormat';

interface CoverLetterEditorProps {
  letters: CoverLetterRecord[];
  activeLetter: CoverLetterRecord | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onChange: (patch: Partial<Pick<CoverLetterRecord, 'title' | 'company' | 'bodyMarkdown'>>) => void;
}

function ToolbarButton({
  active = false,
  disabled = false,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onMouseDown={(e) => {
        // Keep focus & selection in the editor when clicking toolbar buttons
        e.preventDefault();
        onClick();
      }}
      className={`h-7 min-w-7 px-1.5 inline-flex items-center justify-center rounded text-xs font-medium transition-colors disabled:opacity-35 ${
        active
          ? 'bg-sky-100 text-sky-900 border border-sky-200/90'
          : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-transparent'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="h-4 w-px bg-stone-200 mx-0.5 shrink-0" />;
}

export function CoverLetterEditor({
  letters,
  activeLetter,
  onSelect,
  onCreate,
  onDelete,
  onChange,
}: CoverLetterEditorProps) {
  const [sourceMode, setSourceMode] = useState<'wysiwyg' | 'markdown'>('wysiwyg');
  const [linkBarOpen, setLinkBarOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [, setSelectionTick] = useState(0);

  const activeIdRef = useRef<string | null>(activeLetter?.id ?? null);
  const lastEmittedMarkdownRef = useRef<string>(activeLetter?.bodyMarkdown ?? '');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
        blockquote: false,
        codeBlock: false,
        strike: false,
        underline: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing your cover letter… Use the toolbar above or Markdown shortcuts.',
      }),
    ],
    content: markdownToHtml(activeLetter?.bodyMarkdown ?? ''),
    editorProps: {
      attributes: {
        class: 'tiptap-cover-letter',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = tiptapJsonToMarkdown(ed.getJSON() as RichNode);
      lastEmittedMarkdownRef.current = md;
      onChangeRef.current({ bodyMarkdown: md });
    },
    onSelectionUpdate: () => {
      setSelectionTick((t) => t + 1);
    },
  });

  // Sync content when switching between different cover letters or returning from Markdown mode
  useEffect(() => {
    if (!editor) return;
    const nextId = activeLetter?.id ?? null;
    const nextMd = activeLetter?.bodyMarkdown ?? '';

    const switchedLetter = nextId !== activeIdRef.current;
    const externalChange = nextMd !== lastEmittedMarkdownRef.current;

    if (switchedLetter || (sourceMode === 'wysiwyg' && externalChange)) {
      activeIdRef.current = nextId;
      lastEmittedMarkdownRef.current = nextMd;
      editor.commands.setContent(markdownToHtml(nextMd), { emitUpdate: false });
      setLinkBarOpen(false);
    }
  }, [editor, activeLetter?.id, activeLetter?.bodyMarkdown, sourceMode]);

  const wordStats = useMemo(() => {
    const text = (activeLetter?.bodyMarkdown ?? '')
      .replace(/[#*_`>-]/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const paragraphs = (activeLetter?.bodyMarkdown ?? '')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean).length;
    return { words, paragraphs };
  }, [activeLetter?.bodyMarkdown]);

  const openLinkBar = () => {
    if (!editor) return;
    const existingHref = String(editor.getAttributes('link').href ?? '');
    setLinkUrl(existingHref);
    setLinkBarOpen(true);
  };

  const applyLink = () => {
    if (!editor) return;
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
    } else {
      const href = /^https?:\/\/|^mailto:|^tel:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setLinkBarOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Letter Selector & Metadata */}
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
      </div>

      {/* WYSIWYG Formatting Toolbar */}
      <div className="px-3 py-1.5 border-b border-stone-200 bg-white flex items-center justify-between gap-2 shrink-0 flex-wrap">
        {sourceMode === 'wysiwyg' && editor ? (
          <div className="flex items-center gap-0.5 flex-wrap">
            <ToolbarButton
              title="Normal paragraph"
              active={editor.isActive('paragraph')}
              onClick={() => editor.chain().focus().setParagraph().run()}
            >
              <Pilcrow className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Heading 1"
              active={editor.isActive('heading', { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <Heading1 className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Heading 2"
              active={editor.isActive('heading', { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Heading 3"
              active={editor.isActive('heading', { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              <Heading3 className="w-3.5 h-3.5" />
            </ToolbarButton>

            <ToolbarDivider />

            <ToolbarButton
              title="Bold (⌘B)"
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Italic (⌘I)"
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Inline code (⌘E)"
              active={editor.isActive('code')}
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <Code className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Insert or edit link"
              active={editor.isActive('link') || linkBarOpen}
              onClick={openLinkBar}
            >
              <Link2 className="w-3.5 h-3.5" />
            </ToolbarButton>
            {editor.isActive('link') && (
              <ToolbarButton
                title="Remove link"
                onClick={() => editor.chain().focus().unsetLink().run()}
              >
                <Unlink className="w-3.5 h-3.5" />
              </ToolbarButton>
            )}

            <ToolbarDivider />

            <ToolbarButton
              title="Bullet list"
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Numbered list"
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Horizontal divider"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
            >
              <Minus className="w-3.5 h-3.5" />
            </ToolbarButton>

            <ToolbarDivider />

            <ToolbarButton
              title="Undo (⌘Z)"
              disabled={!editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Redo (⌘⇧Z)"
              disabled={!editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </ToolbarButton>
          </div>
        ) : (
          <span className="text-xs text-stone-500 font-medium">Raw Markdown Source</span>
        )}

        {/* Rich Text / Markdown Toggle */}
        <div className="inline-flex items-center rounded-md bg-stone-100 p-0.5 border border-stone-200/80 shrink-0">
          <button
            type="button"
            onClick={() => setSourceMode('wysiwyg')}
            className={`h-6 px-2 rounded text-[11px] font-medium inline-flex items-center gap-1 transition-colors ${
              sourceMode === 'wysiwyg'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Type className="w-3 h-3" />
            Rich Text
          </button>
          <button
            type="button"
            onClick={() => {
              setLinkBarOpen(false);
              setSourceMode('markdown');
            }}
            className={`h-6 px-2 rounded text-[11px] font-medium inline-flex items-center gap-1 transition-colors ${
              sourceMode === 'markdown'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <FileCode2 className="w-3 h-3" />
            Markdown
          </button>
        </div>
      </div>

      {/* Inline Link Editor Popover Bar */}
      {linkBarOpen && sourceMode === 'wysiwyg' && (
        <div className="px-3.5 py-2 border-b border-sky-200 bg-sky-50/70 flex items-center gap-2 shrink-0">
          <Link2 className="w-3.5 h-3.5 text-sky-700 shrink-0" />
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              } else if (e.key === 'Escape') {
                setLinkBarOpen(false);
                editor?.commands.focus();
              }
            }}
            placeholder="https://example.com"
            className="flex-1 h-7 px-2.5 text-xs rounded border border-sky-200 bg-white focus:border-sky-500 outline-none"
          />
          <button
            type="button"
            onClick={applyLink}
            className="h-7 px-2.5 rounded bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setLinkBarOpen(false);
              editor?.commands.focus();
            }}
            className="h-7 px-2 rounded text-xs text-stone-600 hover:bg-stone-200/60"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Editor Writing Canvas */}
      <div className="flex-1 overflow-y-auto">
        {sourceMode === 'wysiwyg' ? (
          <div
            className="min-h-full px-6 py-5 cursor-text"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                editor?.commands.focus('end');
              }
            }}
          >
            <EditorContent editor={editor} />
          </div>
        ) : (
          <textarea
            value={activeLetter?.bodyMarkdown ?? ''}
            onChange={(e) => {
              lastEmittedMarkdownRef.current = e.target.value;
              onChange({ bodyMarkdown: e.target.value });
            }}
            placeholder="Write Markdown..."
            className="w-full h-full px-5 py-4 font-mono text-xs leading-relaxed text-stone-800 bg-stone-50/30 outline-none resize-none"
          />
        )}
      </div>

      {/* Subtle Word Count Footer */}
      <div className="h-8 shrink-0 px-4 border-t border-stone-200/80 bg-stone-50/70 flex items-center justify-between text-[11px] text-stone-500">
        <span>
          {wordStats.words} {wordStats.words === 1 ? 'word' : 'words'} · {wordStats.paragraphs}{' '}
          {wordStats.paragraphs === 1 ? 'block' : 'blocks'}
        </span>
        <span className="hidden sm:inline text-stone-400">
          Header &amp; accent sync from active resume
        </span>
      </div>
    </div>
  );
}
