// schema.ts
import {
	pgTable,
	uuid,
	varchar,
	text,
	integer,
	timestamp,
	index,
	uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Visitors
export const visitors = pgTable(
	'visitors',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		email: varchar('email', { length: 255 }).notNull(),
		name: varchar('name', { length: 255 }).notNull(),
		subscribedAt: timestamp('subscribed_at', { withTimezone: true, mode: 'date' }),
	},
	(table) => ({
		emailUnique: uniqueIndex('visitors_email_unique').on(table.email),
	})
);

// Achievements
export const achievements = pgTable(
	'achievements',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		title: varchar('title', { length: 255 }).notNull(),
		year: integer('year').notNull(),
		description: text('description').notNull(),
		category: varchar('category', { length: 255 }).notNull(),
	},
	(table) => ({
		yearIdx: index('achievements_year_idx').on(table.year),
		categoryIdx: index('achievements_category_idx').on(table.category),
	})
);

// Gallery
export const gallery = pgTable(
	'gallery',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		imageUrl: varchar('image_url', { length: 2048 }).notNull(),
		caption: varchar('caption', { length: 500 }),
		year: integer('year').notNull(),
	},
	(table) => ({
		yearIdx: index('gallery_year_idx').on(table.year),
	})
);

// Messages
export const messages = pgTable(
	'messages',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		visitorId: uuid('visitor_id')
			.notNull()
			.references(() => visitors.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		subject: varchar('subject', { length: 255 }).notNull(),
		content: text('content').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
			.notNull()
			.defaultNow(),
	},
	(table) => ({
		visitorIdx: index('messages_visitor_id_idx').on(table.visitorId),
		createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
	})
);

// Relations
export const visitorsRelations = relations(visitors, ({ many }) => ({
	messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
	visitor: one(visitors, {
		fields: [messages.visitorId],
		references: [visitors.id],
	}),
}));