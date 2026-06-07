/**
 * Project A ("Core") database types — GENERATED, do not hand-edit.
 *
 * Source: Supabase project `uxykrvungmfzmpzrvebh` (Wellness Companion).
 * Includes the de-identified Core tables AND the locked-down vault_* PHI tables
 * (RLS deny-all → reachable only via the service-role client in vault.ts).
 * Regenerate after every migration:
 *   npx supabase gen types typescript --project-id uxykrvungmfzmpzrvebh > src/types/database.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bd_facility_notes: {
        Row: {
          bd_user_id: string
          body: string
          created_at: string
          facility_id: string
          id: string
          updated_at: string
        }
        Insert: {
          bd_user_id: string
          body: string
          created_at?: string
          facility_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          bd_user_id?: string
          body?: string
          created_at?: string
          facility_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_facility_notes_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_saved_facilities: {
        Row: {
          bd_user_id: string
          created_at: string
          facility_id: string
        }
        Insert: {
          bd_user_id: string
          created_at?: string
          facility_id: string
        }
        Update: {
          bd_user_id?: string
          created_at?: string
          facility_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_saved_facilities_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_users: {
        Row: {
          created_at: string
          employer: string | null
          phone: string | null
          territory: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employer?: string | null
          phone?: string | null
          territory?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          employer?: string | null
          phone?: string | null
          territory?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      facilities: {
        Row: {
          accepts_court_ordered: string | null
          accreditations: string[]
          bd_notes: string | null
          bed_detail: string | null
          carriers_named: string[]
          cash_rate: number | null
          co_occurring: string | null
          detox_on_site: string | null
          has_beds: string | null
          intake_hours: string | null
          intake_line: string | null
          levels_detail: string | null
          main_phone: string | null
          mat_on_site: string | null
          operator_type: string | null
          payer_confidence: string | null
          payers_detail: string | null
          priority_tier: string | null
          specialty_programs: string | null
          city: string | null
          created_at: string
          id: string
          is_faith_based: boolean
          is_gated: boolean
          is_published: boolean
          levels_of_care: string[]
          license_number: string | null
          name: string
          npi: string | null
          extra_seats: number
          plan: string
          plan_status: string
          populations_served: string[]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          referral_contact: Json
          specialties: string[]
          state: string | null
          street: string | null
          updated_at: string
          verified_at: string | null
          website: string | null
          images: string[]
          videos: string[]
          description: string | null
          zip: string | null
          zip3: string | null
        }
        Insert: {
          accepts_court_ordered?: string | null
          accreditations?: string[]
          bd_notes?: string | null
          bed_detail?: string | null
          carriers_named?: string[]
          cash_rate?: number | null
          co_occurring?: string | null
          detox_on_site?: string | null
          has_beds?: string | null
          intake_hours?: string | null
          intake_line?: string | null
          levels_detail?: string | null
          main_phone?: string | null
          mat_on_site?: string | null
          operator_type?: string | null
          payer_confidence?: string | null
          payers_detail?: string | null
          priority_tier?: string | null
          specialty_programs?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_faith_based?: boolean
          is_gated?: boolean
          is_published?: boolean
          levels_of_care?: string[]
          license_number?: string | null
          name: string
          npi?: string | null
          extra_seats?: number
          plan?: string
          plan_status?: string
          populations_served?: string[]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          referral_contact?: Json
          specialties?: string[]
          state?: string | null
          street?: string | null
          updated_at?: string
          verified_at?: string | null
          website?: string | null
          images?: string[]
          videos?: string[]
          description?: string | null
          zip?: string | null
          zip3?: string | null
        }
        Update: {
          accepts_court_ordered?: string | null
          accreditations?: string[]
          bd_notes?: string | null
          bed_detail?: string | null
          carriers_named?: string[]
          cash_rate?: number | null
          co_occurring?: string | null
          detox_on_site?: string | null
          has_beds?: string | null
          intake_hours?: string | null
          intake_line?: string | null
          levels_detail?: string | null
          main_phone?: string | null
          mat_on_site?: string | null
          operator_type?: string | null
          payer_confidence?: string | null
          payers_detail?: string | null
          priority_tier?: string | null
          specialty_programs?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_faith_based?: boolean
          is_gated?: boolean
          is_published?: boolean
          levels_of_care?: string[]
          license_number?: string | null
          name?: string
          npi?: string | null
          extra_seats?: number
          plan?: string
          plan_status?: string
          populations_served?: string[]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          referral_contact?: Json
          specialties?: string[]
          state?: string | null
          street?: string | null
          updated_at?: string
          verified_at?: string | null
          website?: string | null
          images?: string[]
          videos?: string[]
          description?: string | null
          zip?: string | null
          zip3?: string | null
        }
        Relationships: []
      }
      facility_capacity: {
        Row: {
          beds_available: number
          facility_id: string
          id: string
          last_updated: string
          level_of_care: string
          updated_by: string | null
        }
        Insert: {
          beds_available?: number
          facility_id: string
          id?: string
          last_updated?: string
          level_of_care: string
          updated_by?: string | null
        }
        Update: {
          beds_available?: number
          facility_id?: string
          id?: string
          last_updated?: string
          level_of_care?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_capacity_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_claims: {
        Row: {
          created_at: string
          facility_id: string
          id: string
          note: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          facility_id: string
          id?: string
          note?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          facility_id?: string
          id?: string
          note?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_claims_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_clicks: {
        Row: {
          created_at: string
          facility_id: string
          id: string
          match_id: string | null
          referrer: string | null
        }
        Insert: {
          created_at?: string
          facility_id: string
          id?: string
          match_id?: string | null
          referrer?: string | null
        }
        Update: {
          created_at?: string
          facility_id?: string
          id?: string
          match_id?: string | null
          referrer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_clicks_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_clicks_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_members: {
        Row: {
          created_at: string
          facility_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          facility_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          facility_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_members_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_payers: {
        Row: {
          created_at: string
          facility_id: string
          id: string
          in_network: boolean
          payer_type: string
        }
        Insert: {
          created_at?: string
          facility_id: string
          id?: string
          in_network?: boolean
          payer_type: string
        }
        Update: {
          created_at?: string
          facility_id?: string
          id?: string
          in_network?: boolean
          payer_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_payers_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_reviews: {
        Row: {
          author_name: string | null
          body: string
          created_at: string
          facility_id: string
          id: string
          rating: number | null
          status: string
        }
        Insert: {
          author_name?: string | null
          body: string
          created_at?: string
          facility_id: string
          id?: string
          rating?: number | null
          status?: string
        }
        Update: {
          author_name?: string | null
          body?: string
          created_at?: string
          facility_id?: string
          id?: string
          rating?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_reviews_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      match_routes: {
        Row: {
          created_at: string
          facility_id: string
          id: string
          match_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          facility_id: string
          id?: string
          match_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          facility_id?: string
          id?: string
          match_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_routes_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_routes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          bd_user_id: string | null
          care_level_needed: string | null
          concern_category: string | null
          coverage_status: string | null
          created_at: string
          id: string
          payer_type: string | null
          region_zip3: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          bd_user_id?: string | null
          care_level_needed?: string | null
          concern_category?: string | null
          coverage_status?: string | null
          created_at?: string
          id?: string
          payer_type?: string | null
          region_zip3?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          bd_user_id?: string | null
          care_level_needed?: string | null
          concern_category?: string | null
          coverage_status?: string | null
          created_at?: string
          id?: string
          payer_type?: string | null
          region_zip3?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vault_email_log: {
        Row: {
          facility_id: string | null
          id: string
          kind: string
          meta: Json
          provider_id: string | null
          seeker_id: string | null
          sent_at: string
          to_email: string
        }
        Insert: {
          facility_id?: string | null
          id?: string
          kind: string
          meta?: Json
          provider_id?: string | null
          seeker_id?: string | null
          sent_at?: string
          to_email: string
        }
        Update: {
          facility_id?: string | null
          id?: string
          kind?: string
          meta?: Json
          provider_id?: string | null
          seeker_id?: string | null
          sent_at?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_email_log_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_email_log_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "vault_seekers"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_seeker_interest: {
        Row: {
          created_at: string
          facility_id: string
          id: string
          info_sent_at: string | null
          match_id: string | null
          seeker_id: string
        }
        Insert: {
          created_at?: string
          facility_id: string
          id?: string
          info_sent_at?: string | null
          match_id?: string | null
          seeker_id: string
        }
        Update: {
          created_at?: string
          facility_id?: string
          id?: string
          info_sent_at?: string | null
          match_id?: string | null
          seeker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_seeker_interest_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_seeker_interest_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_seeker_interest_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "vault_seekers"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_seekers: {
        Row: {
          auth_user_id: string | null
          consent_at: string | null
          consent_email: boolean
          consent_share: boolean
          coverage_status: string | null
          created_at: string
          dob: string | null
          email: string | null
          face_sheet: Json
          id: string
          insurance: string | null
          last_reminded_at: string | null
          match_id: string | null
          name: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          consent_at?: string | null
          consent_email?: boolean
          consent_share?: boolean
          coverage_status?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          face_sheet?: Json
          id?: string
          insurance?: string | null
          last_reminded_at?: string | null
          match_id?: string | null
          name?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          consent_at?: string | null
          consent_email?: boolean
          consent_share?: boolean
          coverage_status?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          face_sheet?: Json
          id?: string
          insurance?: string | null
          last_reminded_at?: string | null
          match_id?: string | null
          name?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_seekers_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      facility_is_published: { Args: { fid: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_bd: { Args: never; Returns: boolean }
      is_facility_member: { Args: { fid: string }; Returns: boolean }
      is_match_routed_to_me: { Args: { mid: string }; Returns: boolean }
      owns_match: { Args: { mid: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
