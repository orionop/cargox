/**
 * Type declarations for CargoX API Client
 */

// Import response types
export interface ImportResponse {
  success: boolean;
  message: string;
  containers_count?: number;
  items_count?: number;
}

export interface ItemPosition {
  x: number;
  y: number;
  z: number;
}

export interface ItemInContainer {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  weight: number;
  is_placed: boolean;
  container_id: string | null;
  position: ItemPosition | null;
  priority: number;
  preferred_zone?: string;
  expiry_date?: string;
  usage_limit?: number;
  usage_count?: number;
  is_waste: boolean;
}

export interface Container {
  id: string;
  width: number;
  height: number;
  depth: number;
  capacity: number;
  container_type: string;
  zone?: string;
  items: ItemInContainer[];
}

export interface PlacementResult {
  success: boolean;
  message: string;
  containers: Container[];
  unplaced_items: ItemInContainer[];
}

export interface RetrievalPath {
  found: boolean;
  item_id: string;
  path: string[];
  disturbed_items: string[];
  location?: {
    container: string;
    position: ItemPosition;
  };
  retrieval_time: string;
  retrieved_by?: string;
}

export interface TrackedItem {
  id: string;
  name: string;
  usage_count: number;
  usage_limit?: number;
  is_waste: boolean;
  last_retrieved?: string;
  last_retrieved_by?: string;
}

export interface ItemUsageResult {
  success: boolean;
  message: string;
  item: TrackedItem;
}

export interface WasteItem {
  id: string;
  name: string;
  reason: string;
}

export interface WasteIdentificationResult {
  success: boolean;
  message: string;
  waste_items: WasteItem[];
}

export interface WasteReturnMove {
  item_id: string;
  item_name: string;
  weight: number;
  source_container: {
    id: string;
    zone: string;
  };
  target_container: {
    id: string;
    zone: string;
  };
}

export interface WasteReturnPlan {
  success: boolean;
  message: string;
  total_waste_mass: number;
  target_zone: string;
  waste_containers: string[];
  return_plan: WasteReturnMove[];
}

export interface UsageItem {
  id: string;
  name: string;
  old_count: number;
  new_count: number;
  limit: number;
}

export interface ExpiredItem {
  id: string;
  name: string;
  expiry_date: string;
}

export interface SimulationResult {
  success: boolean;
  message: string;
  simulated_date: string;
  used_items: UsageItem[];
  expired_items: ExpiredItem[];
}

export interface LogEntry {
  id: number;
  timestamp: string;
  action: string;
  item_id: string | null;
  container_id: string | null;
  user: string;
  details: string | null;
}

export interface LogsResponse {
  success: boolean;
  count: number;
  logs: LogEntry[];
}

// Function declarations
export function importContainers(file: File): Promise<ImportResponse>;
export function importItems(file: File): Promise<ImportResponse>;
export function placeItems(): Promise<PlacementResult>;
export function retrieveItem(itemId: string): Promise<RetrievalPath>;
export function trackItemUsage(itemId: string, astronaut?: string): Promise<ItemUsageResult>;
export function placeItemAfterUse(itemPlacement: {
  item_id: string;
  container_id: string;
  position_x: number;
  position_y: number;
  position_z: number;
  astronaut?: string;
}): Promise<ItemUsageResult>;
export function getContainers(): Promise<Container[]>;
export function searchItems(searchParams: {
  query?: string;
  zone?: string;
  priority_min?: number;
  priority_max?: number;
  is_waste?: boolean;
  container_id?: string;
}): Promise<ItemInContainer[]>;
export function identifyWaste(): Promise<WasteIdentificationResult>;
export function generateWasteReturnPlan(targetZone?: string): Promise<WasteReturnPlan>;
export function simulateDay(usagePlan?: Record<string, number>): Promise<SimulationResult>;
export function getLogs(filters?: {
  action?: string;
  item_id?: string;
  container_id?: string;
  user?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
}): Promise<LogsResponse>;
export function repackItems(): Promise<PlacementResult>;
export function exportArrangement(): Promise<Blob>;
export function getRearrangementSuggestions(): Promise<{
  full_containers: string[];
  moveable_items_count: number;
  rearrangement_plan: Array<{
    item_id: string;
    item_name: string;
    from_container: string;
    to_container: string;
  }>;
}>;
export function executeRearrangementPlan(rearrangementPlan: Array<{
  item_id: string;
  item_name: string;
  from_container: string;
  to_container: string;
}>): Promise<{
  success: boolean;
  message: string;
  results: Array<{
    item_id: string;
    item_name: string;
    from_container: string;
    to_container: string;
    success: boolean;
    message: string;
  }>;
}>; 