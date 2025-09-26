import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const areas = pgTable("areas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subAreas = pgTable("sub_areas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  areaId: varchar("area_id").notNull().references(() => areas.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const runs = pgTable("runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subAreaId: varchar("sub_area_id").notNull().references(() => subAreas.id),
  runNumber: integer("run_number").notNull().default(1), // Auto-increment within sub-area
  runDescription: text("run_description"), // Optional run description
  runNotes: text("run_notes"), // Optional run notes
  aspect: text("aspect").notNull(), // SW, W, E, NW, etc.
  averageAngle: text("average_angle").notNull(), // ENUM for gradient
  elevationMax: integer("elevation_max").notNull(), // meters
  elevationMin: integer("elevation_min").notNull(), // meters
  status: text("status").notNull().default("open"), // open, conditional, closed
  statusComment: text("status_comment"),
  gpxPath: text("gpx_path"), // GPX file path
  runPhoto: text("run_photo"), // Primary run photo
  avalanchePhoto: text("avalanche_photo"), // Avalanche path photo
  additionalPhotos: json("additional_photos").$type<string[]>().default([]), // Additional images
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dailyPlans = pgTable("daily_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planDate: timestamp("plan_date").notNull(),
  runIds: json("run_ids").$type<string[]>().notNull(),
  statusSnapshot: json("status_snapshot").$type<Array<{ runId: string; status: 'open'|'conditional'|'closed'; statusComment: string|null }>>().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const incidents = pgTable("incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => runs.id),
  incidentDate: timestamp("incident_date").notNull(),
  trigger: text("trigger").notNull(), // human, natural, explosive
  peopleInvolved: integer("people_involved").notNull(),
  snowProfile: text("snow_profile"),
  weatherConditions: text("weather_conditions"),
  description: text("description").notNull(),
  severity: text("severity").notNull(), // low, moderate, high, extreme
  photosPaths: json("photos_paths").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertAreaSchema = createInsertSchema(areas).omit({
  id: true,
  createdAt: true,
});

export const insertSubAreaSchema = createInsertSchema(subAreas).omit({
  id: true,
  createdAt: true,
}).extend({
  areaId: z.string(),
});

export const insertRunSchema = createInsertSchema(runs).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
  runNumber: true, // Remove runNumber from required fields - will be auto-calculated
}).extend({
  status: z.enum(["open", "conditional", "closed"]),
  aspect: z.enum(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]),
  averageAngle: z.enum(["gentle", "moderate", "steep", "very_steep"]),
  runDescription: z.string().optional(),
  runNotes: z.string().optional(),
  statusComment: z.string().nullable().optional(),
  gpxPath: z.string().nullable().optional(),
  runPhoto: z.string().nullable().optional(),
  avalanchePhoto: z.string().nullable().optional(),
  additionalPhotos: z.array(z.string()).nullable().optional().default([]),
});

// Schema for partial updates (without strict validation)
export const updateRunSchema = z.object({
  name: z.string().optional(),
  subAreaId: z.string().optional(),
  runNumber: z.number().optional(),
  runDescription: z.string().optional(),
  runNotes: z.string().optional(),
  aspect: z.enum(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]).optional(),
  averageAngle: z.enum(["gentle", "moderate", "steep", "very_steep"]).optional(),
  elevationMax: z.number().optional(),
  elevationMin: z.number().optional(),
  status: z.enum(["open", "conditional", "closed"]).optional(),
  statusComment: z.string().nullable().optional(),
  gpxPath: z.string().optional(),
  runPhoto: z.string().optional(),
  avalanchePhoto: z.string().optional(),
  additionalPhotos: z.array(z.string()).optional(),
});

export const insertDailyPlanSchema = createInsertSchema(dailyPlans).omit({
  id: true,
  createdAt: true,
}).extend({
  planDate: z.coerce.date(),
  statusSnapshot: z.array(z.object({
    runId: z.string(),
    status: z.enum(["open", "conditional", "closed"]),
    statusComment: z.string().nullable(),
  })),
});

export const insertIncidentSchema = createInsertSchema(incidents).omit({
  id: true,
  createdAt: true,
}).extend({
  trigger: z.enum(["human", "natural", "explosive"]),
  severity: z.enum(["low", "moderate", "high", "extreme"]),
});

// Types
export type Area = typeof areas.$inferSelect;
export type SubArea = typeof subAreas.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type DailyPlan = typeof dailyPlans.$inferSelect;
export type Incident = typeof incidents.$inferSelect;

export type InsertArea = z.infer<typeof insertAreaSchema>;
export type InsertSubArea = z.infer<typeof insertSubAreaSchema>;
export type InsertRun = z.infer<typeof insertRunSchema>;
export type InsertDailyPlan = z.infer<typeof insertDailyPlanSchema>;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;

// Users table (keeping existing)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
