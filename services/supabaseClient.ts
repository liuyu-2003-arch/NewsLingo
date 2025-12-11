import { createClient } from '@supabase/supabase-js';

// Configured with user provided credentials
export const SUPABASE_URL = 'https://olyxfogflklfqowllvzs.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9seXhmb2dmbGtsZnFvd2xsdnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNzczMDcsImV4cCI6MjA4MDk1MzMwN30.J-pRcFNORiS6MRsO57Hn10D_rZf5wvjgx9qYPlymEkE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);