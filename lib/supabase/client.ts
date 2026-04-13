import { createBrowserClient } from "@supabase/ssr"

// Client-side can only access NEXT_PUBLIC_ prefixed environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Singleton pattern to avoid multiple GoTrueClient instances
let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client that does nothing when Supabase is not configured
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: "Supabase not configured" } }),
        signUp: async () => ({ data: { user: null, session: null }, error: { message: "Supabase not configured" } }),
        signOut: async () => ({ error: null }),
      },
      from: () => ({
        select: () => ({ data: null, error: null }),
        insert: () => ({ data: null, error: null }),
        update: () => ({ data: null, error: null }),
        delete: () => ({ data: null, error: null }),
      }),
    } as unknown as ReturnType<typeof createBrowserClient>
  }
  
  // Return existing client if already created
  if (client) {
    return client
  }
  
  client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return client
}
