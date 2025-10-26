import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - Firebase authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  photoURL: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Projects table - Apps created by users
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  s3Prefix: text("s3_prefix"), // Folder path in S3 bucket for this project
  sandboxId: text("sandbox_id"), // E2B sandbox ID
  sandboxUrl: text("sandbox_url"), // E2B sandbox preview URL
  workflowCommand: text("workflow_command"), // Command to run when sandbox is created (e.g., "npm run dev")
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Files table - Track files stored in S3 for each project
export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  path: text("path").notNull(), // File path relative to project root
  s3Key: text("s3_key").notNull(), // Full S3 key
  size: integer("size"), // File size in bytes
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Chat messages table
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  toolCalls: jsonb("tool_calls"), // AI MCP tool calls metadata
  actions: jsonb("actions"), // Real-time action steps the AI performs
  attachments: jsonb("attachments"), // Image/file attachments (URLs to S3)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  files: many(files),
  messages: many(messages),
}));

export const filesRelations = relations(files, ({ one }) => ({
  project: one(projects, {
    fields: [files.projectId],
    references: [projects.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  project: one(projects, {
    fields: [messages.projectId],
    references: [projects.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const updateProjectSchema = insertProjectSchema.partial();
export const updateFileSchema = insertFileSchema.partial();

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;

export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type UpdateFile = z.infer<typeof updateFileSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
