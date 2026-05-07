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
      achievement_definitions: {
        Row: {
          category: string
          description: string
          icon: string
          id: string
          name: string
          xp: number
        }
        Insert: {
          category?: string
          description: string
          icon: string
          id: string
          name: string
          xp?: number
        }
        Update: {
          category?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          xp?: number
        }
        Relationships: []
      }
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
      crm_alerts: {
        Row: {
          alert_type: string
          created_at: string
          entity_external_id: string | null
          entity_type: string | null
          id: string
          message: string
          metadata: Json
          resolved: boolean
          severity: string
          tenant_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          entity_external_id?: string | null
          entity_type?: string | null
          id?: string
          message: string
          metadata?: Json
          resolved?: boolean
          severity?: string
          tenant_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          entity_external_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string
          metadata?: Json
          resolved?: boolean
          severity?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_analysis_reports: {
        Row: {
          created_at: string
          id: string
          input_digest: string | null
          model_used: string | null
          operation_score: number | null
          report: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_digest?: string | null
          model_used?: string | null
          operation_score?: number | null
          report?: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_digest?: string | null
          model_used?: string | null
          operation_score?: number | null
          report?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_analysis_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_auditor_activities: {
        Row: {
          activity_type: string
          entity_external_id: string
          entity_type: string
          external_id: string
          happened_at: string
          id: string
          raw: Json
          synced_at: string
          tenant_id: string
        }
        Insert: {
          activity_type?: string
          entity_external_id: string
          entity_type?: string
          external_id: string
          happened_at: string
          id?: string
          raw?: Json
          synced_at?: string
          tenant_id: string
        }
        Update: {
          activity_type?: string
          entity_external_id?: string
          entity_type?: string
          external_id?: string
          happened_at?: string
          id?: string
          raw?: Json
          synced_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_auditor_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_auditor_connections: {
        Row: {
          auth_via: string
          composio_connected_account_id: string | null
          created_at: string
          credentials: Json
          display_name: string
          id: string
          last_sync_at: string | null
          provider: string
          sync_error: string | null
          sync_status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          auth_via?: string
          composio_connected_account_id?: string | null
          created_at?: string
          credentials?: Json
          display_name?: string
          id?: string
          last_sync_at?: string | null
          provider?: string
          sync_error?: string | null
          sync_status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          auth_via?: string
          composio_connected_account_id?: string | null
          created_at?: string
          credentials?: Json
          display_name?: string
          id?: string
          last_sync_at?: string | null
          provider?: string
          sync_error?: string | null
          sync_status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_auditor_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_auditor_conversations: {
        Row: {
          contact_external_id: string | null
          external_id: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          raw: Json
          status: string | null
          synced_at: string
          tenant_id: string
        }
        Insert: {
          contact_external_id?: string | null
          external_id: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          raw?: Json
          status?: string | null
          synced_at?: string
          tenant_id: string
        }
        Update: {
          contact_external_id?: string | null
          external_id?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          raw?: Json
          status?: string | null
          synced_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_auditor_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_auditor_events: {
        Row: {
          entity_external_id: string | null
          entity_type: string | null
          event_type: string | null
          external_id: string
          id: string
          occurred_at: string | null
          raw: Json
          synced_at: string
          tenant_id: string
        }
        Insert: {
          entity_external_id?: string | null
          entity_type?: string | null
          event_type?: string | null
          external_id: string
          id?: string
          occurred_at?: string | null
          raw?: Json
          synced_at?: string
          tenant_id: string
        }
        Update: {
          entity_external_id?: string | null
          entity_type?: string | null
          event_type?: string | null
          external_id?: string
          id?: string
          occurred_at?: string | null
          raw?: Json
          synced_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_auditor_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_auditor_notes: {
        Row: {
          content_preview: string | null
          entity_external_id: string | null
          external_id: string
          id: string
          note_at: string | null
          note_type: string | null
          raw: Json
          scope_entity_type: string
          synced_at: string
          tenant_id: string
        }
        Insert: {
          content_preview?: string | null
          entity_external_id?: string | null
          external_id: string
          id?: string
          note_at?: string | null
          note_type?: string | null
          raw?: Json
          scope_entity_type: string
          synced_at?: string
          tenant_id: string
        }
        Update: {
          content_preview?: string | null
          entity_external_id?: string | null
          external_id?: string
          id?: string
          note_at?: string | null
          note_type?: string | null
          raw?: Json
          scope_entity_type?: string
          synced_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_auditor_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_companies: {
        Row: {
          external_id: string
          id: string
          name: string
          raw: Json
          synced_at: string
          tenant_id: string
        }
        Insert: {
          external_id: string
          id?: string
          name?: string
          raw?: Json
          synced_at?: string
          tenant_id: string
        }
        Update: {
          external_id?: string
          id?: string
          name?: string
          raw?: Json
          synced_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_custom_fields: {
        Row: {
          entity_type: string
          external_id: string
          field_type: string | null
          id: string
          name: string
          raw: Json
          synced_at: string
          tenant_id: string
        }
        Insert: {
          entity_type: string
          external_id: string
          field_type?: string | null
          id?: string
          name?: string
          raw?: Json
          synced_at?: string
          tenant_id: string
        }
        Update: {
          entity_type?: string
          external_id?: string
          field_type?: string | null
          id?: string
          name?: string
          raw?: Json
          synced_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_custom_fields_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          closed_at: string | null
          company_external_id: string | null
          contact_external_id: string | null
          created_at: string | null
          currency: string | null
          external_id: string
          external_updated_at: string | null
          id: string
          lead_status: string
          lost_reason: string | null
          name: string
          owner_external_id: string | null
          pipeline_external_id: string | null
          raw: Json
          source: string | null
          stage_external_id: string | null
          synced_at: string
          tenant_id: string
          value: number
        }
        Insert: {
          closed_at?: string | null
          company_external_id?: string | null
          contact_external_id?: string | null
          created_at?: string | null
          currency?: string | null
          external_id: string
          external_updated_at?: string | null
          id?: string
          lead_status?: string
          lost_reason?: string | null
          name?: string
          owner_external_id?: string | null
          pipeline_external_id?: string | null
          raw?: Json
          source?: string | null
          stage_external_id?: string | null
          synced_at?: string
          tenant_id: string
          value?: number
        }
        Update: {
          closed_at?: string | null
          company_external_id?: string | null
          contact_external_id?: string | null
          created_at?: string | null
          currency?: string | null
          external_id?: string
          external_updated_at?: string | null
          id?: string
          lead_status?: string
          lost_reason?: string | null
          name?: string
          owner_external_id?: string | null
          pipeline_external_id?: string | null
          raw?: Json
          source?: string | null
          stage_external_id?: string | null
          synced_at?: string
          tenant_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_norm_contacts: {
        Row: {
          company_external_id: string | null
          email: string | null
          external_id: string
          id: string
          name: string
          phone: string | null
          raw: Json
          synced_at: string
          tenant_id: string
        }
        Insert: {
          company_external_id?: string | null
          email?: string | null
          external_id: string
          id?: string
          name?: string
          phone?: string | null
          raw?: Json
          synced_at?: string
          tenant_id: string
        }
        Update: {
          company_external_id?: string | null
          email?: string | null
          external_id?: string
          id?: string
          name?: string
          phone?: string | null
          raw?: Json
          synced_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_norm_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          external_id: string
          id: string
          is_active: boolean
          name: string
          raw: Json
          synced_at: string
          tenant_id: string
        }
        Insert: {
          external_id: string
          id?: string
          is_active?: boolean
          name?: string
          raw?: Json
          synced_at?: string
          tenant_id: string
        }
        Update: {
          external_id?: string
          id?: string
          is_active?: boolean
          name?: string
          raw?: Json
          synced_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipelines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_snapshots: {
        Row: {
          created_at: string
          id: string
          payload: Json
          snapshot_kind: string
          sync_run_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          snapshot_kind?: string
          sync_run_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          snapshot_kind?: string
          sync_run_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_snapshots_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "crm_sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stages: {
        Row: {
          external_id: string
          id: string
          name: string
          pipeline_external_id: string
          raw: Json
          sort_order: number | null
          stage_type: string | null
          synced_at: string
          tenant_id: string
        }
        Insert: {
          external_id: string
          id?: string
          name?: string
          pipeline_external_id: string
          raw?: Json
          sort_order?: number | null
          stage_type?: string | null
          synced_at?: string
          tenant_id: string
        }
        Update: {
          external_id?: string
          id?: string
          name?: string
          pipeline_external_id?: string
          raw?: Json
          sort_order?: number | null
          stage_type?: string | null
          synced_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sync_runs: {
        Row: {
          connection_id: string | null
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          started_at: string
          stats: Json
          status: string
          tenant_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          stats?: Json
          status?: string
          tenant_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          stats?: Json
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_sync_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "crm_auditor_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_sync_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          assignee_external_id: string | null
          completed_at: string | null
          contact_external_id: string | null
          due_at: string | null
          external_id: string
          id: string
          is_completed: boolean
          lead_external_id: string | null
          raw: Json
          synced_at: string
          tenant_id: string
          title: string
        }
        Insert: {
          assignee_external_id?: string | null
          completed_at?: string | null
          contact_external_id?: string | null
          due_at?: string | null
          external_id: string
          id?: string
          is_completed?: boolean
          lead_external_id?: string | null
          raw?: Json
          synced_at?: string
          tenant_id: string
          title?: string
        }
        Update: {
          assignee_external_id?: string | null
          completed_at?: string | null
          contact_external_id?: string | null
          due_at?: string | null
          external_id?: string
          id?: string
          is_completed?: boolean
          lead_external_id?: string | null
          raw?: Json
          synced_at?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_users: {
        Row: {
          email: string | null
          external_id: string
          id: string
          is_active: boolean
          name: string
          raw: Json
          synced_at: string
          tenant_id: string
        }
        Insert: {
          email?: string | null
          external_id: string
          id?: string
          is_active?: boolean
          name?: string
          raw?: Json
          synced_at?: string
          tenant_id: string
        }
        Update: {
          email?: string | null
          external_id?: string
          id?: string
          is_active?: boolean
          name?: string
          raw?: Json
          synced_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_activity_timeline: {
        Row: {
          created_at: string
          customer_key: string
          description: string | null
          event_subtype: string | null
          event_type: string
          happened_at: string
          id: string
          metadata: Json
          org_id: string
          source: string | null
          title: string
        }
        Insert: {
          created_at?: string
          customer_key: string
          description?: string | null
          event_subtype?: string | null
          event_type: string
          happened_at: string
          id?: string
          metadata?: Json
          org_id: string
          source?: string | null
          title: string
        }
        Update: {
          created_at?: string
          customer_key?: string
          description?: string | null
          event_subtype?: string | null
          event_type?: string
          happened_at?: string
          id?: string
          metadata?: Json
          org_id?: string
          source?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_activity_timeline_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_alerts: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          customer_key: string
          customer_name: string | null
          description: string
          id: string
          metadata: Json
          org_id: string
          resolved: boolean
          resolved_at: string | null
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          customer_key: string
          customer_name?: string | null
          description?: string
          id?: string
          metadata?: Json
          org_id: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          customer_key?: string
          customer_name?: string | null
          description?: string
          id?: string
          metadata?: Json
          org_id?: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_alerts_org_id_fkey"
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
      customer_health_scores: {
        Row: {
          calculated_at: string
          created_at: string
          customer_email: string | null
          customer_key: string
          customer_name: string | null
          engagement_score: number
          health_band: string
          health_delta: number | null
          health_score: number
          id: string
          loyalty_score: number
          momentum_score: number
          org_id: string
          revenue_score: number
          signals: Json
          source_table: string | null
          trend: string | null
          updated_at: string
        }
        Insert: {
          calculated_at?: string
          created_at?: string
          customer_email?: string | null
          customer_key: string
          customer_name?: string | null
          engagement_score?: number
          health_band?: string
          health_delta?: number | null
          health_score?: number
          id?: string
          loyalty_score?: number
          momentum_score?: number
          org_id: string
          revenue_score?: number
          signals?: Json
          source_table?: string | null
          trend?: string | null
          updated_at?: string
        }
        Update: {
          calculated_at?: string
          created_at?: string
          customer_email?: string | null
          customer_key?: string
          customer_name?: string | null
          engagement_score?: number
          health_band?: string
          health_delta?: number | null
          health_score?: number
          id?: string
          loyalty_score?: number
          momentum_score?: number
          org_id?: string
          revenue_score?: number
          signals?: Json
          source_table?: string | null
          trend?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_health_scores_org_id_fkey"
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
      dashboard_shares: {
        Row: {
          allow_filters: boolean
          created_at: string
          created_by: string | null
          dashboard_id: string
          expires_at: string | null
          id: string
          org_id: string
          password_hash: string | null
          title: string | null
          token: string
          updated_at: string
          view_count: number
        }
        Insert: {
          allow_filters?: boolean
          created_at?: string
          created_by?: string | null
          dashboard_id: string
          expires_at?: string | null
          id?: string
          org_id: string
          password_hash?: string | null
          title?: string | null
          token?: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          allow_filters?: boolean
          created_at?: string
          created_by?: string | null
          dashboard_id?: string
          expires_at?: string | null
          id?: string
          org_id?: string
          password_hash?: string | null
          title?: string | null
          token?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_shares_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_shares_org_id_fkey"
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
      hub_connections: {
        Row: {
          created_at: string
          credentials: Json
          display_name: string
          id: string
          last_sync_at: string | null
          metadata: Json
          org_id: string
          provider_slug: string
          status: string
          sync_config: Json
          sync_error: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          display_name: string
          id?: string
          last_sync_at?: string | null
          metadata?: Json
          org_id: string
          provider_slug: string
          status?: string
          sync_config?: Json
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          display_name?: string
          id?: string
          last_sync_at?: string | null
          metadata?: Json
          org_id?: string
          provider_slug?: string
          status?: string
          sync_config?: Json
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_connections_provider_slug_fkey"
            columns: ["provider_slug"]
            isOneToOne: false
            referencedRelation: "integration_providers"
            referencedColumns: ["slug"]
          },
        ]
      }
      integration_providers: {
        Row: {
          auth_flow: string
          category: string
          created_at: string
          credentials_schema: Json
          description: string
          docs_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          auth_flow?: string
          category: string
          created_at?: string
          credentials_schema?: Json
          description?: string
          docs_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          auth_flow?: string
          category?: string
          created_at?: string
          credentials_schema?: Json
          description?: string
          docs_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
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
      kpi_alert_rules: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          last_triggered_at: string | null
          metric_key: string
          name: string
          operator: string
          org_id: string
          severity: string
          threshold: number
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          metric_key: string
          name: string
          operator: string
          org_id: string
          severity?: string
          threshold: number
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          metric_key?: string
          name?: string
          operator?: string
          org_id?: string
          severity?: string
          threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_alert_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_alert_triggers: {
        Row: {
          actual_value: number
          created_at: string
          id: string
          metric_key: string
          operator: string
          org_id: string
          resolved: boolean
          rule_id: string
          threshold: number
        }
        Insert: {
          actual_value: number
          created_at?: string
          id?: string
          metric_key: string
          operator: string
          org_id: string
          resolved?: boolean
          rule_id: string
          threshold: number
        }
        Update: {
          actual_value?: number
          created_at?: string
          id?: string
          metric_key?: string
          operator?: string
          org_id?: string
          resolved?: boolean
          rule_id?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_alert_triggers_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "kpi_alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_goals: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          current_value: number | null
          icon: string | null
          id: string
          metric_key: string
          name: string
          org_id: string
          period_end: string
          period_start: string
          period_type: string
          target_value: number
          unit: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          icon?: string | null
          id?: string
          metric_key: string
          name: string
          org_id: string
          period_end: string
          period_start: string
          period_type?: string
          target_value: number
          unit?: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          icon?: string | null
          id?: string
          metric_key?: string
          name?: string
          org_id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          target_value?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_goals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_entries: {
        Row: {
          created_at: string
          id: string
          metric_key: string
          org_id: string
          period_key: string
          period_type: string
          rank: number | null
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric_key: string
          org_id: string
          period_key: string
          period_type: string
          rank?: number | null
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          metric_key?: string
          org_id?: string
          period_key?: string
          period_type?: string
          rank?: number | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_org_id_fkey"
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
      paid_traffic_adsets: {
        Row: {
          campaign_id: string
          daily_budget: number | null
          external_id: string
          id: string
          name: string
          org_id: string
          platform_slug: string
          raw: Json
          status: string
          synced_at: string
        }
        Insert: {
          campaign_id: string
          daily_budget?: number | null
          external_id: string
          id?: string
          name?: string
          org_id: string
          platform_slug: string
          raw?: Json
          status?: string
          synced_at?: string
        }
        Update: {
          campaign_id?: string
          daily_budget?: number | null
          external_id?: string
          id?: string
          name?: string
          org_id?: string
          platform_slug?: string
          raw?: Json
          status?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paid_traffic_adsets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      paid_traffic_campaigns: {
        Row: {
          account_id: string
          daily_budget: number | null
          end_date: string | null
          external_id: string
          id: string
          lifetime_budget: number | null
          name: string
          objective: string | null
          org_id: string
          platform_slug: string
          raw: Json
          start_date: string | null
          status: string
          synced_at: string
        }
        Insert: {
          account_id: string
          daily_budget?: number | null
          end_date?: string | null
          external_id: string
          id?: string
          lifetime_budget?: number | null
          name?: string
          objective?: string | null
          org_id: string
          platform_slug: string
          raw?: Json
          start_date?: string | null
          status?: string
          synced_at?: string
        }
        Update: {
          account_id?: string
          daily_budget?: number | null
          end_date?: string | null
          external_id?: string
          id?: string
          lifetime_budget?: number | null
          name?: string
          objective?: string | null
          org_id?: string
          platform_slug?: string
          raw?: Json
          start_date?: string | null
          status?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paid_traffic_campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      paid_traffic_connections: {
        Row: {
          account_id: string | null
          account_name: string | null
          created_at: string
          credentials: Json
          id: string
          last_sync_at: string | null
          org_id: string
          platform_slug: string
          sync_error: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          created_at?: string
          credentials?: Json
          id?: string
          last_sync_at?: string | null
          org_id: string
          platform_slug: string
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          created_at?: string
          credentials?: Json
          id?: string
          last_sync_at?: string | null
          org_id?: string
          platform_slug?: string
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paid_traffic_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      paid_traffic_daily_metrics: {
        Row: {
          adset_id: string
          campaign_id: string
          clicks: number
          cpa: number | null
          cpl: number | null
          ctr: number | null
          date: string
          id: string
          impressions: number
          leads: number
          org_id: string
          platform_slug: string
          purchase_value: number
          purchases: number
          raw: Json
          reach: number | null
          roas: number | null
          spend: number
          synced_at: string
        }
        Insert: {
          adset_id?: string
          campaign_id: string
          clicks?: number
          cpa?: number | null
          cpl?: number | null
          ctr?: number | null
          date: string
          id?: string
          impressions?: number
          leads?: number
          org_id: string
          platform_slug: string
          purchase_value?: number
          purchases?: number
          raw?: Json
          reach?: number | null
          roas?: number | null
          spend?: number
          synced_at?: string
        }
        Update: {
          adset_id?: string
          campaign_id?: string
          clicks?: number
          cpa?: number | null
          cpl?: number | null
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number
          leads?: number
          org_id?: string
          platform_slug?: string
          purchase_value?: number
          purchases?: number
          raw?: Json
          reach?: number | null
          roas?: number | null
          spend?: number
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paid_traffic_daily_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      smartlead_sync_snapshots: {
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
            foreignKeyName: "smartlead_sync_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          id: string
          org_id: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          id?: string
          org_id: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          id?: string
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievement_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      leads_v2: {
        Row: {
          company: string | null
          converted_at: string | null
          created_at: string | null
          email: string | null
          external_id: string | null
          id: string | null
          integration_id: string | null
          metadata: Json | null
          name: string | null
          org_id: string | null
          phone: string | null
          source: Database["public"]["Enums"]["lead_source"] | null
          status: Database["public"]["Enums"]["lead_status"] | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          company?: string | null
          converted_at?: string | null
          created_at?: string | null
          email?: string | null
          external_id?: string | null
          id?: string | null
          integration_id?: string | null
          metadata?: Json | null
          name?: string | null
          org_id?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          company?: string | null
          converted_at?: string | null
          created_at?: string | null
          email?: string | null
          external_id?: string | null
          id?: string | null
          integration_id?: string | null
          metadata?: Json | null
          name?: string | null
          org_id?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          updated_at?: string | null
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
      vw_crm_data_quality: {
        Row: {
          contacts_no_email: number | null
          contacts_no_phone: number | null
          contacts_total: number | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_norm_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_dashboard_daily_60d_v3: {
        Row: {
          day: string | null
          meetings_scheduled: number | null
          msg_in: number | null
          new_leads: number | null
          org_id: string | null
          spend: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_dashboard_kpis_30d_v3: {
        Row: {
          conv_lead_to_meeting_30d: number | null
          conversions_30d: number | null
          cp_meeting_booked_30d: number | null
          cpl_30d: number | null
          meetings_booked_30d: number | null
          meetings_cancelled_30d: number | null
          meetings_done_30d: number | null
          msg_in_30d: number | null
          org_id: string | null
          spend_30d: number | null
          total_leads_30d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_duplicate_contacts: {
        Row: {
          cnt: number | null
          email_norm: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_norm_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_forecast_quality: {
        Row: {
          open_total: number | null
          open_without_value: number | null
          pct_open_missing_value: number | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_funnel_current_v3: {
        Row: {
          org_id: string | null
          raw_status: string | null
          stage_group: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_funnel_velocity: {
        Row: {
          avg_days_in_stage_proxy: number | null
          median_days_in_stage_proxy: number | null
          pipeline_external_id: string | null
          stage_external_id: string | null
          stage_name: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_leads_stuck_by_stage: {
        Row: {
          closed_at: string | null
          company_external_id: string | null
          contact_external_id: string | null
          created_at: string | null
          currency: string | null
          days_since_update: number | null
          external_id: string | null
          external_updated_at: string | null
          id: string | null
          lead_status: string | null
          lost_reason: string | null
          name: string | null
          owner_external_id: string | null
          pipeline_external_id: string | null
          raw: Json | null
          source: string | null
          stage_external_id: string | null
          stage_name: string | null
          synced_at: string | null
          tenant_id: string | null
          value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_lost_reasons: {
        Row: {
          cnt: number | null
          lost_reason: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_no_next_action: {
        Row: {
          closed_at: string | null
          company_external_id: string | null
          contact_external_id: string | null
          created_at: string | null
          currency: string | null
          external_id: string | null
          external_updated_at: string | null
          id: string | null
          lead_status: string | null
          lost_reason: string | null
          name: string | null
          owner_external_id: string | null
          pipeline_external_id: string | null
          raw: Json | null
          source: string | null
          stage_external_id: string | null
          synced_at: string | null
          tenant_id: string | null
          value: number | null
        }
        Insert: {
          closed_at?: string | null
          company_external_id?: string | null
          contact_external_id?: string | null
          created_at?: string | null
          currency?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          id?: string | null
          lead_status?: string | null
          lost_reason?: string | null
          name?: string | null
          owner_external_id?: string | null
          pipeline_external_id?: string | null
          raw?: Json | null
          source?: string | null
          stage_external_id?: string | null
          synced_at?: string | null
          tenant_id?: string | null
          value?: number | null
        }
        Update: {
          closed_at?: string | null
          company_external_id?: string | null
          contact_external_id?: string | null
          created_at?: string | null
          currency?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          id?: string | null
          lead_status?: string | null
          lost_reason?: string | null
          name?: string | null
          owner_external_id?: string | null
          pipeline_external_id?: string | null
          raw?: Json | null
          source?: string | null
          stage_external_id?: string | null
          synced_at?: string | null
          tenant_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_overdue_tasks: {
        Row: {
          assignee_external_id: string | null
          completed_at: string | null
          contact_external_id: string | null
          due_at: string | null
          external_id: string | null
          id: string | null
          is_completed: boolean | null
          lead_external_id: string | null
          raw: Json | null
          synced_at: string | null
          tenant_id: string | null
          title: string | null
        }
        Insert: {
          assignee_external_id?: string | null
          completed_at?: string | null
          contact_external_id?: string | null
          due_at?: string | null
          external_id?: string | null
          id?: string | null
          is_completed?: boolean | null
          lead_external_id?: string | null
          raw?: Json | null
          synced_at?: string | null
          tenant_id?: string | null
          title?: string | null
        }
        Update: {
          assignee_external_id?: string | null
          completed_at?: string | null
          contact_external_id?: string | null
          due_at?: string | null
          external_id?: string | null
          id?: string | null
          is_completed?: boolean | null
          lead_external_id?: string | null
          raw?: Json | null
          synced_at?: string | null
          tenant_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_owner_performance: {
        Row: {
          lost_leads: number | null
          open_leads: number | null
          open_value: number | null
          owner_external_id: string | null
          owner_name: string | null
          tenant_id: string | null
          won_leads: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_pipeline_health: {
        Row: {
          lost_leads: number | null
          open_leads: number | null
          open_pipeline_value: number | null
          pipeline_external_id: string | null
          pipeline_name: string | null
          stage_external_id: string | null
          stage_name: string | null
          tenant_id: string | null
          won_leads: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_stage_conversion: {
        Row: {
          lead_count: number | null
          pct_of_open_pipeline: number | null
          pipeline_external_id: string | null
          stage_external_id: string | null
          stage_name: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      integration_type:
        | "supabase"
        | "google_sheets"
        | "csv"
        | "api"
        | "ploomes"
        | "coldmail"
        | "smartlead"
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
      integration_type: [
        "supabase",
        "google_sheets",
        "csv",
        "api",
        "ploomes",
        "coldmail",
        "smartlead",
      ],
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
