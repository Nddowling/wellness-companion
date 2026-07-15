export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          expires_at: string
          key_hash: string
          request_count: number
          scope: string
          window_started_at: string
        }
        Insert: {
          expires_at: string
          key_hash: string
          request_count?: number
          scope: string
          window_started_at: string
        }
        Update: {
          expires_at?: string
          key_hash?: string
          request_count?: number
          scope?: string
          window_started_at?: string
        }
        Relationships: []
      }
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
          partner_type: string | null
          phone: string | null
          territory: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employer?: string | null
          partner_type?: string | null
          phone?: string | null
          territory?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          employer?: string | null
          partner_type?: string | null
          phone?: string | null
          territory?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_checkout_attempts: {
        Row: {
          billing_cycle: string
          checkout_url: string | null
          created_at: string
          expires_at: string
          facility_id: string
          id: string
          plan: string
          requested_by: string
          status: string
          stripe_session_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle: string
          checkout_url?: string | null
          created_at?: string
          expires_at: string
          facility_id: string
          id?: string
          plan: string
          requested_by: string
          status?: string
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          checkout_url?: string | null
          created_at?: string
          expires_at?: string
          facility_id?: string
          id?: string
          plan?: string
          requested_by?: string
          status?: string
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_checkout_attempts_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          accepts_court_ordered: string | null
          accreditations: string[]
          bd_notes: string | null
          bed_detail: string | null
          carriers_named: string[]
          cash_rate: number | null
          city: string | null
          co_occurring: string | null
          county: string | null
          created_at: string
          description: string | null
          detox_on_site: string | null
          extra_seats: number
          has_beds: string | null
          id: string
          images: string[]
          intake_hours: string | null
          intake_line: string | null
          is_faith_based: boolean
          is_gated: boolean
          is_published: boolean
          last_verified: string | null
          latitude: number | null
          levels_detail: string | null
          levels_of_care: string[]
          license_number: string | null
          longitude: number | null
          main_phone: string | null
          mat_on_site: string | null
          name: string
          npi: string | null
          operator_type: string | null
          payer_confidence: string | null
          payers_detail: string | null
          plan: string
          plan_status: string
          populations_served: string[]
          priority_tier: string | null
          referral_contact: Json
          slug: string | null
          source_url: string | null
          specialties: string[]
          specialty_programs: string | null
          state: string | null
          street: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          verification_confidence: string
          verified_at: string | null
          verified_by: string | null
          videos: string[]
          website: string | null
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
          city?: string | null
          co_occurring?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          detox_on_site?: string | null
          extra_seats?: number
          has_beds?: string | null
          id?: string
          images?: string[]
          intake_hours?: string | null
          intake_line?: string | null
          is_faith_based?: boolean
          is_gated?: boolean
          is_published?: boolean
          last_verified?: string | null
          latitude?: number | null
          levels_detail?: string | null
          levels_of_care?: string[]
          license_number?: string | null
          longitude?: number | null
          main_phone?: string | null
          mat_on_site?: string | null
          name: string
          npi?: string | null
          operator_type?: string | null
          payer_confidence?: string | null
          payers_detail?: string | null
          plan?: string
          plan_status?: string
          populations_served?: string[]
          priority_tier?: string | null
          referral_contact?: Json
          slug?: string | null
          source_url?: string | null
          specialties?: string[]
          specialty_programs?: string | null
          state?: string | null
          street?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          verification_confidence?: string
          verified_at?: string | null
          verified_by?: string | null
          videos?: string[]
          website?: string | null
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
          city?: string | null
          co_occurring?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          detox_on_site?: string | null
          extra_seats?: number
          has_beds?: string | null
          id?: string
          images?: string[]
          intake_hours?: string | null
          intake_line?: string | null
          is_faith_based?: boolean
          is_gated?: boolean
          is_published?: boolean
          last_verified?: string | null
          latitude?: number | null
          levels_detail?: string | null
          levels_of_care?: string[]
          license_number?: string | null
          longitude?: number | null
          main_phone?: string | null
          mat_on_site?: string | null
          name?: string
          npi?: string | null
          operator_type?: string | null
          payer_confidence?: string | null
          payers_detail?: string | null
          plan?: string
          plan_status?: string
          populations_served?: string[]
          priority_tier?: string | null
          referral_contact?: Json
          slug?: string | null
          source_url?: string | null
          specialties?: string[]
          specialty_programs?: string | null
          state?: string | null
          street?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          verification_confidence?: string
          verified_at?: string | null
          verified_by?: string | null
          videos?: string[]
          website?: string | null
          zip?: string | null
          zip3?: string | null
        }
        Relationships: []
      }
      facility_affiliations: {
        Row: {
          created_at: string
          facility_id: string
          id: string
          invited_by: string | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          facility_id: string
          id?: string
          invited_by?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          facility_id?: string
          id?: string
          invited_by?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_affiliations_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
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
          claimant_email: string | null
          claimant_name: string | null
          claimant_phone: string | null
          claimant_title: string | null
          created_at: string
          facility_id: string | null
          facility_name_freetext: string | null
          id: string
          note: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          claimant_email?: string | null
          claimant_name?: string | null
          claimant_phone?: string | null
          claimant_title?: string | null
          created_at?: string
          facility_id?: string | null
          facility_name_freetext?: string | null
          id?: string
          note?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          claimant_email?: string | null
          claimant_name?: string | null
          claimant_phone?: string | null
          claimant_title?: string | null
          created_at?: string
          facility_id?: string | null
          facility_name_freetext?: string | null
          id?: string
          note?: string | null
          status?: string
          user_id?: string | null
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
      facility_events: {
        Row: {
          created_at: string
          event_type: string
          facility_id: string
          id: string
          match_id: string | null
          referrer: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          facility_id: string
          id?: string
          match_id?: string | null
          referrer?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          facility_id?: string
          id?: string
          match_id?: string | null
          referrer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_events_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
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
          source_url: string | null
          verification_confidence: string
        }
        Insert: {
          created_at?: string
          facility_id: string
          id?: string
          in_network?: boolean
          payer_type: string
          source_url?: string | null
          verification_confidence?: string
        }
        Update: {
          created_at?: string
          facility_id?: string
          id?: string
          in_network?: boolean
          payer_type?: string
          source_url?: string | null
          verification_confidence?: string
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
      match_request_keys: {
        Row: {
          created_at: string
          expires_at: string
          key_hash: string
          match_id: string
          payload_hash: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          key_hash: string
          match_id: string
          payload_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          key_hash?: string
          match_id?: string
          payload_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_request_keys_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
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
          position: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          facility_id: string
          id?: string
          match_id: string
          position?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          facility_id?: string
          id?: string
          match_id?: string
          position?: number | null
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
      partner_list_items: {
        Row: {
          created_at: string
          facility_id: string
          list_id: string
          note: string | null
          position: number
        }
        Insert: {
          created_at?: string
          facility_id: string
          list_id: string
          note?: string | null
          position?: number
        }
        Update: {
          created_at?: string
          facility_id?: string
          list_id?: string
          note?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_list_items_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "partner_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_lists: {
        Row: {
          created_at: string
          id: string
          intro: string | null
          owner_id: string
          share_token: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          intro?: string | null
          owner_id: string
          share_token?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          intro?: string | null
          owner_id?: string
          share_token?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      partner_view_history: {
        Row: {
          facility_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          facility_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          facility_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_view_history_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      payers: {
        Row: {
          common: boolean
          created_at: string
          kind: string
          name: string
          payer_type: string
          slug: string
          sort: number
        }
        Insert: {
          common?: boolean
          created_at?: string
          kind: string
          name: string
          payer_type: string
          slug: string
          sort?: number
        }
        Update: {
          common?: boolean
          created_at?: string
          kind?: string
          name?: string
          payer_type?: string
          slug?: string
          sort?: number
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
      provider_lane_membership_archive: {
        Row: {
          archived_at: string
          facility_id: string
          membership_created_at: string
          original_member_id: string
          reason: string
          role: string
          user_id: string
        }
        Insert: {
          archived_at?: string
          facility_id: string
          membership_created_at: string
          original_member_id: string
          reason: string
          role: string
          user_id: string
        }
        Update: {
          archived_at?: string
          facility_id?: string
          membership_created_at?: string
          original_member_id?: string
          reason?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      qa_runs: {
        Row: {
          ci: boolean
          duration_ms: number | null
          failed: number
          failures: Json | null
          id: string
          passed: number
          ran_at: string
          skipped: number
          target_url: string
          total: number
        }
        Insert: {
          ci?: boolean
          duration_ms?: number | null
          failed?: number
          failures?: Json | null
          id?: string
          passed?: number
          ran_at?: string
          skipped?: number
          target_url: string
          total?: number
        }
        Update: {
          ci?: boolean
          duration_ms?: number | null
          failed?: number
          failures?: Json | null
          id?: string
          passed?: number
          ran_at?: string
          skipped?: number
          target_url?: string
          total?: number
        }
        Relationships: []
      }
      rep_invites: {
        Row: {
          created_at: string
          email: string | null
          facility_id: string | null
          id: string
          inviter_id: string
          token: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          facility_id?: string | null
          id?: string
          inviter_id: string
          token: string
        }
        Update: {
          created_at?: string
          email?: string | null
          facility_id?: string | null
          id?: string
          inviter_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_invites_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_profiles: {
        Row: {
          bio: string | null
          created_at: string
          display_name: string
          headline: string | null
          is_public: boolean
          linkedin_url: string | null
          location: string | null
          photo_url: string | null
          slug: string
          specialties: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_name: string
          headline?: string | null
          is_public?: boolean
          linkedin_url?: string | null
          location?: string | null
          photo_url?: string | null
          slug: string
          specialties?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_name?: string
          headline?: string | null
          is_public?: boolean
          linkedin_url?: string | null
          location?: string | null
          photo_url?: string | null
          slug?: string
          specialties?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_subscription_event_state: {
        Row: {
          facility_id: string
          last_event_created: number
          last_event_id: string
          last_event_precedence: number
          subscription_id: string
          updated_at: string
        }
        Insert: {
          facility_id: string
          last_event_created: number
          last_event_id: string
          last_event_precedence: number
          subscription_id: string
          updated_at?: string
        }
        Update: {
          facility_id?: string
          last_event_created?: number
          last_event_id?: string
          last_event_precedence?: number
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_subscription_event_state_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          api_version: string | null
          checkout_attempt_id: string | null
          event_created: number
          event_id: string
          event_type: string
          facility_id: string | null
          livemode: boolean
          object_id: string
          outcome: string | null
          processed_at: string | null
          received_at: string
          status: string
          subscription_id: string | null
        }
        Insert: {
          api_version?: string | null
          checkout_attempt_id?: string | null
          event_created: number
          event_id: string
          event_type: string
          facility_id?: string | null
          livemode: boolean
          object_id: string
          outcome?: string | null
          processed_at?: string | null
          received_at?: string
          status: string
          subscription_id?: string | null
        }
        Update: {
          api_version?: string | null
          checkout_attempt_id?: string | null
          event_created?: number
          event_id?: string
          event_type?: string
          facility_id?: string | null
          livemode?: boolean
          object_id?: string
          outcome?: string | null
          processed_at?: string | null
          received_at?: string
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_webhook_events_checkout_attempt_id_fkey"
            columns: ["checkout_attempt_id"]
            isOneToOne: false
            referencedRelation: "billing_checkout_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_webhook_events_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_consent_events: {
        Row: {
          channel: string
          created_at: string
          granted: boolean
          id: string
          match_id: string | null
          occurred_at: string
          seeker_id: string | null
          source: string
        }
        Insert: {
          channel: string
          created_at?: string
          granted: boolean
          id?: string
          match_id?: string | null
          occurred_at?: string
          seeker_id?: string | null
          source?: string
        }
        Update: {
          channel?: string
          created_at?: string
          granted?: boolean
          id?: string
          match_id?: string | null
          occurred_at?: string
          seeker_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_consent_events_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "vault_seekers"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_conversations: {
        Row: {
          auth_user_id: string | null
          created_at: string
          id: string
          match_id: string | null
          matched_facilities: Json
          messages: Json
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          match_id?: string | null
          matched_facilities?: Json
          messages?: Json
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          match_id?: string | null
          matched_facilities?: Json
          messages?: Json
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_conversations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_email_log: {
        Row: {
          delivery_status: string
          facility_id: string | null
          id: string
          kind: string
          meta: Json
          provider_id: string | null
          seeker_id: string | null
          sent_at: string | null
          to_email: string
        }
        Insert: {
          delivery_status?: string
          facility_id?: string | null
          id?: string
          kind: string
          meta?: Json
          provider_id?: string | null
          seeker_id?: string | null
          sent_at?: string | null
          to_email: string
        }
        Update: {
          delivery_status?: string
          facility_id?: string | null
          id?: string
          kind?: string
          meta?: Json
          provider_id?: string | null
          seeker_id?: string | null
          sent_at?: string | null
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
          email: string | null
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
          email?: string | null
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
          email?: string | null
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
      append_facility_media_url: {
        Args: { p_facility_id: string; p_kind: string; p_url: string }
        Returns: number
      }
      apply_stripe_billing_event: {
        Args: {
          p_api_version: string
          p_checkout_attempt_id: string
          p_customer_id: string
          p_event_created: number
          p_event_id: string
          p_event_type: string
          p_facility_id: string
          p_livemode: boolean
          p_object_id: string
          p_plan: string
          p_plan_status: string
          p_subscription_id: string
        }
        Returns: {
          changed_facility_id: string
          result: string
        }[]
      }
      approve_facility_claim: {
        Args: { p_claim_id: string; p_user_id: string }
        Returns: {
          approved_claim_id: string
          approved_facility_id: string
          approved_user_id: string
        }[]
      }
      complete_connector_handoff: {
        Args: {
          p_consent_email: boolean
          p_consent_share: boolean
          p_email: string
          p_match_id: string
          p_phone: string
        }
        Returns: {
          already_completed: boolean
          consent_email: boolean
          consent_share: boolean
          seeker_id: string
          shared_facility_count: number
        }[]
      }
      consume_anonymous_budget: {
        Args: { p_endpoint: string; p_ip_key: string; p_session_key: string }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      facilities_facet_counts: {
        Args: {
          p_level?: string
          p_open?: boolean
          p_pay?: string
          p_pop?: string
          p_q?: string
          p_region?: string
          p_spec?: string
        }
        Returns: Json
      }
      facilities_in_bounds: {
        Args: {
          p_limit?: number
          p_max_lat: number
          p_max_lng: number
          p_min_lat: number
          p_min_lng: number
          p_olat: number
          p_olng: number
        }
        Returns: {
          city: string
          id: string
          latitude: number
          levels_of_care: string[]
          longitude: number
          miles: number
          name: string
          state: string
          zip: string
        }[]
      }
      facilities_search: {
        Args: {
          p_level?: string
          p_limit?: number
          p_offset?: number
          p_open?: boolean
          p_pay?: string
          p_pop?: string
          p_q?: string
          p_region?: string
          p_spec?: string
        }
        Returns: {
          carriers_named: string[]
          city: string
          facility_capacity: Json
          facility_payers: Json
          id: string
          levels_of_care: string[]
          name: string
          state: string
        }[]
      }
      facilities_search_count: {
        Args: {
          p_level?: string
          p_open?: boolean
          p_pay?: string
          p_pop?: string
          p_q?: string
          p_region?: string
          p_spec?: string
        }
        Returns: number
      }
      facilities_state_counts: {
        Args: never
        Returns: {
          n: number
          state: string
        }[]
      }
      facility_matches_q: {
        Args: { p_facility_id: string; p_q: string }
        Returns: boolean
      }
      finish_treatment_email: {
        Args: {
          p_delivery_status: string
          p_email_log_id: string
          p_provider_id?: string
        }
        Returns: undefined
      }
      match_directory_options: {
        Args: {
          p_care_level: string
          p_concern_category: string
          p_limit?: number
          p_payer_carrier?: string
          p_payer_type: string
          p_region_zip3: string
        }
        Returns: {
          bed_based: boolean
          beds_available: number
          city: string
          freshness: string
          id: string
          level: string
          name: string
          provider_reported: boolean
          referral_contact: Json
          region_match: boolean
          score: number
          state: string
        }[]
      }
      record_directory_match: {
        Args: {
          p_care_level: string
          p_concern_category: string
          p_facility_ids: string[]
          p_payer_type: string
          p_payload_hash: string
          p_region_zip3: string
          p_request_key_hash: string
        }
        Returns: {
          created: boolean
          recorded_facility_ids: string[]
          recorded_match_id: string
        }[]
      }
      remove_facility_media_url: {
        Args: { p_facility_id: string; p_kind: string; p_url: string }
        Returns: boolean
      }
      reserve_treatment_email: {
        Args: { p_seeker_id: string; p_to_email: string }
        Returns: {
          delivery_status: string
          email_log_id: string
          should_send: boolean
        }[]
      }
      revoke_connector_contact: {
        Args: { p_seeker_id: string; p_source?: string }
        Returns: undefined
      }
      replace_facility_insurance: {
        Args: {
          p_carriers_named: string[]
          p_facility_id: string
          p_payer_types: string[]
        }
        Returns: {
          carrier_count: number
          payer_count: number
          updated_facility_id: string
        }[]
      }
      set_facility_affiliation_status: {
        Args: { p_affiliation_id: string; p_status: string }
        Returns: string
      }
      set_provider_lead_status: {
        Args: {
          p_facility_id: string
          p_route_id: string
          p_status: string
        }
        Returns: {
          connected_seeker_count: number
          match_status: string
          route_status: string
          updated_match_id: string
          updated_route_id: string
        }[]
      }
      swap_rep_profile_photo: {
        Args: { p_expected_url: string; p_new_url: string; p_user_id: string }
        Returns: string
      }
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
