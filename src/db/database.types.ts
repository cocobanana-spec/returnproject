// Supabase 스키마에서 자동 생성한 DB 타입 — 직접 고치지 말고 아래 명령으로 다시 만든다
// npm run gen:types  (supabase gen types typescript --project-id ekcjfqqiopajlcbqgvfo)
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
      entries: {
        Row: {
          amount: number | null
          attended: boolean | null
          co_person_id: string | null
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          ledger_id: string
          memo: string | null
          method: string
          person_id: string
          return_memo: string | null
          returned_at: string | null
          side: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          attended?: boolean | null
          co_person_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          ledger_id: string
          memo?: string | null
          method?: string
          person_id: string
          return_memo?: string | null
          returned_at?: string | null
          side?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          attended?: boolean | null
          co_person_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          ledger_id?: string
          memo?: string | null
          method?: string
          person_id?: string
          return_memo?: string | null
          returned_at?: string | null
          side?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_co_person_id_fkey"
            columns: ["co_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_co_person_id_fkey"
            columns: ["co_person_id"]
            isOneToOne: false
            referencedRelation: "person_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_balances"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          date: string
          date_precision: string
          host_person_id: string | null
          id: string
          is_mine: boolean
          ledger_id: string
          memo: string | null
          place: string | null
          side_a_label: string | null
          side_b_label: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          date_precision?: string
          host_person_id?: string | null
          id?: string
          is_mine?: boolean
          ledger_id: string
          memo?: string | null
          place?: string | null
          side_a_label?: string | null
          side_b_label?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          date_precision?: string
          host_person_id?: string | null
          id?: string
          is_mine?: boolean
          ledger_id?: string
          memo?: string | null
          place?: string | null
          side_a_label?: string | null
          side_b_label?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_host_person_id_fkey"
            columns: ["host_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_host_person_id_fkey"
            columns: ["host_person_id"]
            isOneToOne: false
            referencedRelation: "person_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_members: {
        Row: {
          created_at: string
          display_name: string
          ledger_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          ledger_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          ledger_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_members_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      ledgers: {
        Row: {
          created_at: string
          id: string
          invite_code: string | null
          invite_code_expires_at: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string | null
          invite_code_expires_at?: string | null
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string | null
          invite_code_expires_at?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          ledger_id: string
          memo: string | null
          name: string
          name_normalized: string | null
          phone: string | null
          relation_group: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          ledger_id: string
          memo?: string | null
          name: string
          name_normalized?: string | null
          phone?: string | null
          relation_group?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          ledger_id?: string
          memo?: string | null
          name?: string
          name_normalized?: string | null
          phone?: string | null
          relation_group?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      person_balances: {
        Row: {
          balance: number | null
          entry_count: number | null
          given_total: number | null
          given_unconfirmed: number | null
          id: string | null
          kind: string | null
          label: string | null
          last_entry_at: string | null
          ledger_id: string | null
          name: string | null
          name_normalized: string | null
          received_total: number | null
          received_unconfirmed: number | null
          relation_group: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_invite_code: { Args: { p_ledger_id: string }; Returns: string }
      delete_person: {
        Args: { p_id: string; p_ledger_id: string }
        Returns: undefined
      }
      display_name_of: {
        Args: { p_email: string; p_meta: Json }
        Returns: string
      }
      display_name_of_user: { Args: { p_uid: string }; Returns: string }
      ensure_owner: { Args: { p_ledger_id: string }; Returns: undefined }
      event_summary: {
        Args: { p_event_id: string; p_ledger_id: string }
        Returns: {
          cnt: number
          method: string
          returned: number
          side: string
          total: number
          unconfirmed: number
        }[]
      }
      is_ledger_member: { Args: { l: string }; Returns: boolean }
      is_ledger_owner: { Args: { l: string }; Returns: boolean }
      join_ledger: { Args: { p_code: string }; Returns: string }
      merge_people: {
        Args: { p_ledger_id: string; p_survivor: string; p_victim: string }
        Returns: undefined
      }
      person_stats_by_year: {
        Args: { p_ledger_id: string; p_year?: number }
        Returns: {
          balance: number
          entry_count: number
          given_total: number
          id: string
          name: string
          received_total: number
          relation_group: string
        }[]
      }
      prepare_account_deletion: { Args: never; Returns: undefined }
      random_invite_code: { Args: never; Returns: string }
      remove_member: {
        Args: { p_ledger_id: string; p_user_id: string }
        Returns: undefined
      }
      stats_by_year: {
        Args: { p_ledger_id: string; p_year?: number }
        Returns: {
          cnt: number
          is_mine: boolean
          relation_group: string
          total: number
          type: string
          unconfirmed: number
          year: number
        }[]
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
