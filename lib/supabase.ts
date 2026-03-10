// Archivo: C:\Users\usuario\freight-tracking\lib\supabase.ts
// Descripcion: Este archivo forma parte de la logica principal de la aplicacion.

import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://wmzafpkrmyhxbvymdjgu.supabase.co'
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtemFmcGtybXloeGJ2eW1kamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDQxNjAsImV4cCI6MjA4NTAyMDE2MH0.RUlK8QD8OOTF0NLkr7EnhH_p9CRI5E7j7o1TQpNEa1w'

const supabaseOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
}

// Evita múltiples instancias en el mismo navegador (HMR/dev)
const globalForSupabase = globalThis as unknown as {
  supabase?: SupabaseClient
}

export const supabase =
  globalForSupabase.supabase ??
  createClient(supabaseUrl, supabaseAnonKey, supabaseOptions)

globalForSupabase.supabase = supabase

