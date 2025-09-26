import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a function to validate environment variables at runtime
function validateSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables:', {
      supabaseUrl: supabaseUrl ? 'Set' : 'Missing',
      supabaseAnonKey: supabaseAnonKey ? 'Set' : 'Missing'
    });
    throw new Error('Missing required Supabase environment variables');
  }
}

// Only validate during runtime, not during build
if (typeof window !== 'undefined' || process.env.NODE_ENV === 'development') {
  validateSupabaseConfig();
}

// Create client with fallback values for build time
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Database helper functions
export async function getAreas() {
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  // Convert snake_case to camelCase for frontend
  return data.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    createdAt: item.created_at,
  }));
}

export async function getSubAreas() {
  const { data, error } = await supabase
    .from('sub_areas')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  // Convert snake_case to camelCase for frontend
  return data.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    areaId: item.area_id, // Convert area_id to areaId
    createdAt: item.created_at,
  }));
}

export async function getRuns() {
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  // Convert snake_case to camelCase for frontend
  return data.map(item => ({
    id: item.id,
    name: item.name,
    subAreaId: item.sub_area_id, // Convert sub_area_id to subAreaId
    runNumber: item.run_number, // Convert run_number to runNumber
    aspect: item.aspect,
    averageAngle: item.average_angle, // Convert average_angle to averageAngle
    elevationMax: item.elevation_max, // Convert elevation_max to elevationMax
    elevationMin: item.elevation_min, // Convert elevation_min to elevationMin
    status: item.status,
    statusComment: item.status_comment, // Convert status_comment to statusComment
    gpxPath: item.gpx_path, // Convert gpx_path to gpxPath
    runPhoto: item.run_photo, // Convert run_photo to runPhoto
    avalanchePhoto: item.avalanche_photo, // Convert avalanche_photo to avalanchePhoto
    additionalPhotos: item.additional_photos, // Convert additional_photos to additionalPhotos
    lastUpdated: item.last_updated,
    createdAt: item.created_at,
  }));
}

