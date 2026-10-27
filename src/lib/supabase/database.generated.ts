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
      attendance_events: {
        Row: {
          event_type: string
          id: string
          occurred_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          event_type: string
          id?: string
          occurred_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          event_type?: string
          id?: string
          occurred_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "attendance_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: number
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transfers: {
        Row: {
          call_id: string
          completed_at: string | null
          connected_at: string | null
          created_at: string
          from_user: string
          id: string
          mode: string
          status: string
          to_call_sid: string | null
          to_user: string
          workspace_id: string
        }
        Insert: {
          call_id: string
          completed_at?: string | null
          connected_at?: string | null
          created_at?: string
          from_user: string
          id?: string
          mode: string
          status?: string
          to_call_sid?: string | null
          to_user: string
          workspace_id: string
        }
        Update: {
          call_id?: string
          completed_at?: string | null
          connected_at?: string | null
          created_at?: string
          from_user?: string
          id?: string
          mode?: string
          status?: string
          to_call_sid?: string | null
          to_user?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_transfers_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transfers_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transfers_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transfers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "call_transfers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      callbacks: {
        Row: {
          agent_id: string | null
          call_id: string | null
          created_at: string
          due_at: string
          id: string
          lead_id: string
          snooze_count: number
          status: string
          workspace_id: string
        }
        Insert: {
          agent_id?: string | null
          call_id?: string | null
          created_at?: string
          due_at: string
          id?: string
          lead_id: string
          snooze_count?: number
          status?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string | null
          call_id?: string | null
          created_at?: string
          due_at?: string
          id?: string
          lead_id?: string
          snooze_count?: number
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "callbacks_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callbacks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callbacks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "callbacks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          agent_id: string
          ai_summary: Json | null
          answered_at: string | null
          campaign_id: string | null
          conference_name: string | null
          created_at: string
          direction: string
          disposed_at: string | null
          disposition_id: string | null
          duration_seconds: number | null
          ended_at: string | null
          from_number: string | null
          id: string
          lead_call_sid: string | null
          lead_id: string
          notes: string | null
          provider: string
          provider_call_sid: string | null
          recording_path: string | null
          recording_sid: string | null
          recording_url: string | null
          started_at: string
          status: string
          to_number: string | null
          workspace_id: string
          zoom_call_id: string | null
          zoom_call_log_id: string | null
        }
        Insert: {
          agent_id: string
          ai_summary?: Json | null
          answered_at?: string | null
          campaign_id?: string | null
          conference_name?: string | null
          created_at?: string
          direction?: string
          disposed_at?: string | null
          disposition_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          from_number?: string | null
          id?: string
          lead_call_sid?: string | null
          lead_id: string
          notes?: string | null
          provider?: string
          provider_call_sid?: string | null
          recording_path?: string | null
          recording_sid?: string | null
          recording_url?: string | null
          started_at?: string
          status?: string
          to_number?: string | null
          workspace_id: string
          zoom_call_id?: string | null
          zoom_call_log_id?: string | null
        }
        Update: {
          agent_id?: string
          ai_summary?: Json | null
          answered_at?: string | null
          campaign_id?: string | null
          conference_name?: string | null
          created_at?: string
          direction?: string
          disposed_at?: string | null
          disposition_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          from_number?: string | null
          id?: string
          lead_call_sid?: string | null
          lead_id?: string
          notes?: string | null
          provider?: string
          provider_call_sid?: string | null
          recording_path?: string | null
          recording_sid?: string | null
          recording_url?: string | null
          started_at?: string
          status?: string
          to_number?: string | null
          workspace_id?: string
          zoom_call_id?: string | null
          zoom_call_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v_campaign_funnel"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "calls_disposition_id_fkey"
            columns: ["disposition_id"]
            isOneToOne: false
            referencedRelation: "dispositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_assignments: {
        Row: {
          campaign_id: string
          created_at: string
          daily_target: number
          id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          daily_target?: number
          id?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          daily_target?: number
          id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v_campaign_funnel"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "campaign_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaign_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          audience: string
          caller_id: string | null
          calling_window_end: string | null
          calling_window_start: string | null
          client_id: string | null
          code: string | null
          cooling_off_hours: number
          country: string | null
          created_at: string
          disclosure_script: string | null
          id: string
          max_attempts: number
          name: string
          objection_notes: string | null
          recording_enabled: boolean
          status: string
          timezone: string
          updated_at: string
          vertical: string | null
          workspace_id: string
        }
        Insert: {
          audience?: string
          caller_id?: string | null
          calling_window_end?: string | null
          calling_window_start?: string | null
          client_id?: string | null
          code?: string | null
          cooling_off_hours?: number
          country?: string | null
          created_at?: string
          disclosure_script?: string | null
          id?: string
          max_attempts?: number
          name: string
          objection_notes?: string | null
          recording_enabled?: boolean
          status?: string
          timezone?: string
          updated_at?: string
          vertical?: string | null
          workspace_id: string
        }
        Update: {
          audience?: string
          caller_id?: string | null
          calling_window_end?: string | null
          calling_window_start?: string | null
          client_id?: string | null
          code?: string | null
          cooling_off_hours?: number
          country?: string | null
          created_at?: string
          disclosure_script?: string | null
          id?: string
          max_attempts?: number
          name?: string
          objection_notes?: string | null
          recording_enabled?: boolean
          status?: string
          timezone?: string
          updated_at?: string
          vertical?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          dpa_signed_on: string | null
          id: string
          is_active: boolean
          is_data_controller: boolean
          name: string
          workspace_id: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          dpa_signed_on?: string | null
          id?: string
          is_active?: boolean
          is_data_controller?: boolean
          name: string
          workspace_id: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          dpa_signed_on?: string | null
          id?: string
          is_active?: boolean
          is_data_controller?: boolean
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event: string
          id: number
          user_id: string
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event: string
          id?: number
          user_id: string
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event?: string
          id?: number
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credential_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "credential_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          lawful_basis: string
          licence_terms_url: string | null
          market: string | null
          name: string
          notes: string | null
          provider_url: string | null
          source_type: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          lawful_basis: string
          licence_terms_url?: string | null
          market?: string | null
          name: string
          notes?: string | null
          provider_url?: string | null
          source_type: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          lawful_basis?: string
          licence_terms_url?: string | null
          market?: string | null
          name?: string
          notes?: string | null
          provider_url?: string | null
          source_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "data_sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dispositions: {
        Row: {
          code: string
          id: string
          is_terminal: boolean
          label: string
          outcome_group: string
          requires_followup: boolean
          requires_note: boolean
          sets_dnc: boolean
          sort: number
        }
        Insert: {
          code: string
          id?: string
          is_terminal?: boolean
          label: string
          outcome_group: string
          requires_followup?: boolean
          requires_note?: boolean
          sets_dnc?: boolean
          sort?: number
        }
        Update: {
          code?: string
          id?: string
          is_terminal?: boolean
          label?: string
          outcome_group?: string
          requires_followup?: boolean
          requires_note?: boolean
          sets_dnc?: boolean
          sort?: number
        }
        Relationships: []
      }
      email_log: {
        Row: {
          created_at: string
          error: string | null
          id: string
          lead_id: string | null
          provider_message_id: string | null
          sent_by: string | null
          status: string
          template_id: string | null
          to_email: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          provider_message_id?: string | null
          sent_by?: string | null
          status?: string
          template_id?: string | null
          to_email: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          provider_message_id?: string | null
          sent_by?: string | null
          status?: string
          template_id?: string | null
          to_email?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "email_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppression: {
        Row: {
          created_at: string
          email: string
          id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_suppression_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "email_suppression_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          body_md: string
          created_at: string
          id: string
          name: string
          subject: string
          workspace_id: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          body_md: string
          created_at?: string
          id?: string
          name: string
          subject: string
          workspace_id: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          body_md?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "email_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_batches: {
        Row: {
          campaign_id: string | null
          created_at: string
          data_source_id: string | null
          evidence_url: string | null
          id: string
          row_count: number
          screened_at: string | null
          source: string | null
          status: string
          storage_path: string | null
          uploaded_by: string | null
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          data_source_id?: string | null
          evidence_url?: string | null
          id?: string
          row_count?: number
          screened_at?: string | null
          source?: string | null
          status?: string
          storage_path?: string | null
          uploaded_by?: string | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          data_source_id?: string | null
          evidence_url?: string | null
          id?: string
          row_count?: number
          screened_at?: string | null
          source?: string | null
          status?: string
          storage_path?: string | null
          uploaded_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_batches_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_batches_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v_campaign_funnel"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "lead_batches_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_batches_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "v_source_performance"
            referencedColumns: ["data_source_id"]
          },
          {
            foreignKeyName: "lead_batches_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_batches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "lead_batches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_intake_events: {
        Row: {
          campaign_id: string | null
          error: string | null
          http_status: number
          id: string
          lead_id: string | null
          outcome: string
          phone_last4: string | null
          received_at: string
          source: string | null
          token_id: string | null
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          error?: string | null
          http_status: number
          id?: string
          lead_id?: string | null
          outcome: string
          phone_last4?: string | null
          received_at?: string
          source?: string | null
          token_id?: string | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          error?: string | null
          http_status?: number
          id?: string
          lead_id?: string | null
          outcome?: string
          phone_last4?: string | null
          received_at?: string
          source?: string | null
          token_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_intake_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_intake_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v_campaign_funnel"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "lead_intake_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_intake_events_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "lead_intake_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_intake_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "lead_intake_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_intake_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_used_at: string | null
          rotated_at: string | null
          token_hash: string
          token_prefix: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          rotated_at?: string | null
          token_hash: string
          token_prefix: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          rotated_at?: string | null
          token_hash?: string
          token_prefix?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_intake_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_intake_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "lead_intake_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address_line1: string | null
          agent_notes: string | null
          appointment_at: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          attempts: number
          batch_id: string | null
          campaign_id: string | null
          city: string | null
          claimed_at: string | null
          claimed_by: string | null
          company_name: string | null
          contact_name: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          custom: Json
          data_source_id: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          group_label: string | null
          id: string
          job_title: string | null
          last_attempt_at: string | null
          last_contact_at: string | null
          last_name: string | null
          next_step: string | null
          phone_e164: string | null
          phone_hash: string | null
          postcode: string | null
          region: string | null
          screened_at: string | null
          screening_status: string
          source: string | null
          status: string
          updated_at: string
          website: string | null
          workspace_id: string
        }
        Insert: {
          address_line1?: string | null
          agent_notes?: string | null
          appointment_at?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          attempts?: number
          batch_id?: string | null
          campaign_id?: string | null
          city?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          company_name?: string | null
          contact_name?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          custom?: Json
          data_source_id?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          group_label?: string | null
          id?: string
          job_title?: string | null
          last_attempt_at?: string | null
          last_contact_at?: string | null
          last_name?: string | null
          next_step?: string | null
          phone_e164?: string | null
          phone_hash?: string | null
          postcode?: string | null
          region?: string | null
          screened_at?: string | null
          screening_status?: string
          source?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          workspace_id: string
        }
        Update: {
          address_line1?: string | null
          agent_notes?: string | null
          appointment_at?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          attempts?: number
          batch_id?: string | null
          campaign_id?: string | null
          city?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          company_name?: string | null
          contact_name?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          custom?: Json
          data_source_id?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          group_label?: string | null
          id?: string
          job_title?: string | null
          last_attempt_at?: string | null
          last_contact_at?: string | null
          last_name?: string | null
          next_step?: string | null
          phone_e164?: string | null
          phone_hash?: string | null
          postcode?: string | null
          region?: string | null
          screened_at?: string | null
          screening_status?: string
          source?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "lead_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v_campaign_funnel"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "v_source_performance"
            referencedColumns: ["data_source_id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          from_date: string
          id: string
          reason: string | null
          status: string
          to_date: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          from_date: string
          id?: string
          reason?: string | null
          status?: string
          to_date: string
          user_id: string
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          from_date?: string
          id?: string
          reason?: string | null
          status?: string
          to_date?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leave_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agent_code: string | null
          client_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          joined_on: string | null
          must_change_password: boolean
          password_set_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          team_id: string | null
          timezone: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_code?: string | null
          client_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          joined_on?: string | null
          must_change_password?: boolean
          password_set_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string | null
          timezone?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_code?: string | null
          client_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          joined_on?: string | null
          must_change_password?: boolean
          password_set_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string | null
          timezone?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_criteria: {
        Row: {
          id: string
          is_fatal: boolean
          label: string
          sort: number
          template_id: string
          weight: number
          workspace_id: string
        }
        Insert: {
          id?: string
          is_fatal?: boolean
          label: string
          sort?: number
          template_id: string
          weight?: number
          workspace_id: string
        }
        Update: {
          id?: string
          is_fatal?: boolean
          label?: string
          sort?: number
          template_id?: string
          weight?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_criteria_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "qa_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_criteria_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "qa_criteria_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_criterion_results: {
        Row: {
          criterion_id: string
          id: string
          met: boolean
          qa_score_id: string
        }
        Insert: {
          criterion_id: string
          id?: string
          met: boolean
          qa_score_id: string
        }
        Update: {
          criterion_id?: string
          id?: string
          met?: boolean
          qa_score_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_criterion_results_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "qa_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_criterion_results_qa_score_id_fkey"
            columns: ["qa_score_id"]
            isOneToOne: false
            referencedRelation: "qa_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_scores: {
        Row: {
          acknowledged_at: string | null
          agent_id: string
          call_id: string
          coaching_notes: string | null
          created_at: string
          fatal_breach: boolean
          id: string
          passed: boolean
          qa_analyst_id: string
          template_id: string
          total_score: number
          workspace_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          agent_id: string
          call_id: string
          coaching_notes?: string | null
          created_at?: string
          fatal_breach?: boolean
          id?: string
          passed?: boolean
          qa_analyst_id: string
          template_id: string
          total_score?: number
          workspace_id: string
        }
        Update: {
          acknowledged_at?: string | null
          agent_id?: string
          call_id?: string
          coaching_notes?: string | null
          created_at?: string
          fatal_breach?: boolean
          id?: string
          passed?: boolean
          qa_analyst_id?: string
          template_id?: string
          total_score?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_scores_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "qa_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_scores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "qa_scores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "qa_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_hits: {
        Row: {
          bucket: string
          hit_count: number
          identifier: string
          window_start: string
        }
        Insert: {
          bucket: string
          hit_count?: number
          identifier: string
          window_start: string
        }
        Update: {
          bucket?: string
          hit_count?: number
          identifier?: string
          window_start?: string
        }
        Relationships: []
      }
      shift_assignments: {
        Row: {
          effective_from: string
          effective_to: string | null
          id: string
          shift_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          effective_from?: string
          effective_to?: string | null
          id?: string
          shift_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          effective_from?: string
          effective_to?: string | null
          id?: string
          shift_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "shift_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          days_of_week: number[]
          end_time: string
          grace_minutes: number
          id: string
          name: string
          start_time: string
          timezone: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[]
          end_time: string
          grace_minutes?: number
          id?: string
          name: string
          start_time: string
          timezone?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[]
          end_time?: string
          grace_minutes?: number
          id?: string
          name?: string
          start_time?: string
          timezone?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "shifts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      source_fetch_runs: {
        Row: {
          batch_id: string | null
          campaign_id: string | null
          data_source_id: string
          error: string | null
          finished_at: string | null
          id: string
          params: Json
          records_found: number
          records_imported: number
          records_rejected: number
          records_unphoned: number
          started_at: string
          status: string
          triggered_by: string | null
          workspace_id: string
        }
        Insert: {
          batch_id?: string | null
          campaign_id?: string | null
          data_source_id: string
          error?: string | null
          finished_at?: string | null
          id?: string
          params?: Json
          records_found?: number
          records_imported?: number
          records_rejected?: number
          records_unphoned?: number
          started_at?: string
          status?: string
          triggered_by?: string | null
          workspace_id: string
        }
        Update: {
          batch_id?: string | null
          campaign_id?: string | null
          data_source_id?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          params?: Json
          records_found?: number
          records_imported?: number
          records_rejected?: number
          records_unphoned?: number
          started_at?: string
          status?: string
          triggered_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_fetch_runs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "lead_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_fetch_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_fetch_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v_campaign_funnel"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "source_fetch_runs_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_fetch_runs_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "v_source_performance"
            referencedColumns: ["data_source_id"]
          },
          {
            foreignKeyName: "source_fetch_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "source_fetch_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      suppression_list: {
        Row: {
          added_by: string | null
          created_at: string
          evidence_url: string | null
          id: string
          note: string | null
          phone_hash: string
          phone_hint: string | null
          reason: string
          workspace_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          note?: string | null
          phone_hash: string
          phone_hint?: string | null
          reason: string
          workspace_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          note?: string | null
          phone_hash?: string
          phone_hint?: string | null
          reason?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppression_list_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "suppression_list_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          team_lead_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          team_lead_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          team_lead_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "teams_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      twilio_credentials: {
        Row: {
          account_sid: string | null
          api_key_secret_id: string | null
          api_key_sid: string | null
          auth_token_secret_id: string | null
          caller_id_default: string | null
          created_at: string
          id: string
          last_error: string | null
          status: string
          twiml_app_sid: string | null
          updated_at: string
          verified_at: string | null
          workspace_id: string
        }
        Insert: {
          account_sid?: string | null
          api_key_secret_id?: string | null
          api_key_sid?: string | null
          auth_token_secret_id?: string | null
          caller_id_default?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          status?: string
          twiml_app_sid?: string | null
          updated_at?: string
          verified_at?: string | null
          workspace_id: string
        }
        Update: {
          account_sid?: string | null
          api_key_secret_id?: string | null
          api_key_sid?: string | null
          auth_token_secret_id?: string | null
          caller_id_default?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          status?: string
          twiml_app_sid?: string | null
          updated_at?: string
          verified_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twilio_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "twilio_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      twilio_numbers: {
        Row: {
          capabilities: Json
          friendly_name: string | null
          id: string
          phone_number: string
          synced_at: string
          workspace_id: string
        }
        Insert: {
          capabilities?: Json
          friendly_name?: string | null
          id?: string
          phone_number: string
          synced_at?: string
          workspace_id: string
        }
        Update: {
          capabilities?: Json
          friendly_name?: string | null
          id?: string
          phone_number?: string
          synced_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twilio_numbers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "twilio_numbers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      unphoned_contacts: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          city: string | null
          company_name: string | null
          country_hint: string
          created_at: string
          custom: Json
          data_source_id: string | null
          email: string | null
          external_ref: string | null
          full_name: string | null
          id: string
          phone_raw: string | null
          promoted_at: string | null
          promoted_lead_id: string | null
          run_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          city?: string | null
          company_name?: string | null
          country_hint?: string
          created_at?: string
          custom?: Json
          data_source_id?: string | null
          email?: string | null
          external_ref?: string | null
          full_name?: string | null
          id?: string
          phone_raw?: string | null
          promoted_at?: string | null
          promoted_lead_id?: string | null
          run_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          city?: string | null
          company_name?: string | null
          country_hint?: string
          created_at?: string
          custom?: Json
          data_source_id?: string | null
          email?: string | null
          external_ref?: string | null
          full_name?: string | null
          id?: string
          phone_raw?: string | null
          promoted_at?: string | null
          promoted_lead_id?: string | null
          run_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unphoned_contacts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unphoned_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unphoned_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v_campaign_funnel"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "unphoned_contacts_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unphoned_contacts_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "v_source_performance"
            referencedColumns: ["data_source_id"]
          },
          {
            foreignKeyName: "unphoned_contacts_promoted_lead_id_fkey"
            columns: ["promoted_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unphoned_contacts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "source_fetch_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unphoned_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "unphoned_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_guide_state: {
        Row: {
          checklist_dismissed_at: string | null
          created_at: string
          tour_completed_at: string | null
          tour_seen_at: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          checklist_dismissed_at?: string | null
          created_at?: string
          tour_completed_at?: string | null
          tour_seen_at?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          checklist_dismissed_at?: string | null
          created_at?: string
          tour_completed_at?: string | null
          tour_seen_at?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_guide_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_guide_state_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "user_guide_state_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          billing_status: string
          brand_logo_url: string | null
          brand_primary_color: string | null
          brand_product_name: string | null
          created_at: string
          created_by: string | null
          demo_allowed_numbers: string[]
          id: string
          is_demo: boolean
          name: string
          onboarding_step: string | null
          plan: Database["public"]["Enums"]["workspace_plan"]
          require_screening: boolean
          seat_limit: number
          signup: Json
          slug: string
          status: Database["public"]["Enums"]["workspace_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          billing_status?: string
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          brand_product_name?: string | null
          created_at?: string
          created_by?: string | null
          demo_allowed_numbers?: string[]
          id?: string
          is_demo?: boolean
          name: string
          onboarding_step?: string | null
          plan?: Database["public"]["Enums"]["workspace_plan"]
          require_screening?: boolean
          seat_limit?: number
          signup?: Json
          slug: string
          status?: Database["public"]["Enums"]["workspace_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_status?: string
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          brand_product_name?: string | null
          created_at?: string
          created_by?: string | null
          demo_allowed_numbers?: string[]
          id?: string
          is_demo?: boolean
          name?: string
          onboarding_step?: string | null
          plan?: Database["public"]["Enums"]["workspace_plan"]
          require_screening?: boolean
          seat_limit?: number
          signup?: Json
          slug?: string
          status?: Database["public"]["Enums"]["workspace_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      zoom_credentials: {
        Row: {
          account_id: string
          client_id: string
          client_secret_id: string | null
          created_at: string
          id: string
          last_error: string | null
          status: string
          updated_at: string
          verified_at: string | null
          workspace_id: string
        }
        Insert: {
          account_id: string
          client_id: string
          client_secret_id?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          workspace_id: string
        }
        Update: {
          account_id?: string
          client_id?: string
          client_secret_id?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zoom_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "zoom_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      zoom_meetings: {
        Row: {
          agenda: string | null
          campaign_id: string | null
          created_at: string
          created_by: string
          duration_minutes: number
          host_id: string
          id: string
          join_url: string
          lead_id: string | null
          password: string | null
          start_time: string
          status: string
          timezone: string
          topic: string
          updated_at: string
          workspace_id: string
          zoom_meeting_id: string
        }
        Insert: {
          agenda?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by: string
          duration_minutes: number
          host_id: string
          id?: string
          join_url: string
          lead_id?: string | null
          password?: string | null
          start_time: string
          status?: string
          timezone?: string
          topic: string
          updated_at?: string
          workspace_id: string
          zoom_meeting_id: string
        }
        Update: {
          agenda?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string
          duration_minutes?: number
          host_id?: string
          id?: string
          join_url?: string
          lead_id?: string | null
          password?: string | null
          start_time?: string
          status?: string
          timezone?: string
          topic?: string
          updated_at?: string
          workspace_id?: string
          zoom_meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zoom_meetings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zoom_meetings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v_campaign_funnel"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "zoom_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zoom_meetings_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zoom_meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zoom_meetings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "zoom_meetings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_agent_scorecard: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          avg_wrap_seconds: number | null
          calls: number | null
          connects: number | null
          conversions: number | null
          talk_seconds: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      v_campaign_funnel: {
        Row: {
          campaign_id: string | null
          campaign_name: string | null
          connected: number | null
          converted: number | null
          dialled: number | null
          loaded: number | null
          screened: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      v_compliance_stats: {
        Row: {
          batches_screened: number | null
          batches_unscreened: number | null
          leads_blocked_by_suppression: number | null
          leads_expired: number | null
          leads_failed: number | null
          leads_passed: number | null
          leads_pending: number | null
          suppression_total: number | null
          workspace_id: string | null
        }
        Insert: {
          batches_screened?: never
          batches_unscreened?: never
          leads_blocked_by_suppression?: never
          leads_expired?: never
          leads_failed?: never
          leads_passed?: never
          leads_pending?: never
          suppression_total?: never
          workspace_id?: string | null
        }
        Update: {
          batches_screened?: never
          batches_unscreened?: never
          leads_blocked_by_suppression?: never
          leads_expired?: never
          leads_failed?: never
          leads_passed?: never
          leads_pending?: never
          suppression_total?: never
          workspace_id?: string | null
        }
        Relationships: []
      }
      v_source_performance: {
        Row: {
          contacted: number | null
          converted: number | null
          data_source_id: string | null
          is_active: boolean | null
          last_import_at: string | null
          lawful_basis: string | null
          leads_loaded: number | null
          market: string | null
          name: string | null
          run_count: number | null
          screened_passed: number | null
          source_type: string | null
          suppressed: number | null
          worked: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_compliance_stats"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "data_sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      auth_workspace_id: { Args: never; Returns: string }
      auto_assign_campaign_leads: {
        Args: { p_campaign_id: string }
        Returns: number
      }
      call_sheet: {
        Args: { p_limit?: number }
        Returns: {
          address_line1: string
          agent_notes: string
          appointment_at: string
          assigned_to: string
          attempts: number
          bucket: string
          callback_due_at: string
          callback_id: string
          campaign_id: string
          campaign_name: string
          city: string
          claimed_by_me: boolean
          company_name: string
          contact_name: string
          country_hint: string
          custom: Json
          dial_block_reason: string
          email: string
          first_name: string
          full_name: string
          id: string
          imported_last_contact_at: string
          job_title: string
          kind: string
          last_attempt_at: string
          last_contact: string
          last_name: string
          last_outcome_at: string
          last_outcome_code: string
          last_outcome_label: string
          last_outcome_notes: string
          max_attempts: number
          next_step: string
          phone_e164: string
          postcode: string
          region: string
          status: string
          total_count: number
          website: string
        }[]
      }
      check_rate_limit: {
        Args: {
          p_bucket: string
          p_identifier: string
          p_max_hits: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      claim_lead_for_call: {
        Args: { p_lead_id: string }
        Returns: {
          address_line1: string | null
          agent_notes: string | null
          appointment_at: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          attempts: number
          batch_id: string | null
          campaign_id: string | null
          city: string | null
          claimed_at: string | null
          claimed_by: string | null
          company_name: string | null
          contact_name: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          custom: Json
          data_source_id: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          group_label: string | null
          id: string
          job_title: string | null
          last_attempt_at: string | null
          last_contact_at: string | null
          last_name: string | null
          next_step: string | null
          phone_e164: string | null
          phone_hash: string | null
          postcode: string | null
          region: string | null
          screened_at: string | null
          screening_status: string
          source: string | null
          status: string
          updated_at: string
          website: string | null
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clear_zoom_credentials: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      client_agent_activity: {
        Args: { p_anonymize?: boolean; p_campaign_id?: string }
        Returns: {
          agent_label: string
          calls: number
          connects: number
          conversions: number
        }[]
      }
      client_campaign_funnel: {
        Args: never
        Returns: {
          campaign_id: string
          campaign_name: string
          connected: number
          converted: number
          dialled: number
          loaded: number
          screened: number
        }[]
      }
      client_disposition_breakdown: {
        Args: { p_campaign_id?: string }
        Returns: {
          count: number
          disposition_label: string
          outcome_group: string
        }[]
      }
      compute_phone_hash: { Args: { p_phone: string }; Returns: string }
      create_workspace_with_owner: {
        Args: {
          p_email: string
          p_full_name: string
          p_phone?: string
          p_signup?: Json
          p_slug: string
          p_team_size?: string
          p_user_id: string
          p_workspace_name: string
        }
        Returns: {
          billing_status: string
          brand_logo_url: string | null
          brand_primary_color: string | null
          brand_product_name: string | null
          created_at: string
          created_by: string | null
          demo_allowed_numbers: string[]
          id: string
          is_demo: boolean
          name: string
          onboarding_step: string | null
          plan: Database["public"]["Enums"]["workspace_plan"]
          seat_limit: number
          signup: Json
          slug: string
          status: Database["public"]["Enums"]["workspace_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "workspaces"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dial_queue_diagnosis: {
        Args: never
        Returns: {
          active_campaigns: number
          assigned_elsewhere: number
          attempts_exhausted: number
          claimed: number
          cooling_off: number
          demo_blocked: number
          dialable: number
          expired_screening: number
          failed_screening: number
          in_window_campaigns: number
          is_demo: boolean
          leads_considered: number
          leads_in_rostered_campaigns: number
          outside_campaign_name: string
          outside_timezone: string
          outside_window_end: string
          outside_window_start: string
          paused_campaign_name: string
          pending_screening: number
          rostered_campaigns: number
          suppressed: number
        }[]
      }
      get_twilio_api_key_secret: {
        Args: { p_workspace_id: string }
        Returns: string
      }
      get_twilio_auth_token: {
        Args: { p_workspace_id: string }
        Returns: string
      }
      get_zoom_client_secret: {
        Args: { p_workspace_id: string }
        Returns: string
      }
      is_lead_gen_or_manager: { Args: never; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_workspace_manager: { Args: never; Returns: boolean }
      lead_dial_block_reason: {
        Args: { p_agent_id: string; p_lead_id: string }
        Returns: string
      }
      leadgen_assign_leads: {
        Args: {
          p_agent_id: string
          p_campaign_id: string
          p_lead_ids: string[]
        }
        Returns: Json
      }
      leadgen_assignable_agents: {
        Args: { p_campaign_id?: string }
        Returns: {
          agent_code: string
          full_name: string
          id: string
          on_roster: boolean
          open_leads: number
        }[]
      }
      leadgen_auto_assign: {
        Args: { p_campaign_id: string; p_lead_ids?: string[] }
        Returns: Json
      }
      leadgen_campaigns: {
        Args: never
        Returns: {
          code: string
          country: string
          id: string
          name: string
          status: string
        }[]
      }
      leadgen_dashboard_stats: { Args: { p_days?: number }; Returns: Json }
      leadgen_known_hashes: {
        Args: { p_hashes: string[] }
        Returns: {
          kind: string
          phone_hash: string
        }[]
      }
      manager_client_report: {
        Args: { p_anonymize?: boolean; p_campaign_id?: string; p_client_id: string }
        Returns: Json
      }
      mark_onboarding_step: {
        Args: { p_step: string; p_workspace_id: string }
        Returns: undefined
      }
      my_campaign_ids: { Args: never; Returns: string[] }
      my_client_id: { Args: never; Returns: string }
      my_team_id: { Args: never; Returns: string }
      my_team_members: { Args: never; Returns: string[] }
      next_lead_for_agent: {
        Args: { p_agent_id: string }
        Returns: {
          address_line1: string | null
          agent_notes: string | null
          appointment_at: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          attempts: number
          batch_id: string | null
          campaign_id: string | null
          city: string | null
          claimed_at: string | null
          claimed_by: string | null
          company_name: string | null
          contact_name: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          custom: Json
          data_source_id: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          group_label: string | null
          id: string
          job_title: string | null
          last_attempt_at: string | null
          last_contact_at: string | null
          last_name: string | null
          next_step: string | null
          phone_e164: string | null
          phone_hash: string | null
          postcode: string | null
          region: string | null
          screened_at: string | null
          screening_status: string
          source: string | null
          status: string
          updated_at: string
          website: string | null
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      platform_set_workspace_status: {
        Args: {
          p_status: Database["public"]["Enums"]["workspace_status"]
          p_workspace_id: string
        }
        Returns: undefined
      }
      platform_workspace_stats: {
        Args: never
        Returns: {
          agents_active_today: number
          calls_today: number
          workspace_id: string
        }[]
      }
      promote_unphoned_contact: {
        Args: {
          p_contact_id: string
          p_phone_e164: string
          p_phone_raw: string
        }
        Returns: string
      }
      record_call_attempt: {
        Args: {
          p_callback_due_at?: string
          p_disposition_code: string
          p_lead_id: string
          p_notes?: string
        }
        Returns: {
          agent_id: string
          ai_summary: Json | null
          answered_at: string | null
          campaign_id: string | null
          conference_name: string | null
          created_at: string
          direction: string
          disposed_at: string | null
          disposition_id: string | null
          duration_seconds: number | null
          ended_at: string | null
          from_number: string | null
          id: string
          lead_call_sid: string | null
          lead_id: string
          notes: string | null
          provider: string
          provider_call_sid: string | null
          recording_path: string | null
          recording_sid: string | null
          recording_url: string | null
          started_at: string
          status: string
          to_number: string | null
          workspace_id: string
          zoom_call_id: string | null
          zoom_call_log_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "calls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_agent_from_campaign: {
        Args: { p_campaign_id: string; p_user_id: string }
        Returns: number
      }
      screen_lead_batch: {
        Args: { p_batch_id: string; p_evidence_url: string }
        Returns: number
      }
      screen_leads: { Args: { p_lead_ids: string[] }; Returns: number }
      set_my_lead_status: {
        Args: { p_lead_id: string; p_status: string }
        Returns: {
          address_line1: string | null
          agent_notes: string | null
          appointment_at: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          attempts: number
          batch_id: string | null
          campaign_id: string | null
          city: string | null
          claimed_at: string | null
          claimed_by: string | null
          company_name: string | null
          contact_name: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          custom: Json
          data_source_id: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          group_label: string | null
          id: string
          job_title: string | null
          last_attempt_at: string | null
          last_contact_at: string | null
          last_name: string | null
          next_step: string | null
          phone_e164: string | null
          phone_hash: string | null
          postcode: string | null
          region: string | null
          screened_at: string | null
          screening_status: string
          source: string | null
          status: string
          updated_at: string
          website: string | null
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_twilio_api_key: {
        Args: {
          p_api_key_secret: string
          p_api_key_sid: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      set_twilio_credentials: {
        Args: {
          p_account_sid: string
          p_auth_token: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      set_zoom_credentials: {
        Args: {
          p_account_id: string
          p_client_id: string
          p_client_secret: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      setup_progress: {
        Args: never
        Returns: {
          agents: number
          assignments: number
          branded: boolean
          calls: number
          campaigns: number
          leads: number
          leads_passed: number
          zoom_connected: boolean
        }[]
      }
      sweep_rate_limit_hits: { Args: never; Returns: undefined }
      update_my_lead: {
        Args: {
          p_address_line1: string
          p_agent_notes: string
          p_city: string
          p_company_name: string
          p_email: string
          p_extra?: Json
          p_first_name: string
          p_last_name: string
          p_lead_id: string
          p_phone_e164: string
          p_postcode: string
          p_region: string
        }
        Returns: {
          address_line1: string | null
          agent_notes: string | null
          appointment_at: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          attempts: number
          batch_id: string | null
          campaign_id: string | null
          city: string | null
          claimed_at: string | null
          claimed_by: string | null
          company_name: string | null
          contact_name: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          custom: Json
          data_source_id: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          group_label: string | null
          id: string
          job_title: string | null
          last_attempt_at: string | null
          last_contact_at: string | null
          last_name: string | null
          next_step: string | null
          phone_e164: string | null
          phone_hash: string | null
          postcode: string | null
          region: string | null
          screened_at: string | null
          screening_status: string
          source: string | null
          status: string
          updated_at: string
          website: string | null
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      workspace_live_status: {
        Args: never
        Returns: {
          call_started_at: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          user_id: string
        }[]
      }
      workspace_today_stats: {
        Args: never
        Returns: {
          calls_today: number
          connects_today: number
          conversions_today: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "ops_manager"
        | "team_lead"
        | "agent"
        | "qa_analyst"
        | "client"
        | "lead_gen"
      workspace_plan: "free" | "paid"
      workspace_status: "onboarding" | "active" | "suspended" | "canceled"
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
    Enums: {
      app_role: [
        "super_admin",
        "ops_manager",
        "team_lead",
        "agent",
        "qa_analyst",
        "client",
        "lead_gen",
      ],
      workspace_plan: ["free", "paid"],
      workspace_status: ["onboarding", "active", "suspended", "canceled"],
    },
  },
} as const
