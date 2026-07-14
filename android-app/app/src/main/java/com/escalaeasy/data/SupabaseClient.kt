package com.escalaeasy.data

import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.gotrue.GoTrue
import io.github.jan.supabase.postgrest.Postgrest

// TODO: Replace with your actual Supabase URL and Anon Key
private const val SUPABASE_URL = "https://YOUR_SUPABASE_URL.supabase.co"
private const val SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY"

val supabase = createSupabaseClient(
    supabaseUrl = SUPABASE_URL,
    supabaseKey = SUPABASE_KEY
) {
    install(Postgrest)
    install(GoTrue)
}
