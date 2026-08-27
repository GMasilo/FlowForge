/**
 * FlowForge database types.
 * Schema portion generated from Supabase; app helpers and QuestionAnswerType are maintained here.
 */

export type QuestionAnswerType =
  | 'text'
  | 'long_text'
  | 'name'
  | 'number'
  | 'email'
  | 'phone'
  | 'url'
  | 'address'
  | 'postal_code'
  | 'country'
  | 'date'
  | 'time'
  | 'datetime'
  | 'boolean'
  | 'choice'
  | 'numbered_choice'
  | 'gender'
  | 'rating'
  | 'slider'
  | 'stars'
  | 'nps'
  | 'color'
  | 'thumbs'
  | 'likert'
  | 'mood'
  | 'percentage'
  | 'currency'
  | 'otp'
  | 'confirm'
  | 'stepper'
  | 'file'
  | 'signature'
  | 'image_choice'
  | 'ranking'
  | 'location'
  | 'appointment'
  | 'matrix'
  | 'national_id'
  | 'password'
  | 'autocomplete'
  | 'audio'
  | 'payment'
  | 'captcha'
  | 'form'
  | 'shop'

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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      agent_presence: {
        Row: {
          instance_id: string
          last_seen_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          instance_id: string
          last_seen_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          instance_id?: string
          last_seen_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_presence_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          instance_id: string
          max_concurrent: number
          skills: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          instance_id: string
          max_concurrent?: number
          skills?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          instance_id?: string
          max_concurrent?: number
          skills?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_profiles_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_queues: {
        Row: {
          created_at: string
          description: string | null
          id: string
          instance_id: string
          is_default: boolean
          name: string
          routing_rules: Json
          sla_first_response_seconds: number
          sla_resolve_seconds: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          instance_id: string
          is_default?: boolean
          name: string
          routing_rules?: Json
          sla_first_response_seconds?: number
          sla_resolve_seconds?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          instance_id?: string
          is_default?: boolean
          name?: string
          routing_rules?: Json
          sla_first_response_seconds?: number
          sla_resolve_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_queues_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_deliveries: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          instance_id: string
          kind: string
          ok: boolean
          payload: Json
          rule_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          instance_id: string
          kind: string
          ok?: boolean
          payload?: Json
          rule_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          instance_id?: string
          kind?: string
          ok?: boolean
          payload?: Json
          rule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_deliveries_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_deliveries_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "instance_alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          instance_id: string | null
          meta: Json
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          meta?: Json
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          meta?: Json
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_connections: {
        Row: {
          added_by: string | null
          chatbot_id: string
          connection_id: string
          created_at: string
          id: string
        }
        Insert: {
          added_by?: string | null
          chatbot_id: string
          connection_id: string
          created_at?: string
          id?: string
        }
        Update: {
          added_by?: string | null
          chatbot_id?: string
          connection_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_connections_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_connections_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_entities: {
        Row: {
          chatbot_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          environment: string
          id: string
          key: string
          kind: Database["public"]["Enums"]["entity_kind"]
          name: string
          updated_at: string
        }
        Insert: {
          chatbot_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          environment?: string
          id?: string
          key: string
          kind?: Database["public"]["Enums"]["entity_kind"]
          name: string
          updated_at?: string
        }
        Update: {
          chatbot_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          environment?: string
          id?: string
          key?: string
          kind?: Database["public"]["Enums"]["entity_kind"]
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_entities_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flows: {
        Row: {
          chatbot_id: string
          created_at: string
          has_draft_changes: boolean
          id: string
          name: string
          published_at: string | null
          published_graph: Json | null
          staging_published_at: string | null
          staging_published_graph: Json | null
          staging_version: number
          updated_at: string
          version: number
        }
        Insert: {
          chatbot_id: string
          created_at?: string
          has_draft_changes?: boolean
          id?: string
          name?: string
          published_at?: string | null
          published_graph?: Json | null
          staging_published_at?: string | null
          staging_published_graph?: Json | null
          staging_version?: number
          updated_at?: string
          version?: number
        }
        Update: {
          chatbot_id?: string
          created_at?: string
          has_draft_changes?: boolean
          id?: string
          name?: string
          published_at?: string | null
          published_graph?: Json | null
          staging_published_at?: string | null
          staging_published_graph?: Json | null
          staging_version?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flows_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: true
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_shares: {
        Row: {
          chatbot_id: string
          created_at: string
          id: string
          shared_by: string | null
          user_id: string
        }
        Insert: {
          chatbot_id: string
          created_at?: string
          id?: string
          shared_by?: string | null
          user_id: string
        }
        Update: {
          chatbot_id?: string
          created_at?: string
          id?: string
          shared_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_shares_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_templates: {
        Row: {
          chatbot_id: string
          content: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          key: string
          kind: Database["public"]["Enums"]["template_kind"]
          name: string
          updated_at: string
        }
        Insert: {
          chatbot_id: string
          content?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          key: string
          kind: Database["public"]["Enums"]["template_kind"]
          name: string
          updated_at?: string
        }
        Update: {
          chatbot_id?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          key?: string
          kind?: Database["public"]["Enums"]["template_kind"]
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_templates_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_test_scenarios: {
        Row: {
          chatbot_id: string
          created_at: string
          created_by: string | null
          expected: Json
          globals: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          chatbot_id: string
          created_at?: string
          created_by?: string | null
          expected?: Json
          globals?: Json
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          chatbot_id?: string
          created_at?: string
          created_by?: string | null
          expected?: Json
          globals?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_test_scenarios_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_variables: {
        Row: {
          chatbot_id: string
          created_at: string
          default_value: Json | null
          description: string | null
          id: string
          key: string
          scope: Database["public"]["Enums"]["variable_scope"]
          source_node_key: string | null
          value_type: Database["public"]["Enums"]["variable_type"]
        }
        Insert: {
          chatbot_id: string
          created_at?: string
          default_value?: Json | null
          description?: string | null
          id?: string
          key: string
          scope?: Database["public"]["Enums"]["variable_scope"]
          source_node_key?: string | null
          value_type?: Database["public"]["Enums"]["variable_type"]
        }
        Update: {
          chatbot_id?: string
          created_at?: string
          default_value?: Json | null
          description?: string | null
          id?: string
          key?: string
          scope?: Database["public"]["Enums"]["variable_scope"]
          source_node_key?: string | null
          value_type?: Database["public"]["Enums"]["variable_type"]
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_variables_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbots: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          environment: string
          id: string
          instance_id: string
          name: string
          public_enabled: boolean
          public_slug: string | null
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          environment?: string
          id?: string
          instance_id: string
          name: string
          public_enabled?: boolean
          public_slug?: string | null
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          environment?: string
          id?: string
          instance_id?: string
          name?: string
          public_enabled?: boolean
          public_slug?: string | null
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbots_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_secrets: {
        Row: {
          config: Json
          connection_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          connection_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          connection_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_secrets_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_shares: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_shares_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          chatbot_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          environment: string
          id: string
          instance_id: string
          kind: Database["public"]["Enums"]["connection_kind"]
          name: string
          updated_at: string
          visibility: Database["public"]["Enums"]["connection_visibility"]
        }
        Insert: {
          chatbot_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          environment?: string
          id?: string
          instance_id: string
          kind: Database["public"]["Enums"]["connection_kind"]
          name: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["connection_visibility"]
        }
        Update: {
          chatbot_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          environment?: string
          id?: string
          instance_id?: string
          kind?: Database["public"]["Enums"]["connection_kind"]
          name?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["connection_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "connections_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_events: {
        Row: {
          accepted: boolean
          accepted_at: string
          evidence: Json
          id: string
          instance_id: string
          policy_key: string
          policy_version: number
          session_id: string | null
          visitor_key: string | null
        }
        Insert: {
          accepted?: boolean
          accepted_at?: string
          evidence?: Json
          id?: string
          instance_id: string
          policy_key: string
          policy_version: number
          session_id?: string | null
          visitor_key?: string | null
        }
        Update: {
          accepted?: boolean
          accepted_at?: string
          evidence?: Json
          id?: string
          instance_id?: string
          policy_key?: string
          policy_version?: number
          session_id?: string | null
          visitor_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_events_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_policies: {
        Row: {
          body: string
          created_at: string
          id: string
          instance_id: string
          is_active: boolean
          policy_key: string
          title: string
          version: number
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          instance_id: string
          is_active?: boolean
          policy_key: string
          title: string
          version?: number
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          instance_id?: string
          is_active?: boolean
          policy_key?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "consent_policies_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          node_key: string | null
          payload: Json
          seq: number
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          node_key?: string | null
          payload?: Json
          seq: number
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          node_key?: string | null
          payload?: Json
          seq?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          instance_id: string
          session_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          instance_id: string
          session_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          instance_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_notes_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_sessions: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          chatbot_id: string
          completed_at: string | null
          created_at: string
          environment: string
          error_summary: string | null
          escalated_at: string | null
          escalated_node_key: string | null
          experiment_id: string | null
          first_response_at: string | null
          id: string
          instance_id: string
          priority: number
          publish_version: number | null
          queue_id: string | null
          sla_due_at: string | null
          status: string
          transfer_meta: Json
          updated_at: string
          variables: Json
          variant_key: string | null
          visitor_key: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          chatbot_id: string
          completed_at?: string | null
          created_at?: string
          environment?: string
          error_summary?: string | null
          escalated_at?: string | null
          escalated_node_key?: string | null
          experiment_id?: string | null
          first_response_at?: string | null
          id?: string
          instance_id: string
          priority?: number
          publish_version?: number | null
          queue_id?: string | null
          sla_due_at?: string | null
          status?: string
          transfer_meta?: Json
          updated_at?: string
          variables?: Json
          variant_key?: string | null
          visitor_key?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          chatbot_id?: string
          completed_at?: string | null
          created_at?: string
          environment?: string
          error_summary?: string | null
          escalated_at?: string | null
          escalated_node_key?: string | null
          experiment_id?: string | null
          first_response_at?: string | null
          id?: string
          instance_id?: string
          priority?: number
          publish_version?: number | null
          queue_id?: string | null
          sla_due_at?: string | null
          status?: string
          transfer_meta?: Json
          updated_at?: string
          variables?: Json
          variant_key?: string | null
          visitor_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sessions_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_sessions_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "flow_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_sessions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_sessions_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "agent_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tag_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          session_id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          session_id: string
          tag_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          session_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tag_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "conversation_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          instance_id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          instance_id: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          instance_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tags_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      data_retention_policies: {
        Row: {
          events_ttl_days: number
          files_ttl_days: number
          id: string
          instance_id: string
          legal_hold: boolean
          payment_pii_ttl_days: number
          sessions_ttl_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          events_ttl_days?: number
          files_ttl_days?: number
          id?: string
          instance_id: string
          legal_hold?: boolean
          payment_pii_ttl_days?: number
          sessions_ttl_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          events_ttl_days?: number
          files_ttl_days?: number
          id?: string
          instance_id?: string
          legal_hold?: boolean
          payment_pii_ttl_days?: number
          sessions_ttl_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_retention_policies_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_attributes: {
        Row: {
          default_value: Json | null
          entity_id: string
          id: string
          is_identifier: boolean
          is_unique: boolean
          key: string
          label: string | null
          required: boolean
          sort_order: number
          value_type: Database["public"]["Enums"]["variable_type"]
        }
        Insert: {
          default_value?: Json | null
          entity_id: string
          id?: string
          is_identifier?: boolean
          is_unique?: boolean
          key: string
          label?: string | null
          required?: boolean
          sort_order?: number
          value_type?: Database["public"]["Enums"]["variable_type"]
        }
        Update: {
          default_value?: Json | null
          entity_id?: string
          id?: string
          is_identifier?: boolean
          is_unique?: boolean
          key?: string
          label?: string | null
          required?: boolean
          sort_order?: number
          value_type?: Database["public"]["Enums"]["variable_type"]
        }
        Relationships: [
          {
            foreignKeyName: "entity_attributes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "chatbot_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_dynamic_records: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          updated_at: string
          values: Json
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          updated_at?: string
          values?: Json
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          updated_at?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "entity_dynamic_records_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "chatbot_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_static_records: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          sort_order: number
          values: Json
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          sort_order?: number
          values?: Json
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          sort_order?: number
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "entity_static_records_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "chatbot_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_change_log: {
        Row: {
          author_id: string | null
          created_at: string
          flow_id: string
          id: string
          instance_id: string
          patch: Json
          snapshot: Json | null
          summary: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          flow_id: string
          id?: string
          instance_id: string
          patch?: Json
          snapshot?: Json | null
          summary: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          flow_id?: string
          id?: string
          instance_id?: string
          patch?: Json
          snapshot?: Json | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_change_log_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_change_log_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          flow_id: string
          id: string
          instance_id: string
          node_key: string | null
          parent_id: string | null
          resolved_at: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          flow_id: string
          id?: string
          instance_id: string
          node_key?: string | null
          parent_id?: string | null
          resolved_at?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          flow_id?: string
          id?: string
          instance_id?: string
          node_key?: string | null
          parent_id?: string | null
          resolved_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_comments_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_comments_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "flow_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_edges: {
        Row: {
          created_at: string
          flow_id: string
          id: string
          label: string | null
          source_handle: string | null
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          created_at?: string
          flow_id: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id: string
          target_node_id: string
        }
        Update: {
          created_at?: string
          flow_id?: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_edges_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_editor_presence: {
        Row: {
          color: string
          cursor: Json
          flow_id: string
          selected_node_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          cursor?: Json
          flow_id: string
          selected_node_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          cursor?: Json
          flow_id?: string
          selected_node_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_editor_presence_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_experiment_variants: {
        Row: {
          created_at: string
          experiment_id: string
          id: string
          is_control: boolean
          label: string
          publish_version_id: string | null
          published_graph: Json | null
          variant_key: string
          weight: number
        }
        Insert: {
          created_at?: string
          experiment_id: string
          id?: string
          is_control?: boolean
          label: string
          publish_version_id?: string | null
          published_graph?: Json | null
          variant_key: string
          weight?: number
        }
        Update: {
          created_at?: string
          experiment_id?: string
          id?: string
          is_control?: boolean
          label?: string
          publish_version_id?: string | null
          published_graph?: Json | null
          variant_key?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "flow_experiment_variants_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "flow_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_experiment_variants_publish_version_id_fkey"
            columns: ["publish_version_id"]
            isOneToOne: false
            referencedRelation: "flow_publish_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_experiments: {
        Row: {
          chatbot_id: string
          created_at: string
          created_by: string | null
          ended_at: string | null
          flow_id: string
          id: string
          instance_id: string
          name: string
          primary_metric: string
          started_at: string | null
          status: string
          traffic_split: Json
          updated_at: string
        }
        Insert: {
          chatbot_id: string
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          flow_id: string
          id?: string
          instance_id: string
          name: string
          primary_metric?: string
          started_at?: string | null
          status?: string
          traffic_split?: Json
          updated_at?: string
        }
        Update: {
          chatbot_id?: string
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          flow_id?: string
          id?: string
          instance_id?: string
          name?: string
          primary_metric?: string
          started_at?: string | null
          status?: string
          traffic_split?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_experiments_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_experiments_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_experiments_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_nodes: {
        Row: {
          config: Json
          created_at: string
          flow_id: string
          id: string
          key: string
          label: string | null
          position_x: number
          position_y: number
          type: Database["public"]["Enums"]["flow_node_type"]
        }
        Insert: {
          config?: Json
          created_at?: string
          flow_id: string
          id?: string
          key: string
          label?: string | null
          position_x?: number
          position_y?: number
          type: Database["public"]["Enums"]["flow_node_type"]
        }
        Update: {
          config?: Json
          created_at?: string
          flow_id?: string
          id?: string
          key?: string
          label?: string | null
          position_x?: number
          position_y?: number
          type?: Database["public"]["Enums"]["flow_node_type"]
        }
        Relationships: [
          {
            foreignKeyName: "flow_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_publish_versions: {
        Row: {
          chatbot_id: string
          flow_id: string
          id: string
          instance_id: string
          note: string | null
          published_at: string
          published_by: string | null
          published_graph: Json
          version: number
        }
        Insert: {
          chatbot_id: string
          flow_id: string
          id?: string
          instance_id: string
          note?: string | null
          published_at?: string
          published_by?: string | null
          published_graph: Json
          version: number
        }
        Update: {
          chatbot_id?: string
          flow_id?: string
          id?: string
          instance_id?: string
          note?: string | null
          published_at?: string
          published_by?: string | null
          published_graph?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "flow_publish_versions_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_publish_versions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_publish_versions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_alert_rules: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          instance_id: string
          last_notified_at: string | null
          last_triggered_at: string | null
          metric: string
          name: string
          notify_email: boolean
          notify_slack: boolean
          slack_integration_id: string | null
          threshold: number
          updated_at: string
          window_hours: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          instance_id: string
          last_notified_at?: string | null
          last_triggered_at?: string | null
          metric: string
          name: string
          notify_email?: boolean
          notify_slack?: boolean
          slack_integration_id?: string | null
          threshold?: number
          updated_at?: string
          window_hours?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          instance_id?: string
          last_notified_at?: string | null
          last_triggered_at?: string | null
          metric?: string
          name?: string
          notify_email?: boolean
          notify_slack?: boolean
          slack_integration_id?: string | null
          threshold?: number
          updated_at?: string
          window_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "instance_alert_rules_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_alert_rules_slack_integration_id_fkey"
            columns: ["slack_integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_alert_settings: {
        Row: {
          digest_enabled: boolean
          digest_slack_integration_id: string | null
          digest_weekday: number
          instance_id: string
          last_digest_at: string | null
          updated_at: string
        }
        Insert: {
          digest_enabled?: boolean
          digest_slack_integration_id?: string | null
          digest_weekday?: number
          instance_id: string
          last_digest_at?: string | null
          updated_at?: string
        }
        Update: {
          digest_enabled?: boolean
          digest_slack_integration_id?: string | null
          digest_weekday?: number
          instance_id?: string
          last_digest_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_alert_settings_digest_slack_integration_id_fkey"
            columns: ["digest_slack_integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_alert_settings_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_environments: {
        Row: {
          created_at: string
          environment: string
          instance_id: string
          is_enabled: boolean
          label: string
        }
        Insert: {
          created_at?: string
          environment: string
          instance_id: string
          is_enabled?: boolean
          label: string
        }
        Update: {
          created_at?: string
          environment?: string
          instance_id?: string
          is_enabled?: boolean
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_environments_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_invites: {
        Row: {
          created_at: string
          department: string | null
          display_name: string | null
          email: string
          email_last_error: string | null
          email_sent_at: string | null
          id: string
          instance_id: string
          invited_by: string | null
          job_title: string | null
          notes: string | null
          phone: string | null
          role: Database["public"]["Enums"]["instance_role"]
          token: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          display_name?: string | null
          email: string
          email_last_error?: string | null
          email_sent_at?: string | null
          id?: string
          instance_id: string
          invited_by?: string | null
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["instance_role"]
          token: string
        }
        Update: {
          created_at?: string
          department?: string | null
          display_name?: string | null
          email?: string
          email_last_error?: string | null
          email_sent_at?: string | null
          id?: string
          instance_id?: string
          invited_by?: string | null
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["instance_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_invites_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_members: {
        Row: {
          created_at: string
          department: string | null
          disabled_at: string | null
          display_name: string | null
          instance_id: string
          job_title: string | null
          notes: string | null
          phone: string | null
          role: Database["public"]["Enums"]["instance_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          disabled_at?: string | null
          display_name?: string | null
          instance_id: string
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["instance_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string | null
          disabled_at?: string | null
          display_name?: string | null
          instance_id?: string
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["instance_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_members_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_scim_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          instance_id: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          token_hash: string
          token_prefix: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          instance_id: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          instance_id?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_scim_tokens_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_sso_configs: {
        Row: {
          attribute_map: Json
          created_at: string
          default_role: Database["public"]["Enums"]["instance_role"]
          domains: string[]
          enabled: boolean
          enforce_sso: boolean
          group_role_map: Json
          id: string
          instance_id: string
          name: string
          oidc_authorization_url: string | null
          oidc_client_id: string | null
          oidc_client_secret_ref: string | null
          oidc_issuer: string | null
          oidc_jwks_url: string | null
          oidc_token_url: string | null
          protocol: string
          saml_acs_url: string | null
          saml_certificate: string | null
          saml_entity_id: string | null
          saml_sso_url: string | null
          updated_at: string
        }
        Insert: {
          attribute_map?: Json
          created_at?: string
          default_role?: Database["public"]["Enums"]["instance_role"]
          domains?: string[]
          enabled?: boolean
          enforce_sso?: boolean
          group_role_map?: Json
          id?: string
          instance_id: string
          name: string
          oidc_authorization_url?: string | null
          oidc_client_id?: string | null
          oidc_client_secret_ref?: string | null
          oidc_issuer?: string | null
          oidc_jwks_url?: string | null
          oidc_token_url?: string | null
          protocol: string
          saml_acs_url?: string | null
          saml_certificate?: string | null
          saml_entity_id?: string | null
          saml_sso_url?: string | null
          updated_at?: string
        }
        Update: {
          attribute_map?: Json
          created_at?: string
          default_role?: Database["public"]["Enums"]["instance_role"]
          domains?: string[]
          enabled?: boolean
          enforce_sso?: boolean
          group_role_map?: Json
          id?: string
          instance_id?: string
          name?: string
          oidc_authorization_url?: string | null
          oidc_client_id?: string | null
          oidc_client_secret_ref?: string | null
          oidc_issuer?: string | null
          oidc_jwks_url?: string | null
          oidc_token_url?: string | null
          protocol?: string
          saml_acs_url?: string | null
          saml_certificate?: string | null
          saml_entity_id?: string | null
          saml_sso_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_sso_configs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_usage_monthly: {
        Row: {
          conversations: number
          emails: number
          http_calls: number
          instance_id: string
          updated_at: string
          year_month: string
        }
        Insert: {
          conversations?: number
          emails?: number
          http_calls?: number
          instance_id: string
          updated_at?: string
          year_month: string
        }
        Update: {
          conversations?: number
          emails?: number
          http_calls?: number
          instance_id?: string
          updated_at?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_usage_monthly_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          events: string[]
          id: string
          instance_id: string
          name: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          events?: string[]
          id?: string
          instance_id: string
          name: string
          secret?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          events?: string[]
          id?: string
          instance_id?: string
          name?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_webhooks_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instances: {
        Row: {
          billing_address: string | null
          brand_accent_color: string | null
          brand_apply_to_public_chat: boolean
          brand_display_name: string | null
          brand_logo_url: string | null
          contact_email: string | null
          created_at: string
          created_by: string | null
          features: Json
          http_host_allowlist: string[]
          id: string
          legal_name: string | null
          name: string
          notes: string | null
          phone: string | null
          quota_max_conversations_month: number
          quota_max_emails_month: number
          quota_max_http_calls_month: number
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          billing_address?: string | null
          brand_accent_color?: string | null
          brand_apply_to_public_chat?: boolean
          brand_display_name?: string | null
          brand_logo_url?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          features?: Json
          http_host_allowlist?: string[]
          id?: string
          legal_name?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          quota_max_conversations_month?: number
          quota_max_emails_month?: number
          quota_max_http_calls_month?: number
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          billing_address?: string | null
          brand_accent_color?: string | null
          brand_apply_to_public_chat?: boolean
          brand_display_name?: string | null
          brand_logo_url?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          features?: Json
          http_host_allowlist?: string[]
          id?: string
          legal_name?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          quota_max_conversations_month?: number
          quota_max_emails_month?: number
          quota_max_http_calls_month?: number
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      integration_secrets: {
        Row: {
          integration_id: string
          secrets: Json
          updated_at: string
        }
        Insert: {
          integration_id: string
          secrets?: Json
          updated_at?: string
        }
        Update: {
          integration_id?: string
          secrets?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_secrets_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: true
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          instance_id: string
          name: string
          provider: Database["public"]["Enums"]["integration_provider"]
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          instance_id: string
          name: string
          provider: Database["public"]["Enums"]["integration_provider"]
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          instance_id?: string
          name?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_installs: {
        Row: {
          created_at: string
          id: string
          installed_by: string | null
          listing_id: string
          target_chatbot_id: string | null
          target_instance_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          installed_by?: string | null
          listing_id: string
          target_chatbot_id?: string | null
          target_instance_id: string
        }
        Update: {
          created_at?: string
          id?: string
          installed_by?: string | null
          listing_id?: string
          target_chatbot_id?: string | null
          target_instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_installs_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_installs_target_chatbot_id_fkey"
            columns: ["target_chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_installs_target_instance_id_fkey"
            columns: ["target_instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          install_count: number
          kind: string
          pack: Json
          publisher_instance_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          screenshots: Json
          slug: string
          source_chatbot_id: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          install_count?: number
          kind: string
          pack?: Json
          publisher_instance_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshots?: Json
          slug: string
          source_chatbot_id?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          install_count?: number
          kind?: string
          pack?: Json
          publisher_instance_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshots?: Json
          slug?: string
          source_chatbot_id?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_publisher_instance_id_fkey"
            columns: ["publisher_instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_source_chatbot_id_fkey"
            columns: ["source_chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount: number | null
          chatbot_id: string
          checkout_url: string | null
          connection_id: string
          created_at: string
          currency: string
          id: string
          instance_id: string
          item_name: string
          node_key: string
          payload: Json
          provider: string
          provider_payment_id: string | null
          reference: string
          session_id: string | null
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount?: number | null
          chatbot_id: string
          checkout_url?: string | null
          connection_id: string
          created_at?: string
          currency?: string
          id?: string
          instance_id: string
          item_name?: string
          node_key?: string
          payload?: Json
          provider?: string
          provider_payment_id?: string | null
          reference: string
          session_id?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount?: number | null
          chatbot_id?: string
          checkout_url?: string | null
          connection_id?: string
          created_at?: string
          currency?: string
          id?: string
          instance_id?: string
          item_name?: string
          node_key?: string
          payload?: Json
          provider?: string
          provider_payment_id?: string | null
          reference?: string
          session_id?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_superuser: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          is_superuser?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_superuser?: boolean
        }
        Relationships: []
      }
      saved_conversation_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          instance_id: string
          is_shared: boolean
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          instance_id: string
          is_shared?: boolean
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          instance_id?: string
          is_shared?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_conversation_views_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          body: string | null
          created_at: string
          href: string | null
          id: string
          instance_id: string
          kind: string
          meta: Json
          read_at: string | null
          resource_id: string | null
          resource_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          instance_id: string
          kind: string
          meta?: Json
          read_at?: string | null
          resource_id?: string | null
          resource_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          instance_id?: string
          kind?: string
          meta?: Json
          read_at?: string | null
          resource_id?: string | null
          resource_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          created_at: string
          error: string | null
          event: string
          id: string
          ok: boolean | null
          payload: Json
          status_code: number | null
          webhook_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event: string
          id?: string
          ok?: boolean | null
          payload: Json
          status_code?: number | null
          webhook_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          ok?: boolean | null
          payload?: Json
          status_code?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "instance_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      analytics_cohort_weekly: {
        Row: {
          chatbot_id: string | null
          cohort_week: string | null
          instance_id: string | null
          sessions_abandoned: number | null
          sessions_completed: number | null
          sessions_started: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sessions_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_sessions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_revenue_daily: {
        Row: {
          chatbot_id: string | null
          currency: string | null
          day: string | null
          experiment_id: string | null
          instance_id: string | null
          node_key: string | null
          payments_verified: number | null
          publish_version: number | null
          revenue_amount: number | null
          variant_key: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sessions_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "flow_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_step_funnel_daily: {
        Row: {
          chatbot_id: string | null
          day: string | null
          experiment_id: string | null
          instance_id: string | null
          node_key: string | null
          publish_version: number | null
          sessions_reached: number | null
          variant_key: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sessions_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_sessions_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "flow_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_sessions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_conversation_note: {
        Args: { p_body: string; p_session_id: string }
        Returns: {
          author_id: string
          body: string
          created_at: string
          id: string
          instance_id: string
          session_id: string
        }
        SetofOptions: {
          from: "*"
          to: "conversation_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_flow_comment: {
        Args: {
          p_body: string
          p_flow_id: string
          p_node_key?: string | null
          p_parent_id?: string | null
        }
        Returns: {
          author_id: string
          body: string
          created_at: string
          flow_id: string
          id: string
          instance_id: string
          node_key: string | null
          parent_id: string | null
          resolved_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "flow_comments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_organisation_member: {
        Args: {
          p_department?: string | null
          p_display_name?: string | null
          p_email: string
          p_instance_id: string
          p_job_title?: string | null
          p_notes?: string | null
          p_phone?: string | null
          p_role?: Database["public"]["Enums"]["instance_role"]
        }
        Returns: Json
      }
      agent_reply_to_conversation: {
        Args: { p_session_id: string; p_text: string }
        Returns: {
          created_at: string
          id: string
          kind: string
          node_key: string | null
          payload: Json
          seq: number
          session_id: string
        }
        SetofOptions: {
          from: "*"
          to: "conversation_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      append_conversation_event: {
        Args: {
          p_kind: string
          p_node_key?: string | null
          p_payload?: Json | null
          p_session_id: string
        }
        Returns: {
          created_at: string
          id: string
          kind: string
          node_key: string | null
          payload: Json
          seq: number
          session_id: string
        }
        SetofOptions: {
          from: "*"
          to: "conversation_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      append_flow_change_log: {
        Args: {
          p_flow_id: string
          p_patch?: Json | null
          p_snapshot?: Json | null
          p_summary: string
        }
        Returns: {
          author_id: string | null
          created_at: string
          flow_id: string
          id: string
          instance_id: string
          patch: Json
          snapshot: Json | null
          summary: string
        }
        SetofOptions: {
          from: "*"
          to: "flow_change_log"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_conversation: {
        Args: { p_assignee: string; p_queue_id?: string | null; p_session_id: string }
        Returns: {
          assigned_at: string | null
          assigned_to: string | null
          chatbot_id: string
          completed_at: string | null
          created_at: string
          environment: string
          error_summary: string | null
          escalated_at: string | null
          escalated_node_key: string | null
          experiment_id: string | null
          first_response_at: string | null
          id: string
          instance_id: string
          priority: number
          publish_version: number | null
          queue_id: string | null
          sla_due_at: string | null
          status: string
          transfer_meta: Json
          updated_at: string
          variables: Json
          variant_key: string | null
          visitor_key: string | null
        }
        SetofOptions: {
          from: "*"
          to: "conversation_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_chatbot: {
        Args: { p_chatbot_id: string }
        Returns: boolean
      }
      can_access_flow: {
        Args: { p_flow_id: string }
        Returns: boolean
      }
      can_manage_connection: {
        Args: { p_connection_id: string }
        Returns: boolean
      }
      can_see_connection_meta: {
        Args: { p_connection_id: string }
        Returns: boolean
      }
      can_share_chatbot: {
        Args: { p_chatbot_id: string }
        Returns: boolean
      }
      chatbot_instance_id: { Args: { p_chatbot_id: string }; Returns: string }
      check_instance_quota: {
        Args: { p_instance_id: string; p_kind: string }
        Returns: boolean
      }
      claim_conversation: {
        Args: { p_session_id: string }
        Returns: {
          assigned_at: string | null
          assigned_to: string | null
          chatbot_id: string
          completed_at: string | null
          created_at: string
          environment: string
          error_summary: string | null
          escalated_at: string | null
          escalated_node_key: string | null
          experiment_id: string | null
          first_response_at: string | null
          id: string
          instance_id: string
          priority: number
          publish_version: number | null
          queue_id: string | null
          sla_due_at: string | null
          status: string
          transfer_meta: Json
          updated_at: string
          variables: Json
          variant_key: string | null
          visitor_key: string | null
        }
        SetofOptions: {
          from: "*"
          to: "conversation_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_instance_invites_for_user: {
        Args: { p_email: string; p_user_id: string }
        Returns: undefined
      }
      claim_my_organisation_invites: { Args: never; Returns: number }
      clone_chatbot_to_instance: {
        Args: {
          p_include_published?: boolean | null
          p_new_name?: string | null
          p_source_chatbot_id: string
          p_target_instance_id: string
        }
        Returns: Json
      }
      complete_conversation_session: {
        Args: {
          p_error_summary?: string | null
          p_session_id: string
          p_status?: string | null
          p_variables?: Json | null
        }
        Returns: {
          assigned_at: string | null
          assigned_to: string | null
          chatbot_id: string
          completed_at: string | null
          created_at: string
          environment: string
          error_summary: string | null
          escalated_at: string | null
          escalated_node_key: string | null
          experiment_id: string | null
          first_response_at: string | null
          id: string
          instance_id: string
          priority: number
          publish_version: number | null
          queue_id: string | null
          sla_due_at: string | null
          status: string
          transfer_meta: Json
          updated_at: string
          variables: Json
          variant_key: string | null
          visitor_key: string | null
        }
        SetofOptions: {
          from: "*"
          to: "conversation_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      connection_config_for_payment: {
        Args: { p_connection_id: string }
        Returns: Json
      }
      connection_config_for_public_chat: {
        Args: {
          p_chatbot_id: string
          p_connection_id: string
          p_session_id: string
        }
        Returns: Json
      }
      connection_config_for_use: {
        Args: { p_chatbot_id: string; p_connection_id: string }
        Returns: Json
      }
      create_instance: {
        Args: { p_name: string; p_slug: string }
        Returns: {
          billing_address: string | null
          brand_accent_color: string | null
          brand_apply_to_public_chat: boolean
          brand_display_name: string | null
          brand_logo_url: string | null
          contact_email: string | null
          created_at: string
          created_by: string | null
          features: Json
          http_host_allowlist: string[]
          id: string
          legal_name: string | null
          name: string
          notes: string | null
          phone: string | null
          quota_max_conversations_month: number
          quota_max_emails_month: number
          quota_max_http_calls_month: number
          slug: string
          updated_at: string
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "instances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_organisation: {
        Args: {
          p_billing_address?: string | null
          p_contact_email?: string | null
          p_legal_name?: string | null
          p_name: string
          p_notes?: string | null
          p_phone?: string | null
          p_slug: string
          p_website?: string | null
        }
        Returns: {
          billing_address: string | null
          brand_accent_color: string | null
          brand_apply_to_public_chat: boolean
          brand_display_name: string | null
          brand_logo_url: string | null
          contact_email: string | null
          created_at: string
          created_by: string | null
          features: Json
          http_host_allowlist: string[]
          id: string
          legal_name: string | null
          name: string
          notes: string | null
          phone: string | null
          quota_max_conversations_month: number
          quota_max_emails_month: number
          quota_max_http_calls_month: number
          slug: string
          updated_at: string
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "instances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_payment_intent: {
        Args: {
          p_amount: number
          p_chatbot_id: string
          p_checkout_url: string
          p_connection_id: string
          p_currency: string
          p_instance_id: string
          p_item_name: string
          p_node_key: string
          p_provider: string
          p_reference: string
          p_session_id: string
        }
        Returns: Json
      }
      create_scim_token: {
        Args: { p_instance_id: string; p_name?: string | null }
        Returns: Json
      }
      create_user_notification: {
        Args: {
          p_body?: string | null
          p_href?: string | null
          p_instance_id: string
          p_kind: string
          p_meta?: Json
          p_resource_id?: string | null
          p_resource_type?: string | null
          p_title: string
          p_user_id: string
        }
        Returns: {
          body: string | null
          created_at: string
          href: string | null
          id: string
          instance_id: string
          kind: string
          meta: Json
          read_at: string | null
          resource_id: string | null
          resource_type: string | null
          title: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_marketplace_listing: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      delete_visitor_data: {
        Args: { p_instance_id: string; p_visitor_key: string }
        Returns: Json
      }
      ensure_default_agent_queue: {
        Args: { p_instance_id: string }
        Returns: {
          created_at: string
          description: string | null
          id: string
          instance_id: string
          is_default: boolean
          name: string
          routing_rules: Json
          sla_first_response_seconds: number
          sla_resolve_seconds: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "agent_queues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_instance_environments: {
        Args: { p_instance_id: string }
        Returns: undefined
      }
      escalate_conversation_session: {
        Args: { p_node_key?: string | null; p_session_id: string }
        Returns: {
          assigned_at: string | null
          assigned_to: string | null
          chatbot_id: string
          completed_at: string | null
          created_at: string
          environment: string
          error_summary: string | null
          escalated_at: string | null
          escalated_node_key: string | null
          experiment_id: string | null
          first_response_at: string | null
          id: string
          instance_id: string
          priority: number
          publish_version: number | null
          queue_id: string | null
          sla_due_at: string | null
          status: string
          transfer_meta: Json
          updated_at: string
          variables: Json
          variant_key: string | null
          visitor_key: string | null
        }
        SetofOptions: {
          from: "*"
          to: "conversation_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      export_visitor_data: {
        Args: { p_instance_id: string; p_visitor_key: string }
        Returns: Json
      }
      flow_instance_id: { Args: { p_flow_id: string }; Returns: string }
      get_conversation_session_for_webhook: {
        Args: { p_session_id: string }
        Returns: Json
      }
      get_experiment_stats: { Args: { p_experiment_id: string }; Returns: Json }
      get_invite_for_sending: { Args: { p_invite_id: string }; Returns: Json }
      get_payment_intent: { Args: { p_reference: string }; Returns: Json }
      get_public_chatbot: { Args: { p_slug: string }; Returns: Json }
      has_instance_role: {
        Args: {
          p_instance_id: string
          p_roles: Database["public"]["Enums"]["instance_role"][]
        }
        Returns: boolean
      }
      increment_instance_usage: {
        Args: {
          p_conversations?: number | null
          p_emails?: number | null
          p_http_calls?: number | null
          p_instance_id: string
        }
        Returns: {
          conversations: number
          emails: number
          http_calls: number
          instance_id: string
          updated_at: string
          year_month: string
        }
        SetofOptions: {
          from: "*"
          to: "instance_usage_monthly"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      instance_feature_enabled: {
        Args: { p_feature: string; p_instance_id: string }
        Returns: boolean
      }
      instance_http_allowlist: {
        Args: { p_instance_id: string }
        Returns: string[]
      }
      is_agent_operator: { Args: { p_instance_id: string }; Returns: boolean }
      is_instance_member: { Args: { p_instance_id: string }; Returns: boolean }
      is_superuser: { Args: never; Returns: boolean }
      jit_provision_sso_member: {
        Args: {
          p_groups?: string[] | null
          p_instance_id: string
          p_sso_config_id?: string | null
          p_user_id: string
        }
        Returns: {
          created_at: string
          department: string | null
          disabled_at: string | null
          display_name: string | null
          instance_id: string
          job_title: string | null
          notes: string | null
          phone: string | null
          role: Database["public"]["Enums"]["instance_role"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "instance_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      list_conversation_events_after: {
        Args: { p_after_seq?: number | null; p_session_id: string }
        Returns: {
          created_at: string
          id: string
          kind: string
          node_key: string | null
          payload: Json
          seq: number
          session_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "conversation_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_organisation_users: {
        Args: { p_instance_id: string }
        Returns: Json
      }
      list_sla_breached_sessions: {
        Args: { p_instance_id: string }
        Returns: {
          assigned_at: string | null
          assigned_to: string | null
          chatbot_id: string
          completed_at: string | null
          created_at: string
          environment: string
          error_summary: string | null
          escalated_at: string | null
          escalated_node_key: string | null
          experiment_id: string | null
          first_response_at: string | null
          id: string
          instance_id: string
          priority: number
          publish_version: number | null
          queue_id: string | null
          sla_due_at: string | null
          status: string
          transfer_meta: Json
          updated_at: string
          variables: Json
          variant_key: string | null
          visitor_key: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "conversation_sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_webhooks_for_event: {
        Args: { p_event: string; p_instance_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          enabled: boolean
          events: string[]
          id: string
          instance_id: string
          name: string
          secret: string
          updated_at: string
          url: string
        }[]
        SetofOptions: {
          from: "*"
          to: "instance_webhooks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lookup_organisation_invite: { Args: { p_token: string }; Returns: Json }
      lookup_profile_id_by_email: { Args: { p_email: string }; Returns: string }
      lookup_sso_for_email: { Args: { p_email: string }; Returns: Json }
      mark_invite_email_status: {
        Args: { p_error?: string | null; p_invite_id: string; p_ok: boolean }
        Returns: undefined
      }
      mark_all_notifications_read: {
        Args: { p_instance_id?: string | null }
        Returns: number
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: {
          body: string | null
          created_at: string
          href: string | null
          id: string
          instance_id: string
          kind: string
          meta: Json
          read_at: string | null
          resource_id: string | null
          resource_type: string | null
          title: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notify_instance_roles: {
        Args: {
          p_body?: string | null
          p_exclude_user?: string | null
          p_href?: string | null
          p_instance_id: string
          p_kind: string
          p_meta?: Json
          p_resource_id?: string | null
          p_resource_type?: string | null
          p_roles: Database["public"]["Enums"]["instance_role"][]
          p_title: string
        }
        Returns: number
      }
      permanently_delete_chatbot: {
        Args: { p_chatbot_id: string }
        Returns: undefined
      }
      pick_experiment_variant: {
        Args: { p_experiment_id: string; p_visitor_key: string }
        Returns: {
          created_at: string
          experiment_id: string
          id: string
          is_control: boolean
          label: string
          publish_version_id: string | null
          published_graph: Json | null
          variant_key: string
          weight: number
        }
        SetofOptions: {
          from: "*"
          to: "flow_experiment_variants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      promote_staging_to_production: {
        Args: { p_flow_id: string; p_note?: string | null }
        Returns: {
          chatbot_id: string
          flow_id: string
          id: string
          instance_id: string
          note: string | null
          published_at: string
          published_by: string | null
          published_graph: Json
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "flow_publish_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_flow_staging: {
        Args: { p_flow_id: string; p_note?: string | null; p_published_graph: Json }
        Returns: {
          chatbot_id: string
          created_at: string
          has_draft_changes: boolean
          id: string
          name: string
          published_at: string | null
          published_graph: Json | null
          staging_published_at: string | null
          staging_published_graph: Json | null
          staging_version: number
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "chatbot_flows"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_flow_version: {
        Args: { p_flow_id: string; p_note?: string | null; p_published_graph: Json }
        Returns: {
          chatbot_id: string
          flow_id: string
          id: string
          instance_id: string
          note: string | null
          published_at: string
          published_by: string | null
          published_graph: Json
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "flow_publish_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      purge_expired_conversation_data: {
        Args: { p_instance_id: string }
        Returns: Json
      }
      record_consent_event: {
        Args: {
          p_accepted?: boolean | null
          p_evidence?: Json | null
          p_policy_key: string
          p_policy_version: number
          p_session_id: string
        }
        Returns: {
          accepted: boolean
          accepted_at: string
          evidence: Json
          id: string
          instance_id: string
          policy_key: string
          policy_version: number
          session_id: string | null
          visitor_key: string | null
        }
        SetofOptions: {
          from: "*"
          to: "consent_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_marketplace_install: {
        Args: {
          p_listing_id: string
          p_target_chatbot_id?: string | null
          p_target_instance_id: string
        }
        Returns: {
          created_at: string
          id: string
          installed_by: string | null
          listing_id: string
          target_chatbot_id: string | null
          target_instance_id: string
        }
        SetofOptions: {
          from: "*"
          to: "marketplace_installs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_webhook_delivery: {
        Args: {
          p_error?: string | null
          p_event: string
          p_ok?: boolean | null
          p_payload: Json
          p_status_code?: number | null
          p_webhook_id: string
        }
        Returns: string
      }
      remove_organisation_member: {
        Args: { p_instance_id: string; p_user_id: string }
        Returns: undefined
      }
      resolve_conversation_handoff: {
        Args: { p_session_id: string }
        Returns: {
          assigned_at: string | null
          assigned_to: string | null
          chatbot_id: string
          completed_at: string | null
          created_at: string
          environment: string
          error_summary: string | null
          escalated_at: string | null
          escalated_node_key: string | null
          experiment_id: string | null
          first_response_at: string | null
          id: string
          instance_id: string
          priority: number
          publish_version: number | null
          queue_id: string | null
          sla_due_at: string | null
          status: string
          transfer_meta: Json
          updated_at: string
          variables: Json
          variant_key: string | null
          visitor_key: string | null
        }
        SetofOptions: {
          from: "*"
          to: "conversation_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_flow_comment: {
        Args: { p_comment_id: string }
        Returns: {
          author_id: string
          body: string
          created_at: string
          flow_id: string
          id: string
          instance_id: string
          node_key: string | null
          parent_id: string | null
          resolved_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "flow_comments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restore_chatbot: { Args: { p_chatbot_id: string }; Returns: undefined }
      restore_connection: {
        Args: { p_connection_id: string }
        Returns: undefined
      }
      restore_entity: { Args: { p_entity_id: string }; Returns: undefined }
      restore_flow_change_log: { Args: { p_change_id: string }; Returns: Json }
      review_marketplace_listing: {
        Args: { p_approve: boolean; p_listing_id: string }
        Returns: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          install_count: number
          kind: string
          pack: Json
          publisher_instance_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          screenshots: Json
          slug: string
          source_chatbot_id: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "marketplace_listings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rollback_flow_version: {
        Args: { p_flow_id: string; p_version: number }
        Returns: {
          chatbot_id: string
          created_at: string
          has_draft_changes: boolean
          id: string
          name: string
          published_at: string | null
          published_graph: Json | null
          staging_published_at: string | null
          staging_published_graph: Json | null
          staging_version: number
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "chatbot_flows"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_flow_draft: {
        Args: {
          p_edges: Json
          p_expected_updated_at?: string | null
          p_flow_id: string
          p_nodes: Json
          p_step_vars?: Json
        }
        Returns: string
      }
      scim_upsert_member: {
        Args: {
          p_active?: boolean | null
          p_instance_id: string
          p_role?: Database["public"]["Enums"]["instance_role"]
          p_user_id: string
        }
        Returns: {
          created_at: string
          department: string | null
          disabled_at: string | null
          display_name: string | null
          instance_id: string
          job_title: string | null
          notes: string | null
          phone: string | null
          role: Database["public"]["Enums"]["instance_role"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "instance_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_agent_presence: {
        Args: { p_instance_id: string; p_status: string }
        Returns: {
          instance_id: string
          last_seen_at: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "agent_presence"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_conversation_tags: {
        Args: { p_session_id: string; p_tag_ids: string[] }
        Returns: undefined
      }
      set_experiment_status: {
        Args: { p_experiment_id: string; p_status: string }
        Returns: {
          chatbot_id: string
          created_at: string
          created_by: string | null
          ended_at: string | null
          flow_id: string
          id: string
          instance_id: string
          name: string
          primary_metric: string
          started_at: string | null
          status: string
          traffic_split: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "flow_experiments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      share_flow_with_members: {
        Args: {
          p_flow_id: string
          p_message?: string | null
          p_user_ids: string[]
        }
        Returns: Json
      }
      soft_delete_chatbot: {
        Args: { p_chatbot_id: string }
        Returns: undefined
      }
      soft_delete_connection: {
        Args: { p_connection_id: string }
        Returns: undefined
      }
      soft_delete_entity: { Args: { p_entity_id: string }; Returns: undefined }
      start_public_conversation: {
        Args: { p_slug: string; p_visitor_key?: string | null }
        Returns: Json
      }
      start_public_conversation_env: {
        Args: { p_environment?: string | null; p_slug: string; p_visitor_key?: string | null }
        Returns: Json
      }
      submit_marketplace_listing: {
        Args: { p_listing_id: string }
        Returns: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          install_count: number
          kind: string
          pack: Json
          publisher_instance_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          screenshots: Json
          slug: string
          source_chatbot_id: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "marketplace_listings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transfer_conversation: {
        Args: {
          p_note?: string | null
          p_session_id: string
          p_to_queue_id?: string | null
          p_to_user?: string | null
        }
        Returns: {
          assigned_at: string | null
          assigned_to: string | null
          chatbot_id: string
          completed_at: string | null
          created_at: string
          environment: string
          error_summary: string | null
          escalated_at: string | null
          escalated_node_key: string | null
          experiment_id: string | null
          first_response_at: string | null
          id: string
          instance_id: string
          priority: number
          publish_version: number | null
          queue_id: string | null
          sla_due_at: string | null
          status: string
          transfer_meta: Json
          updated_at: string
          variables: Json
          variant_key: string | null
          visitor_key: string | null
        }
        SetofOptions: {
          from: "*"
          to: "conversation_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transfer_public_conversation: {
        Args: {
          p_from_node_key?: string | null
          p_session_id: string
          p_start_node_key?: string | null
          p_target_chatbot_id: string
          p_variables?: Json
        }
        Returns: Json
      }
      update_instance_features: {
        Args: { p_features: Json; p_instance_id: string }
        Returns: {
          billing_address: string | null
          brand_accent_color: string | null
          brand_apply_to_public_chat: boolean
          brand_display_name: string | null
          brand_logo_url: string | null
          contact_email: string | null
          created_at: string
          created_by: string | null
          features: Json
          http_host_allowlist: string[]
          id: string
          legal_name: string | null
          name: string
          notes: string | null
          phone: string | null
          quota_max_conversations_month: number
          quota_max_emails_month: number
          quota_max_http_calls_month: number
          slug: string
          updated_at: string
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "instances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_organisation: {
        Args: {
          p_billing_address?: string | null
          p_brand_accent_color?: string | null
          p_brand_apply_to_public_chat?: boolean | null
          p_brand_display_name?: string | null
          p_brand_logo_url?: string | null
          p_contact_email?: string | null
          p_id: string
          p_legal_name?: string | null
          p_name: string
          p_notes?: string | null
          p_phone?: string | null
          p_slug: string
          p_website?: string | null
        }
        Returns: {
          billing_address: string | null
          brand_accent_color: string | null
          brand_apply_to_public_chat: boolean
          brand_display_name: string | null
          brand_logo_url: string | null
          contact_email: string | null
          created_at: string
          created_by: string | null
          features: Json
          http_host_allowlist: string[]
          id: string
          legal_name: string | null
          name: string
          notes: string | null
          phone: string | null
          quota_max_conversations_month: number
          quota_max_emails_month: number
          quota_max_http_calls_month: number
          slug: string
          updated_at: string
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "instances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_organisation_member: {
        Args: {
          p_department?: string | null
          p_display_name?: string | null
          p_instance_id: string
          p_job_title?: string | null
          p_notes?: string | null
          p_phone?: string | null
          p_role?: Database["public"]["Enums"]["instance_role"]
          p_user_id: string
        }
        Returns: {
          created_at: string
          department: string | null
          disabled_at: string | null
          display_name: string | null
          instance_id: string
          job_title: string | null
          notes: string | null
          phone: string | null
          role: Database["public"]["Enums"]["instance_role"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "instance_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_payment_intent_status: {
        Args: {
          p_payload: Json
          p_provider_payment_id: string
          p_reference: string
          p_status: string
        }
        Returns: Json
      }
      verify_scim_token: { Args: { p_token: string }; Returns: string }
      write_audit_event: {
        Args: {
          p_action: string
          p_instance_id: string
          p_meta?: Json | null
          p_resource_id?: string | null
          p_resource_type: string
        }
        Returns: string
      }
      write_audit_event_trusted: {
        Args: {
          p_action: string
          p_actor_id: string
          p_instance_id: string
          p_meta?: Json | null
          p_resource_id?: string | null
          p_resource_type: string
        }
        Returns: string
      }
    }
    Enums: {
      connection_kind: "http" | "email" | "payment"
      connection_visibility: "private" | "global" | "shared"
      entity_kind: "static" | "dynamic"
      flow_node_type:
        | "message"
        | "question"
        | "http"
        | "email"
        | "condition"
        | "set_variable"
        | "operation"
        | "end"
        | "loop"
        | "entity"
        | "integration"
        | "handoff"
        | "transfer"
      instance_role: "owner" | "admin" | "editor" | "viewer" | "agent"
      integration_provider:
        | "microsoft_onedrive"
        | "google_drive"
        | "dropbox"
        | "box"
        | "sharepoint"
        | "slack"
        | "microsoft_teams"
        | "google_sheets"
        | "notion"
        | "s3"
        | "custom"
      integration_status: "disconnected" | "connected" | "error"
      template_kind:
        | "email"
        | "faq"
        | "cart"
        | "menu"
        | "message"
        | "hours"
        | "legal"
        | "receipt"
        | "document"
      variable_scope: "global" | "step"
      variable_type:
        | "string"
        | "number"
        | "boolean"
        | "date"
        | "array"
        | "object"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicTables = Database['public']['Tables']

export type InstanceRole = Database['public']['Enums']['instance_role']
export type VariableType = Database['public']['Enums']['variable_type']
export type VariableScope = Database['public']['Enums']['variable_scope']
export type ConnectionKind = Database['public']['Enums']['connection_kind']
export type ConnectionVisibility = Database['public']['Enums']['connection_visibility']
export type IntegrationProvider = Database['public']['Enums']['integration_provider']
export type IntegrationStatus = Database['public']['Enums']['integration_status']
export type FlowNodeType = Database['public']['Enums']['flow_node_type']
export type EntityKind = Database['public']['Enums']['entity_kind']
export type TemplateKind = Database['public']['Enums']['template_kind']

export type Profile = PublicTables['profiles']['Row']
export type Instance = PublicTables['instances']['Row']
export type InstanceMember = PublicTables['instance_members']['Row']
export type InstanceInvite = PublicTables['instance_invites']['Row']
export type Chatbot = PublicTables['chatbots']['Row']
export type ChatbotVariable = PublicTables['chatbot_variables']['Row']
export type Connection = PublicTables['connections']['Row']
export type ConnectionSecret = PublicTables['connection_secrets']['Row']
export type ConnectionShare = PublicTables['connection_shares']['Row']
export type ChatbotConnection = PublicTables['chatbot_connections']['Row']
/** Connection metadata + optional secrets (managers only). */
export type ConnectionWithConfig = Connection & { config?: Json | null; canManage?: boolean }
export type Integration = PublicTables['integrations']['Row']
export type IntegrationSecret = PublicTables['integration_secrets']['Row']
export type InstanceAlertRule = PublicTables['instance_alert_rules']['Row']
export type InstanceAlertSettings = PublicTables['instance_alert_settings']['Row']
export type AlertDelivery = PublicTables['alert_deliveries']['Row']
export type ChatbotFlow = PublicTables['chatbot_flows']['Row']
export type FlowNode = PublicTables['flow_nodes']['Row']
export type FlowEdge = PublicTables['flow_edges']['Row']
export type ChatbotEntity = PublicTables['chatbot_entities']['Row']
export type ChatbotTemplate = PublicTables['chatbot_templates']['Row']
export type ChatbotTestScenario = PublicTables['chatbot_test_scenarios']['Row']
export type EntityAttribute = PublicTables['entity_attributes']['Row']
export type EntityStaticRecord = PublicTables['entity_static_records']['Row']
export type EntityDynamicRecord = PublicTables['entity_dynamic_records']['Row']
export type InstanceUsageMonthly = PublicTables['instance_usage_monthly']['Row']
export type FlowPublishVersion = PublicTables['flow_publish_versions']['Row']
export type AuditEvent = PublicTables['audit_events']['Row']
export type ConversationSession = PublicTables['conversation_sessions']['Row']
export type ConversationEvent = PublicTables['conversation_events']['Row']
export type InstanceWebhook = PublicTables['instance_webhooks']['Row']
export type WebhookDelivery = PublicTables['webhook_deliveries']['Row']
export type AgentQueue = PublicTables['agent_queues']['Row']
export type AgentPresence = PublicTables['agent_presence']['Row']
export type ConversationNote = PublicTables['conversation_notes']['Row']
export type ConversationTag = PublicTables['conversation_tags']['Row']
export type SavedConversationView = PublicTables['saved_conversation_views']['Row']
export type UserNotification = PublicTables['user_notifications']['Row']
export type FlowExperiment = PublicTables['flow_experiments']['Row']
export type FlowExperimentVariant = PublicTables['flow_experiment_variants']['Row']
export type ConsentPolicy = PublicTables['consent_policies']['Row']
export type DataRetentionPolicy = PublicTables['data_retention_policies']['Row']
export type InstanceSsoConfig = PublicTables['instance_sso_configs']['Row']
export type FlowComment = PublicTables['flow_comments']['Row']
export type FlowChangeLog = PublicTables['flow_change_log']['Row']
export type MarketplaceListing = PublicTables['marketplace_listings']['Row']

export const EDITOR_ROLES: InstanceRole[] = ['owner', 'admin', 'editor']
export const ADMIN_ROLES: InstanceRole[] = ['owner', 'admin']
export const AGENT_OPERATOR_ROLES: InstanceRole[] = ['owner', 'admin', 'editor', 'agent']
/** @deprecated use AGENT_OPERATOR_ROLES */
export const AGENT_OPERATE_ROLES = AGENT_OPERATOR_ROLES

export function canEdit(role: InstanceRole | null | undefined): boolean {
  return !!role && EDITOR_ROLES.includes(role)
}

export function canAdmin(role: InstanceRole | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role)
}

export function canAgentOperate(role: InstanceRole | null | undefined): boolean {
  return !!role && AGENT_OPERATOR_ROLES.includes(role)
}

export function isAgentRole(role: InstanceRole | null | undefined): boolean {
  return role === 'agent'
}

export type InstanceFeatures = {
  agent_console?: boolean
  experiments?: boolean
  analytics_v2?: boolean
  compliance?: boolean
  staging?: boolean
  sso?: boolean
  marketplace?: boolean
  collaborative_editing?: boolean
}

export type InstanceFeatureFlag = keyof InstanceFeatures

export function instanceFeatureEnabled(
  instance: { features?: Json | null } | null | undefined,
  feature: InstanceFeatureFlag | string,
): boolean {
  const raw = instance?.features
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const value = (raw as Record<string, unknown>)[feature]
  return value === true
}

export type ChatEnvironment = 'production' | 'staging'

export function parseChatEnvironment(value: unknown): ChatEnvironment {
  return value === 'staging' ? 'staging' : 'production'
}
