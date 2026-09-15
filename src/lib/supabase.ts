import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a single supabase client for interacting with your database
export const supabase = 
  supabaseUrl && supabaseAnonKey 
    ? createClient(supabaseUrl, supabaseAnonKey) 
    : null;

/**
 * Saves the user's reading position
 */
export async function saveReadingPosition(documentId: string, position: number) {
  if (!supabase) {
    console.warn('Supabase not configured. Skipping save.');
    return;
  }
  
  try {
    const { error } = await supabase
      .from('reading_progress')
      .upsert({ 
        document_id: documentId, 
        scroll_position: position,
        last_read_at: new Date().toISOString()
      }, { onConflict: 'document_id' });
      
    if (error) console.error('Error saving reading position:', error);
  } catch (err) {
    console.error('Failed to save reading position:', err);
  }
}

/**
 * Gets the user's reading position
 */
export async function getReadingPosition(documentId: string): Promise<number | null> {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from('reading_progress')
      .select('scroll_position')
      .eq('document_id', documentId)
      .single();
      
    if (error) {
      if (error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error fetching reading position:', error);
      }
      return null;
    }
    
    return data?.scroll_position || null;
  } catch (err) {
    console.error('Failed to fetch reading position:', err);
    return null;
  }
}
