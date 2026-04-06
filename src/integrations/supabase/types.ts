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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cmh_sync_snapshots: {
        Row: {
          created_at: string
          data: Json
          id: string
          org_id: string
          snapshot_type: string
          synced_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          org_id: string
          snapshot_type: string
          synced_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          org_id?: string
          snapshot_type?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmh_sync_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_churn_scores: {
        Row: {
          calculated_at: string
          churn_probability: number
          churn_reasons: Json
          churn_risk_band: string
          created_at: string
          customer_key: string
          id: string
          org_id: string
          source_table: string | null
          updated_at: string
        }
        Insert: {
          calculated_at?: string
          churn_probability?: number
          churn_reasons?: Json
          churn_risk_band?: string
          created_at?: string
          customer_key: string
          id?: string
          org_id: string
          source_table?: string | null
          updated_at?: string
        }
        Update: {
          calculated_at?: string
          churn_probability?: number
          churn_reasons?: Json
          churn_risk_band?: string
          created_at?: string
          customer_key?: string
          id?: string
          org_id?: string
          source_table?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_churn_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_rfm_scores: {
        Row: {
          calculated_at: string
          created_at: string
          customer_email: string | null
          customer_key: string
          customer_name: string | null
          f_score: number
          frequency: number
          id: string
          m_score: number
          monetary: number
          org_id: string
          r_score: number
          recency_days: number
          rfm_score: string
          rfm_segment: string
          source_table: string | null
          updated_at: string
        }
        Insert: {
          calculated_at?: string
          created_at?: string
          customer_email?: string | null
          customer_key: string
          customer_name?: string | null
          f_score: number
          frequency?: number
          id?: string
          m_score: number
          monetary?: number
          org_id: string
          r_score: number
          recency_days?: number
          rfm_score: string
          rfm_segment: string
          source_table?: string | null
          updated_at?: string
        }
        Update: {
          calculated_at?: string
          created_at?: string
          customer_email?: string | null
          customer_key?: string
          customer_name?: string | null
          f_score?: number
          frequency?: number
          id?: string
          m_score?: number
          monetary?: number
          org_id?: string
          r_score?: number
          recency_days?: number
          rfm_score?: string
          rfm_segment?: string
          source_table?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_rfm_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_templates: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          plan: number
          preview_image_url: string | null
          updated_at: string | null
          usage_count: number | null
          widgets: Json
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          plan?: number
          preview_image_url?: string | null
          updated_at?: string | null
          usage_count?: number | null
          widgets?: Json
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          plan?: number
          preview_image_url?: string | null
          updated_at?: string | null
          usage_count?: number | null
          widgets?: Json
        }
        Relationships: []
      }
      dashboard_widgets: {
        Row: {
          config: Json
          created_at: string
          dashboard_id: string
          description: string | null
          id: string
          is_visible: boolean | null
          position: number
          size: string | null
          title: string
          type: Database["public"]["Enums"]["widget_type"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          dashboard_id: string
          description?: string | null
          id?: string
          is_visible?: boolean | null
          position?: number
          size?: string | null
          title: string
          type: Database["public"]["Enums"]["widget_type"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          dashboard_id?: string
          description?: string | null
          id?: string
          is_visible?: boolean | null
          position?: number
          size?: string | null
          title?: string
          type?: Database["public"]["Enums"]["widget_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widgets_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboards: {
        Row: {
          created_at: string
          description: string | null
          filters: Json | null
          id: string
          is_default: boolean | null
          layout: Json | null
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filters?: Json | null
          id?: string
          is_default?: boolean | null
          layout?: Json | null
          name?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filters?: Json | null
          id?: string
          is_default?: boolean | null
          layout?: Json | null
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_mappings: {
        Row: {
          created_at: string
          id: string
          integration_id: string
          org_id: string
          source_column: string
          source_table: string
          target_metric: string
          transform_config: Json | null
          transform_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          integration_id: string
          org_id: string
          source_column: string
          source_table: string
          target_metric: string
          transform_config?: Json | null
          transform_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          integration_id?: string
          org_id?: string
          source_column?: string
          source_table?: string
          target_metric?: string
          transform_config?: Json | null
          transform_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_mappings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          id: string
          last_sync_at: string | null
          name: string
          org_id: string
          status: Database["public"]["Enums"]["integration_status"]
          sync_error: string | null
          type: Database["public"]["Enums"]["integration_type"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          last_sync_at?: string | null
          name: string
          org_id: string
          status?: Database["public"]["Enums"]["integration_status"]
          sync_error?: string | null
          type: Database["public"]["Enums"]["integration_type"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          last_sync_at?: string | null
          name?: string
          org_id?: string
          status?: Database["public"]["Enums"]["integration_status"]
          sync_error?: string | null
          type?: Database["public"]["Enums"]["integration_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company: string | null
          converted_at: string | null
          created_at: string
          email: string | null
          external_id: string | null
          id: string
          integration_id: string | null
          metadata: Json | null
          name: string
          org_id: string
          phone: string | null
          source: Database["public"]["Enums"]["lead_source"] | null
          status: Database["public"]["Enums"]["lead_status"] | null
          updated_at: string
          value: number | null
        }
        Insert: {
          company?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          integration_id?: string | null
          metadata?: Json | null
          name: string
          org_id: string
          phone?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          company?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          integration_id?: string | null
          metadata?: Json | null
          name?: string
          org_id?: string
          phone?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          admin_email: string | null
          admin_name: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          plan: number
          primary_color: string | null
          settings: Json | null
          slug: string
          status: Database["public"]["Enums"]["org_status"]
          updated_at: string
        }
        Insert: {
          admin_email?: string | null
          admin_name?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          plan?: number
          primary_color?: string | null
          settings?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["org_status"]
          updated_at?: string
        }
        Update: {
          admin_email?: string | null
          admin_name?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          plan?: number
          primary_color?: string | null
          settings?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["org_status"]
          updated_at?: string
        }
        Relationships: []
      }
      ploomes_sync_snapshots: {
        Row: {
          created_at: string
          data: Json
          id: string
          org_id: string
          snapshot_type: string
          synced_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          org_id: string
          snapshot_type: string
          synced_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          org_id?: string
          snapshot_type?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ploomes_sync_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          org_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          org_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          org_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_custom_metrics: {
        Row: {
          created_at: string | null
          description: string | null
          display_label: string
          id: string
          metric_name: string
          org_id: string | null
          transformation: string | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_label: string
          id?: string
          metric_name: string
          org_id?: string | null
          transformation?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_label?: string
          id?: string
          metric_name?: string
          org_id?: string | null
          transformation?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_custom_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      selected_tables: {
        Row: {
          column_types: Json | null
          created_at: string
          id: string
          integration_id: string
          is_primary: boolean | null
          row_count: number | null
          sample_data: Json | null
          selected_columns: string[]
          table_name: string
        }
        Insert: {
          column_types?: Json | null
          created_at?: string
          id?: string
          integration_id: string
          is_primary?: boolean | null
          row_count?: number | null
          sample_data?: Json | null
          selected_columns?: string[]
          table_name: string
        }
        Update: {
          column_types?: Json | null
          created_at?: string
          id?: string
          integration_id?: string
          is_primary?: boolean | null
          row_count?: number | null
          sample_data?: Json | null
          selected_columns?: string[]
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "selected_tables_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "platform_admin" | "client_admin" | "analyst" | "viewer"
      integration_status: "pending" | "connected" | "error" | "syncing"
      integration_type: "supabase" | "google_sheets" | "csv" | "api"
      lead_source:
        | "google_ads"
        | "linkedin"
        | "referral"
        | "organic"
        | "email"
        | "other"
      lead_status:
        | "new"
        | "qualified"
        | "in_analysis"
        | "proposal"
        | "converted"
        | "lost"
      org_status: "active" | "suspended" | "trial"
      widget_type:
        | "metric_card"
        | "area_chart"
        | "bar_chart"
        | "line_chart"
        | "pie_chart"
        | "funnel"
        | "table"
        | "insight_card"
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
    Enums: {
      app_role: ["platform_admin", "client_admin", "analyst", "viewer"],
      integration_status: ["pending", "connected", "error", "syncing"],
      integration_type: ["supabase", "google_sheets", "csv", "api"],
      lead_source: [
        "google_ads",
        "linkedin",
        "referral",
        "organic",
        "email",
        "other",
      ],
      lead_status: [
        "new",
        "qualified",
        "in_analysis",
        "proposal",
        "converted",
        "lost",
      ],
      org_status: ["active", "suspended", "trial"],
      widget_type: [
        "metric_card",
        "area_chart",
        "bar_chart",
        "line_chart",
        "pie_chart",
        "funnel",
        "table",
        "insight_card",
      ],
    },
  },
} as const
