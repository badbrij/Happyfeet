import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://esvvzgstcxyoiswchqyk.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzdnZ6Z3N0Y3h5b2lzd2NocXlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjYxNDE4NCwiZXhwIjoyMTAyMTkwMTg0fQ.NB4zqYGGr0gFr8s_ptC_fonxtBtTO-cq_C4FKVR5pGQ';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.warn('ℹ️ Using default Supabase configuration for BadaKadam production deployment.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
