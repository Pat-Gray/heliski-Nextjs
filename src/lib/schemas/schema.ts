import { z } from "zod";

// Base schemas for validation
export const areaSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  createdAt: z.date(),
});

export const subAreaSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  areaId: z.string().uuid(),
  createdAt: z.date(),
});

export const runSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  subAreaId: z.string().uuid(),
  runNumber: z.number().int().positive(),
  runDescription: z.string().nullable().optional(),
  runNotes: z.string().nullable().optional(),
  aspect: z.enum(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]),
  elevationMax: z.number().int(),
  elevationMin: z.number().int(),
  status: z.enum(["open", "conditional", "closed"]),
  statusComment: z.string().nullable().optional(),
  gpxPath: z.string().nullable().optional(),
  runPhoto: z.string().nullable().optional(),
  avalanchePhoto: z.string().nullable().optional(),
  additionalPhotos: z.array(z.string()).nullable().default([]),
  // CalTopo integration fields
  caltopoMapId: z.string().nullable().optional(),
  caltopoFeatureId: z.string().nullable().optional(),
  gpxUpdatedAt: z.date().nullable().optional(),
  lastUpdated: z.date(),
  createdAt: z.date(),
});

export const dailyPlanSchema = z.object({
  id: z.string().uuid(),
  planDate: z.date(),
  runIds: z.array(z.string().uuid()),
  statusSnapshot: z.array(z.object({
    runId: z.string().uuid(),
    status: z.enum(["open", "conditional", "closed"]),
    statusComment: z.string().nullable(),
  })),
  notes: z.string().nullable().optional(),
  createdAt: z.date(),
});

export const incidentSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  incidentDate: z.date(),
  trigger: z.enum(["human", "natural", "explosive"]),
  peopleInvolved: z.number().int().min(0),
  snowProfile: z.string().nullable().optional(),
  weatherConditions: z.string().nullable().optional(),
  description: z.string().min(1),
  severity: z.enum(["low", "moderate", "high", "extreme"]),
  photosPaths: z.array(z.string()).default([]),
  createdAt: z.date(),
});

export const userSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1),
  password: z.string().min(1),
});

// Insert schemas (for creating new records)
export const insertAreaSchema = areaSchema.omit({
  id: true,
  createdAt: true,
});

export const insertSubAreaSchema = subAreaSchema.omit({
  id: true,
  createdAt: true,
});

export const insertRunSchema = runSchema.omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
  runNumber: true, // Will be auto-calculated
}).extend({
  runDescription: z.string().optional(),
  runNotes: z.string().optional(),
  statusComment: z.string().nullable().optional(),
  gpxPath: z.string().nullable().optional(),
  runPhoto: z.string().nullable().optional(),
  avalanchePhoto: z.string().nullable().optional(),
  additionalPhotos: z.array(z.string()).nullable().optional().transform(val => val || []),
  caltopoMapId: z.string().nullable().optional(),
  caltopoFeatureId: z.string().nullable().optional(),
  gpxUpdatedAt: z.date().nullable().optional(),
});

export const insertDailyPlanSchema = dailyPlanSchema.omit({
  id: true,
  createdAt: true,
}).extend({
  planDate: z.coerce.date(),
});

export const insertIncidentSchema = incidentSchema.omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = userSchema.omit({
  id: true,
});

// Update schemas (for partial updates)
export const updateRunSchema = z.object({
  name: z.string().optional(),
  subAreaId: z.string().uuid().optional(),
  runNumber: z.number().int().positive().optional(),
  runDescription: z.string().optional(),
  runNotes: z.string().optional(),
  aspect: z.enum(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]).optional(),
  elevationMax: z.number().int().optional(),
  elevationMin: z.number().int().optional(),
  status: z.enum(["open", "conditional", "closed"]).optional(),
  statusComment: z.string().nullable().optional(),
  gpxPath: z.string().optional(),
  runPhoto: z.string().optional(),
  avalanchePhoto: z.string().optional(),
  additionalPhotos: z.array(z.string()).optional(),
  caltopoMapId: z.string().nullable().optional(),
  caltopoFeatureId: z.string().nullable().optional(),
  gpxUpdatedAt: z.date().nullable().optional(),
});

// Types
export type Area = z.infer<typeof areaSchema>;
export type SubArea = z.infer<typeof subAreaSchema>;
export type Run = z.infer<typeof runSchema>;
export type DailyPlan = z.infer<typeof dailyPlanSchema>;
export type Incident = z.infer<typeof incidentSchema>;
export type User = z.infer<typeof userSchema>;

export type InsertArea = z.infer<typeof insertAreaSchema>;
export type InsertSubArea = z.infer<typeof insertSubAreaSchema>;
export type InsertRun = z.infer<typeof insertRunSchema>;
export type InsertDailyPlan = z.infer<typeof insertDailyPlanSchema>;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;