export async function getDailyPlans() {
  const { data, error } = await supabase
    .from('daily_plans')
    .select('*')
    .order('plan_date', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function getDailyPlanById(id: string) {
  const { data, error } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data;
}

export async function getDailyPlanByDate(date: string) {
  const { data, error } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('plan_date', date)
    .maybeSingle();
  
  if (error) throw error;
  return data; // Returns null if no plan found
}

// Create functions
export async function createArea(area: { name: string; description?: string | null }) {
  const { data, error } = await supabase
    .from('areas')
    .insert(area)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createSubArea(subArea: { name: string; description?: string | null; areaId: string }) {
  // Convert camelCase to snake_case for database
  const dbData = {
    name: subArea.name,
    description: subArea.description,
    area_id: subArea.areaId, // Convert areaId to area_id
  };
  
  const { data, error } = await supabase
    .from('sub_areas')
    .insert(dbData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createRun(run: {
  name: string;
  subAreaId: string;
  runNumber: number;
  aspect: string;
  averageAngle: string;
  elevationMax: number;
  elevationMin: number;
  status?: string;
  statusComment?: string;
  gpxPath?: string;
  runPhoto?: string;
  avalanchePhoto?: string;
  additionalPhotos?: string[];
}) {
  // Convert camelCase to snake_case for database
  const dbData = {
    name: run.name,
    sub_area_id: run.subAreaId, // Convert subAreaId to sub_area_id
    run_number: run.runNumber, // Convert runNumber to run_number
    aspect: run.aspect,
    average_angle: run.averageAngle, // Convert averageAngle to average_angle
    elevation_max: run.elevationMax, // Convert elevationMax to elevation_max
    elevation_min: run.elevationMin, // Convert elevationMin to elevation_min
    status: run.status,
    status_comment: run.statusComment, // Convert statusComment to status_comment
    gpx_path: run.gpxPath, // Convert gpxPath to gpx_path
    run_photo: run.runPhoto, // Convert runPhoto to run_photo
    avalanche_photo: run.avalanchePhoto, // Convert avalanchePhoto to avalanche_photo
    additional_photos: run.additionalPhotos, // Convert additionalPhotos to additional_photos
  };
  
  const { data, error } = await supabase
    .from('runs')
    .insert(dbData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createDailyPlan(plan: {
  planDate: string | Date;
  runIds: string[];
  statusSnapshot: Record<string, unknown> | Array<{ runId: string; status: string; statusComment: string | null }>;
  notes?: string | null;
}) {
  // Convert camelCase to snake_case for database
  const dbPlan = {
    plan_date: plan.planDate,
    run_ids: plan.runIds,
    status_snapshot: plan.statusSnapshot,
    notes: plan.notes
  };

  const { data, error } = await supabase
    .from('daily_plans')
    .insert(dbPlan)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Update functions
export async function updateArea(id: string, updates: Partial<{ name: string; description: string }>) {
  const { data, error } = await supabase
    .from('areas')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateSubArea(id: string, updates: Partial<{ name: string; description: string; areaId: string }>) {
  const { data, error } = await supabase
    .from('sub_areas')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateRun(id: string, updates: Partial<{
  name: string;
  subAreaId: string;
  runNumber: number;
  aspect: string;
  averageAngle: string;
  elevationMax: number;
  elevationMin: number;
  status: string;
  statusComment: string | null;
  gpxPath: string;
  runPhoto: string;
  avalanchePhoto: string;
  additionalPhotos: string[];
}>) {
  console.log('🔄 Updating run in database:', { id, updates });
  
  // Convert camelCase to snake_case for database
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.subAreaId !== undefined) dbUpdates.sub_area_id = updates.subAreaId;
  if (updates.runNumber !== undefined) dbUpdates.run_number = updates.runNumber;
  if (updates.aspect !== undefined) dbUpdates.aspect = updates.aspect;
  if (updates.averageAngle !== undefined) dbUpdates.average_angle = updates.averageAngle;
  if (updates.elevationMax !== undefined) dbUpdates.elevation_max = updates.elevationMax;
  if (updates.elevationMin !== undefined) dbUpdates.elevation_min = updates.elevationMin;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.statusComment !== undefined) dbUpdates.status_comment = updates.statusComment;
  if (updates.gpxPath !== undefined) dbUpdates.gpx_path = updates.gpxPath;
  if (updates.runPhoto !== undefined) dbUpdates.run_photo = updates.runPhoto;
  if (updates.avalanchePhoto !== undefined) dbUpdates.avalanche_photo = updates.avalanchePhoto;
  if (updates.additionalPhotos !== undefined) dbUpdates.additional_photos = updates.additionalPhotos;
  
  console.log('🔄 Converted updates for database:', dbUpdates);
  
  const { data, error } = await supabase
    .from('runs')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('❌ Supabase update error:', error);
    throw new Error(`Database update failed: ${error.message}`);
  }
  
  console.log('✅ Run updated in database:', data);
  return data;
}

export async function updateDailyPlan(id: string, updates: Partial<{
  planDate: string;
  runIds: string[];
  statusSnapshot: Record<string, unknown>;
  notes: string;
}>) {
  // Convert camelCase to snake_case for database
  const dbUpdates: Record<string, unknown> = {};
  if (updates.planDate !== undefined) dbUpdates.plan_date = updates.planDate;
  if (updates.runIds !== undefined) dbUpdates.run_ids = updates.runIds;
  if (updates.statusSnapshot !== undefined) dbUpdates.status_snapshot = updates.statusSnapshot;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

  const { data, error } = await supabase
    .from('daily_plans')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Delete functions
export async function deleteArea(id: string) {
  const { error } = await supabase
    .from('areas')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return { success: true };
}

export async function deleteSubArea(id: string) {
  const { error } = await supabase
    .from('sub_areas')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return { success: true };
}

export async function deleteRun(id: string) {
  const { error } = await supabase
    .from('runs')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return { success: true };
}

export async function deleteDailyPlan(id: string) {
  const { error } = await supabase
    .from('daily_plans')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return { success: true };
}

export async function deleteFile(bucket: string, path: string) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);
  
  if (error) throw error;
  return { success: true };
}