import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type SupabaseEnv = {
  url: string
  anonKey: string
}

let cachedClient: SupabaseClient | null = null

export function getSupabaseEnv(): SupabaseEnv {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !anonKey) {
    throw new Error('Supabase env is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  }
  return { url, anonKey }
}

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient
  const { url, anonKey } = getSupabaseEnv()
  cachedClient = createClient(url, anonKey)
  return cachedClient
}


