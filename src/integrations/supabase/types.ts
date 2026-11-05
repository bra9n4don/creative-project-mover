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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      hub_agent_keys: {
        Row: {
          client_id: string
          expires_at: string
          hash: string
          last_seen: string | null
          owner_id: string
          prefix: string
        }
        Insert: {
          client_id: string
          expires_at: string
          hash: string
          last_seen?: string | null
          owner_id: string
          prefix: string
        }
        Update: {
          client_id?: string
          expires_at?: string
          hash?: string
          last_seen?: string | null
          owner_id?: string
          prefix?: string
        }
        Relationships: []
      }
      hub_link_codes: {
        Row: {
          code_hash: string
          created_at: string
          expires_at: string
          owner_id: string
          used_at: string | null
        }
        Insert: {
          code_hash: string
          created_at?: string
          expires_at: string
          owner_id: string
          used_at?: string | null
        }
        Update: {
          code_hash?: string
          created_at?: string
          expires_at?: string
          owner_id?: string
          used_at?: string | null
        }
        Relationships: []
      }
      hub_linked_logins: {
        Row: {
          email: string | null
          linked_at: string
          owner_id: string
          provider: string | null
          user_id: string
        }
        Insert: {
          email?: string | null
          linked_at?: string
          owner_id: string
          provider?: string | null
          user_id: string
        }
        Update: {
          email?: string | null
          linked_at?: string
          owner_id?: string
          provider?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hub_owner: {
        Row: {
          backup_repo: string | null
          backup_shas: Json
          created_at: string
          github_sync_enabled: boolean
          id: string
          last_backup_at: string | null
          last_backup_message: string | null
          last_backup_ok: boolean | null
          last_sync_at: string | null
          last_sync_message: string | null
          last_sync_ok: boolean | null
          last_sync_trigger: string | null
          theme_prefs: Json | null
          tour_completed_at: string | null
          user_id: string
        }
        Insert: {
          backup_repo?: string | null
          backup_shas?: Json
          created_at?: string
          github_sync_enabled?: boolean
          id?: string
          last_backup_at?: string | null
          last_backup_message?: string | null
          last_backup_ok?: boolean | null
          last_sync_at?: string | null
          last_sync_message?: string | null
          last_sync_ok?: boolean | null
          last_sync_trigger?: string | null
          theme_prefs?: Json | null
          tour_completed_at?: string | null
          user_id: string
        }
        Update: {
          backup_repo?: string | null
          backup_shas?: Json
          created_at?: string
          github_sync_enabled?: boolean
          id?: string
          last_backup_at?: string | null
          last_backup_message?: string | null
          last_backup_ok?: boolean | null
          last_sync_at?: string | null
          last_sync_message?: string | null
          last_sync_ok?: boolean | null
          last_sync_trigger?: string | null
          theme_prefs?: Json | null
          tour_completed_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hub_workspaces: {
        Row: {
          data: Json
          owner_id: string
          rev: number
          updated_at: string
        }
        Insert: {
          data: Json
          owner_id: string
          rev?: number
          updated_at?: string
        }
        Update: {
          data?: Json
          owner_id?: string
          rev?: number
          updated_at?: string
        }
        Relationships: []
      }
      legacy_user_map: {
        Row: {
          auth_user_id: string | null
          email: string
          legacy_user_id: string
          linked_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          email: string
          legacy_user_id: string
          linked_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          email?: string
          legacy_user_id?: string
          linked_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_hub: { Args: never; Returns: boolean }
      create_link_code: { Args: never; Returns: string }
      hub_is_claimed: { Args: never; Returns: boolean }
      hub_oauth_client_name: { Args: { _client_id: string }; Returns: string }
      hub_owner_uid: { Args: never; Returns: string }
      is_hub_owner: { Args: { _uid: string }; Returns: boolean }
      list_hub_logins: {
        Args: never
        Returns: {
          email: string
          is_current: boolean
          is_primary: boolean
          linked_at: string
          provider: string
          user_id: string
        }[]
      }
      make_primary_login: { Args: { _user_id: string }; Returns: boolean }
      redeem_link_code: { Args: { _code: string }; Returns: boolean }
      unlink_login: { Args: { _user_id: string }; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
