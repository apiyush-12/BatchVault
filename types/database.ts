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
      my_batch_role: {
        Args: { p_batch_id: string }
        Returns: Database["public"]["Enums"]["batch_role"]
      }
      redeem_invite: {
        Args: { p_ip?: string | null; p_token_hash: string }
        Returns: {
          batch_id: string
          batch_name: string
          status: Database["public"]["Enums"]["membership_status"]
        }[]
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
      membership_status: "pending" | "active" | "rejected" | "removed" | "left"
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
      membership_status: ["pending", "active", "rejected", "removed", "left"],
    },
  },
} as const
