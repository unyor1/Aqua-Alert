export interface EvacCenter {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
}
// Official evacuation centers should be stored in Supabase.
// The sample list has been removed to avoid showing inaccurate data in the UI.
export const EVAC_CENTERS: EvacCenter[] = [];
