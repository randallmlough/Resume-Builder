import { useState } from 'react';
import { Globe, Mail, Phone } from 'lucide-react';
import {
  CONTACT_RELATIONSHIPS,
  type CompanyContactRecord,
  type ContactRelationship,
} from '@shared/schema';

export function normalizeUrl(url: string, prefix = 'https://'): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('@') && prefix.includes('x.com')) {
    return `https://x.com/${trimmed.slice(1)}`;
  }
  return `${prefix}${trimmed.replace(/^\/+/, '')}`;
}

export function ContactLinksBar({ contact }: { contact: CompanyContactRecord }) {
  const hasAny =
    contact.email ||
    contact.phone ||
    contact.linkedin ||
    contact.github ||
    contact.twitter ||
    contact.website;

  if (!hasAny) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap pt-1">
      {contact.email && (
        <a
          href={`mailto:${contact.email}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-stone-200 hover:border-sky-400 hover:text-sky-700 text-[11px] text-stone-600 transition-colors"
        >
          <Mail className="w-3 h-3" />
          <span>{contact.email}</span>
        </a>
      )}
      {contact.phone && (
        <a
          href={`tel:${contact.phone}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-stone-200 hover:border-sky-400 hover:text-sky-700 text-[11px] text-stone-600 transition-colors"
        >
          <Phone className="w-3 h-3" />
          <span>{contact.phone}</span>
        </a>
      )}
      {contact.linkedin && (
        <a
          href={normalizeUrl(contact.linkedin, 'https://')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-stone-200 hover:border-sky-400 hover:text-sky-700 text-[11px] font-medium text-stone-700 transition-colors"
        >
          LinkedIn ↗
        </a>
      )}
      {contact.github && (
        <a
          href={normalizeUrl(contact.github, 'https://')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-stone-200 hover:border-sky-400 hover:text-sky-700 text-[11px] font-medium text-stone-700 transition-colors"
        >
          GitHub ↗
        </a>
      )}
      {contact.twitter && (
        <a
          href={normalizeUrl(contact.twitter, 'https://x.com/')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-stone-200 hover:border-sky-400 hover:text-sky-700 text-[11px] font-medium text-stone-700 transition-colors"
        >
          X / Twitter ↗
        </a>
      )}
      {contact.website && (
        <a
          href={normalizeUrl(contact.website, 'https://')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-stone-200 hover:border-sky-400 hover:text-sky-700 text-[11px] font-medium text-stone-700 transition-colors"
        >
          <Globe className="w-3 h-3" />
          Website ↗
        </a>
      )}
    </div>
  );
}

export interface ContactDraft {
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  twitter: string;
  website: string;
  notes: string;
  relationship?: ContactRelationship;
}

const inputCls =
  'w-full h-8 px-2.5 text-xs rounded-md border border-stone-200 bg-white focus:border-sky-500 outline-none';

export function ContactFormCard({
  initial,
  showRelationship = false,
  submitLabel = 'Save Contact',
  onSubmit,
  onCancel,
}: {
  initial?: Partial<ContactDraft>;
  showRelationship?: boolean;
  submitLabel?: string;
  onSubmit: (draft: ContactDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ContactDraft>({
    name: initial?.name ?? '',
    title: initial?.title ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    linkedin: initial?.linkedin ?? '',
    github: initial?.github ?? '',
    twitter: initial?.twitter ?? '',
    website: initial?.website ?? '',
    notes: initial?.notes ?? '',
    relationship: initial?.relationship ?? 'hiring_manager',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-sky-200 bg-sky-50/40 p-3.5 space-y-2.5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[11px] font-medium text-stone-600 mb-1">Full Name *</label>
          <input
            autoFocus
            required
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="e.g., Sarah Chen"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-stone-600 mb-1">
            Role in Company
          </label>
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="e.g., VP of Engineering, Engineering Manager"
            className={inputCls}
          />
        </div>

        {showRelationship && (
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-medium text-stone-600 mb-1">
              Relationship to This Role
            </label>
            <select
              value={draft.relationship}
              onChange={(e) =>
                setDraft((d) => ({ ...d, relationship: e.target.value as ContactRelationship }))
              }
              className={inputCls}
            >
              {CONTACT_RELATIONSHIPS.map((rel) => (
                <option key={rel.id} value={rel.id}>
                  {rel.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-medium text-stone-600 mb-1">Email</label>
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            placeholder="sarah@company.com"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-stone-600 mb-1">Phone</label>
          <input
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            placeholder="555-234-5678"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-stone-600 mb-1">LinkedIn</label>
          <input
            value={draft.linkedin}
            onChange={(e) => setDraft((d) => ({ ...d, linkedin: e.target.value }))}
            placeholder="linkedin.com/in/sarahchen"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-stone-600 mb-1">GitHub</label>
          <input
            value={draft.github}
            onChange={(e) => setDraft((d) => ({ ...d, github: e.target.value }))}
            placeholder="github.com/sarahchen"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-stone-600 mb-1">X / Twitter</label>
          <input
            value={draft.twitter}
            onChange={(e) => setDraft((d) => ({ ...d, twitter: e.target.value }))}
            placeholder="@sarahchen or x.com/sarahchen"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-stone-600 mb-1">
            Website / Other Profile
          </label>
          <input
            value={draft.website}
            onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))}
            placeholder="https://sarahchen.dev"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-stone-600 mb-1">Notes</label>
        <textarea
          rows={2}
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          placeholder="How you met, communication preferences, referral context…"
          className="w-full p-2 text-xs rounded-md border border-stone-200 bg-white focus:border-sky-500 outline-none resize-y"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="h-7 px-3 rounded-md border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !draft.name.trim()}
          className="h-7 px-3 rounded-md bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
