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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_profile_id: string | null
          actor_role: Database["public"]["Enums"]["batch_role"] | null
          batch_id: string | null
          detail: Json | null
          id: number
          occurred_at: string
          target_id: string | null
          target_kind: Database["public"]["Enums"]["audit_target_kind"] | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_profile_id?: string | null
          actor_role?: Database["public"]["Enums"]["batch_role"] | null
          batch_id?: string | null
          detail?: Json | null
          id?: never
          occurred_at?: string
          target_id?: string | null
          target_kind?: Database["public"]["Enums"]["audit_target_kind"] | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_profile_id?: string | null
          actor_role?: Database["public"]["Enums"]["batch_role"] | null
          batch_id?: string | null
          detail?: Json | null
          id?: never
          occurred_at?: string
          target_id?: string | null
          target_kind?: Database["public"]["Enums"]["audit_target_kind"] | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_invites: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          revoked_at: string | null
          revoked_by: string | null
          token_hash: string
          updated_at: string
          use_count: number
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash?: string
          updated_at?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "batch_invites_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_invites_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_members: {
        Row: {
          batch_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          invite_id: string | null
          invited_by: string | null
          joined_at: string | null
          profile_id: string
          requested_at: string
          role: Database["public"]["Enums"]["batch_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          invite_id?: string | null
          invited_by?: string | null
          joined_at?: string | null
          profile_id: string
          requested_at?: string
          role?: Database["public"]["Enums"]["batch_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          invite_id?: string | null
          invited_by?: string | null
          joined_at?: string | null
          profile_id?: string
          requested_at?: string
          role?: Database["public"]["Enums"]["batch_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_members_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_members_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_members_invite_id_fkey"
            columns: ["invite_id", "batch_id"]
            isOneToOne: false
            referencedRelation: "batch_invites"
            referencedColumns: ["id", "batch_id"]
          },
          {
            foreignKeyName: "batch_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          course_name: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department_name: string | null
          description: string | null
          graduation_year: number | null
          id: string
          institution_name: string
          join_policy: Database["public"]["Enums"]["join_policy"]
          name: string
          section: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["batch_visibility"]
        }
        Insert: {
          course_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_name?: string | null
          description?: string | null
          graduation_year?: number | null
          id?: string
          institution_name: string
          join_policy?: Database["public"]["Enums"]["join_policy"]
          name: string
          section?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["batch_visibility"]
        }
        Update: {
          course_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_name?: string | null
          description?: string | null
          graduation_year?: number | null
          id?: string
          institution_name?: string
          join_policy?: Database["public"]["Enums"]["join_policy"]
          name?: string
          section?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["batch_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          batch_id: string
          blur_placeholder: string | null
          byte_size: number | null
          client_reported_duration_seconds: number | null
          content_hash: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          memory_id: string | null
          mime_type: string | null
          original_filename: string | null
          position: number
          poster_media_asset_id: string | null
          status: Database["public"]["Enums"]["media_status"]
          storage_bucket: string
          storage_path: string
          updated_at: string
          width: number | null
        }
        Insert: {
          batch_id: string
          blur_placeholder?: string | null
          byte_size?: number | null
          client_reported_duration_seconds?: number | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          height?: number | null
          id?: string
          kind: Database["public"]["Enums"]["media_kind"]
          memory_id?: string | null
          mime_type?: string | null
          original_filename?: string | null
          position?: number
          poster_media_asset_id?: string | null
          status?: Database["public"]["Enums"]["media_status"]
          storage_bucket: string
          storage_path: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          batch_id?: string
          blur_placeholder?: string | null
          byte_size?: number | null
          client_reported_duration_seconds?: number | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          memory_id?: string | null
          mime_type?: string | null
          original_filename?: string | null
          position?: number
          poster_media_asset_id?: string | null
          status?: Database["public"]["Enums"]["media_status"]
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_memory_fkey"
            columns: ["memory_id", "batch_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id", "batch_id"]
          },
          {
            foreignKeyName: "media_assets_poster_fkey"
            columns: ["poster_media_asset_id", "batch_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id", "batch_id"]
          },
        ]
      }
      memories: {
        Row: {
          batch_id: string
          caption: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          event_name: string | null
          id: string
          occurred_on: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          caption?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          event_name?: string | null
          id?: string
          occurred_on: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          caption?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          event_name?: string | null
          id?: string
          occurred_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          batch_id: string
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string | null
          id: string
          memory_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          batch_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          id?: string
          memory_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          batch_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          id?: string
          memory_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_memory_fkey"
            columns: ["memory_id", "batch_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id", "batch_id"]
          },
        ]
      }
      reactions: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          kind: string
          memory_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          kind: string
          memory_id: string
          profile_id?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          kind?: string
          memory_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_memory_fkey"
            columns: ["memory_id", "batch_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id", "batch_id"]
          },
        ]
      }
      reports: {
        Row: {
          batch_id: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_comment_id: string | null
          target_id: string
          target_kind: Database["public"]["Enums"]["report_target_kind"]
          target_member_id: string | null
          target_memory_id: string | null
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_comment_id?: string | null
          target_id: string
          target_kind: Database["public"]["Enums"]["report_target_kind"]
          target_member_id?: string | null
          target_memory_id?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_comment_id?: string | null
          target_id?: string
          target_kind?: Database["public"]["Enums"]["report_target_kind"]
          target_member_id?: string | null
          target_memory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_memory_fkey"
            columns: ["target_memory_id", "batch_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id", "batch_id"]
          },
          {
            foreignKeyName: "reports_target_comment_fkey"
            columns: ["target_comment_id", "batch_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id", "batch_id"]
          },
          {
            foreignKeyName: "reports_target_member_fkey"
            columns: ["target_member_id", "batch_id"]
            isOneToOne: false
            referencedRelation: "batch_members"
            referencedColumns: ["id", "batch_id"]
          },
        ]
      }
      invite_redemption_attempts: {
        Row: {
          attempted_at: string
          id: number
          ip: string | null
          profile_id: string | null
        }
        Insert: {
          attempted_at?: string
          id?: never
          ip?: string | null
          profile_id?: string | null
        }
        Update: {
          attempted_at?: string
          id?: never
          ip?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_redemption_attempts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          onboarding_completed_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          id?: string
          onboarding_completed_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          id?: string
          onboarding_completed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_member: {
        Args: { p_batch_id: string; p_target_profile_id: string }
        Returns: {
          batch_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          invite_id: string | null
          invited_by: string | null
          joined_at: string | null
          profile_id: string
          requested_at: string
          role: Database["public"]["Enums"]["batch_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "batch_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      change_member_role: {
        Args: {
          p_batch_id: string
          p_new_role: Database["public"]["Enums"]["batch_role"]
          p_target_profile_id: string
        }
        Returns: {
          batch_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          invite_id: string | null
          invited_by: string | null
          joined_at: string | null
          profile_id: string
          requested_at: string
          role: Database["public"]["Enums"]["batch_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "batch_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_invite_rate_limit: {
        Args: { p_ip: string | null; p_profile_id: string | null }
        Returns: undefined
      }
      complete_onboarding: {
        Args: never
        Returns: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          onboarding_completed_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_batch: {
        Args: {
          p_course_name?: string
          p_department_name?: string
          p_description?: string
          p_graduation_year?: number
          p_institution_name: string
          p_join_policy?: Database["public"]["Enums"]["join_policy"]
          p_name: string
          p_section?: string
        }
        Returns: {
          course_name: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department_name: string | null
          description: string | null
          graduation_year: number | null
          id: string
          institution_name: string
          join_policy: Database["public"]["Enums"]["join_policy"]
          name: string
          section: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["batch_visibility"]
        }
        SetofOptions: {
          from: "*"
          to: "batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_invite: {
        Args: {
          p_batch_id: string
          p_expires_at?: string | null
          p_max_uses?: number | null
          p_token_hash: string
        }
        Returns: {
          batch_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          revoked_at: string | null
          updated_at: string
          use_count: number
        }[]
      }
      create_report: {
        Args: {
          p_details?: string | null
          p_reason: string
          p_target_id: string
          p_target_kind: Database["public"]["Enums"]["report_target_kind"]
        }
        Returns: {
          batch_id: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_comment_id: string | null
          target_id: string
          target_kind: Database["public"]["Enums"]["report_target_kind"]
          target_member_id: string | null
          target_memory_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_memory: {
        Args: {
          p_caption: string | null
          p_event_name: string | null
          p_media_asset_id: string
          p_occurred_on: string
          p_poster_media_asset_id?: string | null
        }
        Returns: {
          batch_id: string
          caption: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          event_name: string | null
          id: string
          occurred_on: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "memories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      list_audit_log: {
        Args: { p_batch_id: string; p_limit?: number }
        Returns: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_profile_id: string | null
          actor_role: Database["public"]["Enums"]["batch_role"] | null
          batch_id: string | null
          detail: Json | null
          id: number
          occurred_at: string
          target_id: string | null
          target_kind: Database["public"]["Enums"]["audit_target_kind"] | null
        }[]
      }
      list_open_reports: {
        Args: { p_batch_id: string }
        Returns: {
          batch_id: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_comment_id: string | null
          target_id: string
          target_kind: Database["public"]["Enums"]["report_target_kind"]
          target_member_id: string | null
          target_memory_id: string | null
          updated_at: string
        }[]
      }
      list_sweepable_media: {
        Args: { p_grace_seconds?: number }
        Returns: {
          id: string
          status: Database["public"]["Enums"]["media_status"]
          storage_bucket: string
          storage_path: string
        }[]
      }
      my_batch_role: {
        Args: { p_batch_id: string }
        Returns: Database["public"]["Enums"]["batch_role"]
      }
      preallocate_media: {
        Args: {
          p_batch_id: string
          p_client_reported_duration_seconds?: number | null
          p_declared_mime_type: string
          p_declared_size: number
          p_original_filename?: string | null
        }
        Returns: {
          batch_id: string
          blur_placeholder: string | null
          byte_size: number | null
          client_reported_duration_seconds: number | null
          content_hash: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          memory_id: string | null
          mime_type: string | null
          original_filename: string | null
          position: number
          poster_media_asset_id: string | null
          status: Database["public"]["Enums"]["media_status"]
          storage_bucket: string
          storage_path: string
          updated_at: string
          width: number | null
        }
        SetofOptions: {
          from: "*"
          to: "media_assets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      purge_rejected_media: {
        Args: { p_media_asset_id: string }
        Returns: undefined
      }
      purge_swept_media: {
        Args: { p_media_asset_ids: string[] }
        Returns: string[]
      }
      redeem_invite: {
        Args: { p_ip?: string | null; p_token_hash: string }
        Returns: {
          batch_id: string
          batch_name: string
          status: Database["public"]["Enums"]["membership_status"]
        }[]
      }
      reject_member: {
        Args: { p_batch_id: string; p_target_profile_id: string }
        Returns: {
          batch_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          invite_id: string | null
          invited_by: string | null
          joined_at: string | null
          profile_id: string
          requested_at: string
          role: Database["public"]["Enums"]["batch_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "batch_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_content: {
        Args: {
          p_target_id: string
          p_target_kind: Database["public"]["Enums"]["report_target_kind"]
        }
        Returns: undefined
      }
      remove_member: {
        Args: { p_batch_id: string; p_target_profile_id: string }
        Returns: {
          batch_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          invite_id: string | null
          invited_by: string | null
          joined_at: string | null
          profile_id: string
          requested_at: string
          role: Database["public"]["Enums"]["batch_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "batch_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_report: {
        Args: { p_report_id: string; p_resolution_note?: string | null }
        Returns: {
          batch_id: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_comment_id: string | null
          target_id: string
          target_kind: Database["public"]["Enums"]["report_target_kind"]
          target_member_id: string | null
          target_memory_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restore_content: {
        Args: {
          p_target_id: string
          p_target_kind: Database["public"]["Enums"]["report_target_kind"]
        }
        Returns: undefined
      }
      revoke_invite: {
        Args: { p_invite_id: string }
        Returns: {
          batch_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          revoked_at: string | null
          updated_at: string
          use_count: number
        }[]
      }
      set_own_avatar_path: {
        Args: { object_path: string }
        Returns: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          onboarding_completed_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transfer_ownership: {
        Args: { p_batch_id: string; p_new_owner_profile_id: string }
        Returns: {
          batch_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          invite_id: string | null
          invited_by: string | null
          joined_at: string | null
          profile_id: string
          requested_at: string
          role: Database["public"]["Enums"]["batch_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "batch_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_batch_settings: {
        Args: {
          p_batch_id: string
          p_course_name: string
          p_department_name: string
          p_description: string
          p_graduation_year: number
          p_institution_name: string
          p_join_policy: Database["public"]["Enums"]["join_policy"]
          p_name: string
          p_section: string
        }
        Returns: {
          course_name: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department_name: string | null
          description: string | null
          graduation_year: number | null
          id: string
          institution_name: string
          join_policy: Database["public"]["Enums"]["join_policy"]
          name: string
          section: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["batch_visibility"]
        }
        SetofOptions: {
          from: "*"
          to: "batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validate_invite: {
        Args: { p_ip?: string | null; p_token_hash: string }
        Returns: string
      }
    }
    Enums: {
      audit_action:
        | "member_approved"
        | "member_rejected"
        | "member_removed"
        | "member_left"
        | "role_changed"
        | "ownership_transferred"
        | "invite_created"
        | "invite_revoked"
        | "content_removed"
        | "content_restored"
        | "report_resolved"
        | "batch_settings_changed"
        | "batch_deleted"
        | "batch_restored"
      audit_target_kind:
        | "batch"
        | "member"
        | "memory"
        | "comment"
        | "media_asset"
        | "invite"
        | "report"
      batch_role: "member" | "moderator" | "admin" | "owner"
      batch_visibility: "private"
      join_policy: "invite_only_auto_approve" | "invite_only_requires_approval"
      media_kind: "image" | "video"
      media_status: "pending" | "ready" | "rejected"
      membership_status: "pending" | "active" | "rejected" | "removed" | "left"
      report_status: "open" | "resolved"
      report_target_kind: "memory" | "comment" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      audit_action: [
        "member_approved",
        "member_rejected",
        "member_removed",
        "member_left",
        "role_changed",
        "ownership_transferred",
        "invite_created",
        "invite_revoked",
        "content_removed",
        "content_restored",
        "report_resolved",
        "batch_settings_changed",
        "batch_deleted",
        "batch_restored",
      ],
      audit_target_kind: [
        "batch",
        "member",
        "memory",
        "comment",
        "media_asset",
        "invite",
        "report",
      ],
      batch_role: ["member", "moderator", "admin", "owner"],
      batch_visibility: ["private"],
      join_policy: [
        "invite_only_auto_approve",
        "invite_only_requires_approval",
      ],
      media_kind: ["image", "video"],
      media_status: ["pending", "ready", "rejected"],
      membership_status: ["pending", "active", "rejected", "removed", "left"],
      report_status: ["open", "resolved"],
      report_target_kind: ["memory", "comment", "member"],
    },
  },
} as const
