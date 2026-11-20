import { useState } from 'react';
import {
  Briefcase,
  Building2,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  CompanyContactRecord,
  CompanyRecord,
  JobPostingRecord,
} from '@shared/schema';
import { ContactFormCard, ContactLinksBar, normalizeUrl, type ContactDraft } from './ContactFormCard';

interface CompanyPageProps {
  company: CompanyRecord;
  jobs: JobPostingRecord[];
  contacts: CompanyContactRecord[];
  onUpdateCompany: (patch: Partial<Pick<CompanyRecord, 'name' | 'website' | 'notes'>>) => void;
  onDeleteCompany: () => void;
  onSelectJob: (jobId: string) => void;
  onAddRole: () => void;
  onCreateContact: (draft: ContactDraft) => Promise<void>;
  onUpdateContact: (contactId: string, draft: ContactDraft) => Promise<void>;
  onDeleteContact: (contactId: string) => Promise<void>;
}

const inputCls =
  'w-full h-9 px-3 text-sm rounded-lg border border-stone-200 bg-stone-50/60 focus:bg-white focus:border-sky-500 outline-none transition-colors';

export function CompanyPage({
  company,
  jobs,
  contacts,
  onUpdateCompany,
  onDeleteCompany,
  onSelectJob,
  onAddRole,
  onCreateContact,
  onUpdateContact,
  onDeleteContact,
}: CompanyPageProps) {
  const [addingContact, setAddingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-stone-100 overflow-hidden">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-stone-200/90 bg-white px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 border border-sky-200/80 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-stone-900 truncate">{company.name}</h1>
            <div className="text-[11px] text-stone-500">
              {jobs.length} {jobs.length === 1 ? 'role posting' : 'role postings'} ·{' '}
              {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onAddRole}
            className="h-8 px-3 rounded-md bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Role at {company.name}
          </button>
          <button
            type="button"
            onClick={onDeleteCompany}
            className="h-8 px-2.5 rounded-md border border-stone-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-xs font-medium text-stone-500 inline-flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Company Details */}
          <section className="rounded-xl border border-stone-200 bg-white p-5 space-y-4 shadow-2xs">
            <h2 className="text-sm font-bold text-stone-900">Company Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Company Name
                </label>
                <input
                  value={company.name}
                  onChange={(e) => onUpdateCompany({ name: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Website</label>
                <div className="flex items-center gap-1.5">
                  <input
                    value={company.website}
                    onChange={(e) => onUpdateCompany({ website: e.target.value })}
                    placeholder="https://company.com"
                    className={inputCls}
                  />
                  {company.website && (
                    <a
                      href={normalizeUrl(company.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 px-3 shrink-0 rounded-lg border border-stone-200 bg-stone-50 hover:bg-sky-50 hover:border-sky-300 text-xs font-medium text-sky-700 inline-flex items-center gap-1"
                    >
                      Open
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Company Research &amp; Notes
                </label>
                <textarea
                  rows={3}
                  value={company.notes}
                  onChange={(e) => onUpdateCompany({ notes: e.target.value })}
                  placeholder="Product notes, engineering culture, funding stage, shared connections…"
                  className="w-full p-2.5 text-sm rounded-lg border border-stone-200 bg-stone-50/60 focus:bg-white focus:border-sky-500 outline-none resize-y"
                />
              </div>
            </div>
          </section>

          {/* Company Contacts Directory */}
          <section className="rounded-xl border border-stone-200 bg-white p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-700" />
                <div>
                  <h2 className="text-sm font-bold text-stone-900">
                    Company Contacts ({contacts.length})
                  </h2>
                  <p className="text-xs text-stone-500">
                    Recruiters, hiring managers, engineers, and referrals at {company.name}. Link
                    them to specific role postings as Hiring Manager or Decision Maker.
                  </p>
                </div>
              </div>
              {!addingContact && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingContactId(null);
                    setAddingContact(true);
                  }}
                  className="h-8 px-3 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/80 text-xs font-semibold inline-flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Contact
                </button>
              )}
            </div>

            {addingContact && (
              <ContactFormCard
                submitLabel="Add Contact"
                onSubmit={async (draft) => {
                  await onCreateContact(draft);
                  setAddingContact(false);
                }}
                onCancel={() => setAddingContact(false)}
              />
            )}

            {contacts.length === 0 && !addingContact ? (
              <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50/60 py-6 text-center text-xs text-stone-500">
                No contacts saved for {company.name} yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {contacts.map((contact) =>
                  editingContactId === contact.id ? (
                    <ContactFormCard
                      key={contact.id}
                      initial={contact}
                      submitLabel="Save Changes"
                      onSubmit={async (draft) => {
                        await onUpdateContact(contact.id, draft);
                        setEditingContactId(null);
                      }}
                      onCancel={() => setEditingContactId(null)}
                    />
                  ) : (
                    <div
                      key={contact.id}
                      className="rounded-lg border border-stone-200 bg-stone-50/50 p-3.5 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-stone-900">
                              {contact.name}
                            </span>
                            {contact.title && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-stone-200 text-stone-600 font-medium">
                                {contact.title}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setAddingContact(false);
                              setEditingContactId(contact.id);
                            }}
                            title="Edit contact"
                            className="w-7 h-7 rounded inline-flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-white"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete contact "${contact.name}"? They will also be unlinked from any role postings.`
                                )
                              ) {
                                void onDeleteContact(contact.id);
                              }
                            }}
                            title="Delete contact"
                            className="w-7 h-7 rounded inline-flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <ContactLinksBar contact={contact} />

                      {contact.notes && (
                        <p className="text-xs text-stone-600 pt-1 leading-relaxed">
                          {contact.notes}
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* Role Postings at this Company */}
          <section className="rounded-xl border border-stone-200 bg-white p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-sky-700" />
                <h2 className="text-sm font-bold text-stone-900">
                  Role Postings ({jobs.length})
                </h2>
              </div>
            </div>

            {jobs.length === 0 ? (
              <div className="text-xs text-stone-500 py-4 text-center">
                No role postings yet. Click &ldquo;Add Role&rdquo; above to create one.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => onSelectJob(job.id)}
                    className="text-left rounded-lg border border-stone-200 bg-stone-50/50 hover:bg-white hover:border-sky-400 p-3.5 space-y-1.5 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-stone-900 truncate">
                        {job.title}
                      </span>
                      <span className="text-[11px] capitalize px-2 py-0.5 rounded-full bg-white border border-stone-200 text-stone-600 shrink-0">
                        {job.stage}
                      </span>
                    </div>
                    <div className="text-xs text-stone-500 flex items-center gap-2 flex-wrap">
                      {job.location && <span>{job.location}</span>}
                      {job.compensation && <span>· {job.compensation}</span>}
                      {job.contactCount > 0 && (
                        <span>
                          · {job.contactCount} {job.contactCount === 1 ? 'contact' : 'contacts'}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
