import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const resumes = sqliteTable('resumes', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  dataJson: text('data_json').notNull(),
  configJson: text('config_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const coverLetters = sqliteTable('cover_letters', {
  id: text('id').primaryKey(),
  resumeId: text('resume_id')
    .notNull()
    .references(() => resumes.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  company: text('company').notNull().default(''),
  bodyMarkdown: text('body_markdown').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const recommendationLetters = sqliteTable('recommendation_letters', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  authorName: text('author_name').notNull().default(''),
  authorTitle: text('author_title').notNull().default(''),
  originalFilename: text('original_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  pageCount: integer('page_count').notNull().default(1),
  storagePath: text('storage_path').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const documentAttachments = sqliteTable('document_attachments', {
  id: text('id').primaryKey(),
  targetType: text('target_type').notNull(), // 'resume' | 'cover_letter'
  targetId: text('target_id').notNull(),
  letterId: text('letter_id')
    .notNull()
    .references(() => recommendationLetters.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export type ResumeRow = typeof resumes.$inferSelect;
export type CoverLetterRow = typeof coverLetters.$inferSelect;
export type RecommendationLetterRow = typeof recommendationLetters.$inferSelect;
export type DocumentAttachmentRow = typeof documentAttachments.$inferSelect;
