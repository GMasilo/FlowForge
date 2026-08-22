export type InstanceRole = 'owner' | 'admin' | 'editor' | 'viewer'
export type VariableType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object'
export type VariableScope = 'global' | 'step'
export type ConnectionKind = 'http' | 'email' | 'payment'
export type ConnectionVisibility = 'private' | 'global' | 'shared'
export type FlowNodeType =
  | 'message'
  | 'question'
  | 'http'
  | 'email'
  | 'condition'
  | 'loop'
  | 'set_variable'
  | 'operation'
  | 'entity'
  | 'end'

export type EntityKind = 'static' | 'dynamic'
export type TemplateKind =
  | 'email'
  | 'faq'
  | 'cart'
  | 'menu'
  | 'message'
  | 'hours'
  | 'legal'
  | 'receipt'
  | 'document'

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

type Tables = {
  profiles: {
    Row: {
      id: string
      email: string | null
      display_name: string | null
      is_superuser: boolean
      created_at: string
    }
    Insert: {
      id: string
      email?: string | null
      display_name?: string | null
      is_superuser?: boolean
      created_at?: string
    }
    Update: {
      id?: string
      email?: string | null
      display_name?: string | null
      is_superuser?: boolean
      created_at?: string
    }
    Relationships: []
  }
  instances: {
    Row: {
      id: string
      name: string
      slug: string
      legal_name: string | null
      contact_email: string | null
      phone: string | null
      website: string | null
      billing_address: string | null
      notes: string | null
      http_host_allowlist: string[]
      quota_max_conversations_month: number
      quota_max_emails_month: number
      quota_max_http_calls_month: number
      created_by: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      name: string
      slug: string
      legal_name?: string | null
      contact_email?: string | null
      phone?: string | null
      website?: string | null
      billing_address?: string | null
      notes?: string | null
      http_host_allowlist?: string[]
      quota_max_conversations_month?: number
      quota_max_emails_month?: number
      quota_max_http_calls_month?: number
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      name?: string
      slug?: string
      legal_name?: string | null
      contact_email?: string | null
      phone?: string | null
      website?: string | null
      billing_address?: string | null
      notes?: string | null
      http_host_allowlist?: string[]
      quota_max_conversations_month?: number
      quota_max_emails_month?: number
      quota_max_http_calls_month?: number
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: []
  }
  instance_members: {
    Row: {
      instance_id: string
      user_id: string
      role: InstanceRole
      display_name: string | null
      job_title: string | null
      phone: string | null
      department: string | null
      notes: string | null
      created_at: string
    }
    Insert: {
      instance_id: string
      user_id: string
      role?: InstanceRole
      display_name?: string | null
      job_title?: string | null
      phone?: string | null
      department?: string | null
      notes?: string | null
      created_at?: string
    }
    Update: {
      instance_id?: string
      user_id?: string
      role?: InstanceRole
      display_name?: string | null
      job_title?: string | null
      phone?: string | null
      department?: string | null
      notes?: string | null
      created_at?: string
    }
    Relationships: [
      {
        foreignKeyName: 'instance_members_user_id_fkey'
        columns: ['user_id']
        isOneToOne: false
        referencedRelation: 'profiles'
        referencedColumns: ['id']
      },
    ]
  }
  instance_invites: {
    Row: {
      id: string
      instance_id: string
      email: string
      role: InstanceRole
      display_name: string | null
      job_title: string | null
      phone: string | null
      department: string | null
      notes: string | null
      invited_by: string | null
      token: string
      email_sent_at: string | null
      email_last_error: string | null
      created_at: string
    }
    Insert: {
      id?: string
      instance_id: string
      email: string
      role?: InstanceRole
      display_name?: string | null
      job_title?: string | null
      phone?: string | null
      department?: string | null
      notes?: string | null
      invited_by?: string | null
      token?: string
      email_sent_at?: string | null
      email_last_error?: string | null
      created_at?: string
    }
    Update: {
      id?: string
      instance_id?: string
      email?: string
      role?: InstanceRole
      display_name?: string | null
      job_title?: string | null
      phone?: string | null
      department?: string | null
      notes?: string | null
      invited_by?: string | null
      token?: string
      email_sent_at?: string | null
      email_last_error?: string | null
      created_at?: string
    }
    Relationships: []
  }
  chatbots: {
    Row: {
      id: string
      instance_id: string
      name: string
      description: string | null
      settings: Json
      deleted_at: string | null
      public_enabled: boolean
      public_slug: string | null
      created_by: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      instance_id: string
      name: string
      description?: string | null
      settings?: Json
      deleted_at?: string | null
      public_enabled?: boolean
      public_slug?: string | null
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      instance_id?: string
      name?: string
      description?: string | null
      settings?: Json
      deleted_at?: string | null
      public_enabled?: boolean
      public_slug?: string | null
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: []
  }
  chatbot_variables: {
    Row: {
      id: string
      chatbot_id: string
      key: string
      value_type: VariableType
      default_value: Json | null
      scope: VariableScope
      source_node_key: string | null
      description: string | null
      created_at: string
    }
    Insert: {
      id?: string
      chatbot_id: string
      key: string
      value_type?: VariableType
      default_value?: Json | null
      scope?: VariableScope
      source_node_key?: string | null
      description?: string | null
      created_at?: string
    }
    Update: {
      id?: string
      chatbot_id?: string
      key?: string
      value_type?: VariableType
      default_value?: Json | null
      scope?: VariableScope
      source_node_key?: string | null
      description?: string | null
      created_at?: string
    }
    Relationships: []
  }
  connections: {
    Row: {
      id: string
      instance_id: string
      chatbot_id: string
      name: string
      kind: ConnectionKind
      visibility: ConnectionVisibility
      created_by: string | null
      created_at: string
      updated_at: string
      deleted_at: string | null
    }
    Insert: {
      id?: string
      instance_id: string
      chatbot_id: string
      name: string
      kind: ConnectionKind
      visibility?: ConnectionVisibility
      created_by?: string | null
      created_at?: string
      updated_at?: string
      deleted_at?: string | null
    }
    Update: {
      id?: string
      instance_id?: string
      chatbot_id?: string
      name?: string
      kind?: ConnectionKind
      visibility?: ConnectionVisibility
      created_by?: string | null
      created_at?: string
      updated_at?: string
      deleted_at?: string | null
    }
    Relationships: []
  }
  connection_secrets: {
    Row: {
      connection_id: string
      config: Json
      updated_at: string
    }
    Insert: {
      connection_id: string
      config?: Json
      updated_at?: string
    }
    Update: {
      connection_id?: string
      config?: Json
      updated_at?: string
    }
    Relationships: []
  }
  connection_shares: {
    Row: {
      id: string
      connection_id: string
      user_id: string
      created_at: string
    }
    Insert: {
      id?: string
      connection_id: string
      user_id: string
      created_at?: string
    }
    Update: {
      id?: string
      connection_id?: string
      user_id?: string
      created_at?: string
    }
    Relationships: []
  }
  chatbot_connections: {
    Row: {
      id: string
      chatbot_id: string
      connection_id: string
      added_by: string | null
      created_at: string
    }
    Insert: {
      id?: string
      chatbot_id: string
      connection_id: string
      added_by?: string | null
      created_at?: string
    }
    Update: {
      id?: string
      chatbot_id?: string
      connection_id?: string
      added_by?: string | null
      created_at?: string
    }
    Relationships: []
  }
  chatbot_flows: {
    Row: {
      id: string
      chatbot_id: string
      name: string
      version: number
      published_graph: Json | null
      published_at: string | null
      has_draft_changes: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      chatbot_id: string
      name?: string
      version?: number
      published_graph?: Json | null
      published_at?: string | null
      has_draft_changes?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      chatbot_id?: string
      name?: string
      version?: number
      published_graph?: Json | null
      published_at?: string | null
      has_draft_changes?: boolean
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: 'chatbot_flows_chatbot_id_fkey',
        columns: ['chatbot_id'],
        isOneToOne: true,
        referencedRelation: 'chatbots',
        referencedColumns: ['id'],
      },
    ]
  }
  flow_nodes: {
    Row: {
      id: string
      flow_id: string
      key: string
      type: FlowNodeType
      label: string | null
      config: Json
      position_x: number
      position_y: number
      created_at: string
    }
    Insert: {
      id?: string
      flow_id: string
      key: string
      type: FlowNodeType
      label?: string | null
      config?: Json
      position_x?: number
      position_y?: number
      created_at?: string
    }
    Update: {
      id?: string
      flow_id?: string
      key?: string
      type?: FlowNodeType
      label?: string | null
      config?: Json
      position_x?: number
      position_y?: number
      created_at?: string
    }
    Relationships: []
  }
  flow_edges: {
    Row: {
      id: string
      flow_id: string
      source_node_id: string
      target_node_id: string
      source_handle: string | null
      label: string | null
      created_at: string
    }
    Insert: {
      id?: string
      flow_id: string
      source_node_id: string
      target_node_id: string
      source_handle?: string | null
      label?: string | null
      created_at?: string
    }
    Update: {
      id?: string
      flow_id?: string
      source_node_id?: string
      target_node_id?: string
      source_handle?: string | null
      label?: string | null
      created_at?: string
    }
    Relationships: []
  }
  chatbot_entities: {
    Row: {
      id: string
      chatbot_id: string
      key: string
      name: string
      description: string | null
      kind: EntityKind
      deleted_at: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      chatbot_id: string
      key: string
      name: string
      description?: string | null
      kind?: EntityKind
      deleted_at?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      chatbot_id?: string
      key?: string
      name?: string
      description?: string | null
      kind?: EntityKind
      deleted_at?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: []
  }
  chatbot_templates: {
    Row: {
      id: string
      chatbot_id: string
      key: string
      name: string
      description: string | null
      kind: TemplateKind
      content: Json
      deleted_at: string | null
      created_by: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      chatbot_id: string
      key: string
      name: string
      description?: string | null
      kind: TemplateKind
      content?: Json
      deleted_at?: string | null
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      chatbot_id?: string
      key?: string
      name?: string
      description?: string | null
      kind?: TemplateKind
      content?: Json
      deleted_at?: string | null
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: []
  }
  chatbot_test_scenarios: {
    Row: {
      id: string
      chatbot_id: string
      name: string
      globals: Json
      expected: Json
      created_by: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      chatbot_id: string
      name: string
      globals?: Json
      expected?: Json
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      chatbot_id?: string
      name?: string
      globals?: Json
      expected?: Json
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: []
  }
  entity_attributes: {
    Row: {
      id: string
      entity_id: string
      key: string
      label: string | null
      value_type: VariableType
      required: boolean
      is_identifier: boolean
      is_unique: boolean
      default_value: Json | null
      sort_order: number
    }
    Insert: {
      id?: string
      entity_id: string
      key: string
      label?: string | null
      value_type?: VariableType
      required?: boolean
      is_identifier?: boolean
      is_unique?: boolean
      default_value?: Json | null
      sort_order?: number
    }
    Update: {
      id?: string
      entity_id?: string
      key?: string
      label?: string | null
      value_type?: VariableType
      required?: boolean
      is_identifier?: boolean
      is_unique?: boolean
      default_value?: Json | null
      sort_order?: number
    }
    Relationships: []
  }
  entity_static_records: {
    Row: {
      id: string
      entity_id: string
      sort_order: number
      values: Json
      created_at: string
    }
    Insert: {
      id?: string
      entity_id: string
      sort_order?: number
      values?: Json
      created_at?: string
    }
    Update: {
      id?: string
      entity_id?: string
      sort_order?: number
      values?: Json
      created_at?: string
    }
    Relationships: []
  }
  entity_dynamic_records: {
    Row: {
      id: string
      entity_id: string
      values: Json
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      entity_id: string
      values?: Json
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      entity_id?: string
      values?: Json
      created_at?: string
      updated_at?: string
    }
    Relationships: []
  }
  instance_usage_monthly: {
    Row: {
      instance_id: string
      year_month: string
      conversations: number
      emails: number
      http_calls: number
      updated_at: string
    }
    Insert: {
      instance_id: string
      year_month: string
      conversations?: number
      emails?: number
      http_calls?: number
      updated_at?: string
    }
    Update: {
      instance_id?: string
      year_month?: string
      conversations?: number
      emails?: number
      http_calls?: number
      updated_at?: string
    }
    Relationships: []
  }
  flow_publish_versions: {
    Row: {
      id: string
      flow_id: string
      chatbot_id: string
      instance_id: string
      version: number
      published_graph: Json
      published_at: string
      published_by: string | null
      note: string | null
    }
    Insert: {
      id?: string
      flow_id: string
      chatbot_id: string
      instance_id: string
      version: number
      published_graph: Json
      published_at?: string
      published_by?: string | null
      note?: string | null
    }
    Update: {
      id?: string
      flow_id?: string
      chatbot_id?: string
      instance_id?: string
      version?: number
      published_graph?: Json
      published_at?: string
      published_by?: string | null
      note?: string | null
    }
    Relationships: []
  }
  audit_events: {
    Row: {
      id: string
      instance_id: string | null
      actor_id: string | null
      action: string
      resource_type: string
      resource_id: string | null
      meta: Json
      created_at: string
    }
    Insert: {
      id?: string
      instance_id?: string | null
      actor_id?: string | null
      action: string
      resource_type: string
      resource_id?: string | null
      meta?: Json
      created_at?: string
    }
    Update: {
      id?: string
      instance_id?: string | null
      actor_id?: string | null
      action?: string
      resource_type?: string
      resource_id?: string | null
      meta?: Json
      created_at?: string
    }
    Relationships: []
  }
  conversation_sessions: {
    Row: {
      id: string
      chatbot_id: string
      instance_id: string
      status: 'active' | 'completed' | 'failed' | 'abandoned'
      visitor_key: string | null
      publish_version: number | null
      variables: Json
      error_summary: string | null
      created_at: string
      updated_at: string
      completed_at: string | null
    }
    Insert: {
      id?: string
      chatbot_id: string
      instance_id: string
      status?: 'active' | 'completed' | 'failed' | 'abandoned'
      visitor_key?: string | null
      publish_version?: number | null
      variables?: Json
      error_summary?: string | null
      created_at?: string
      updated_at?: string
      completed_at?: string | null
    }
    Update: {
      id?: string
      chatbot_id?: string
      instance_id?: string
      status?: 'active' | 'completed' | 'failed' | 'abandoned'
      visitor_key?: string | null
      publish_version?: number | null
      variables?: Json
      error_summary?: string | null
      created_at?: string
      updated_at?: string
      completed_at?: string | null
    }
    Relationships: [
      {
        foreignKeyName: 'conversation_sessions_chatbot_id_fkey'
        columns: ['chatbot_id']
        isOneToOne: false
        referencedRelation: 'chatbots'
        referencedColumns: ['id']
      },
    ]
  }
  conversation_events: {
    Row: {
      id: string
      session_id: string
      seq: number
      kind: string
      node_key: string | null
      payload: Json
      created_at: string
    }
    Insert: {
      id?: string
      session_id: string
      seq: number
      kind: string
      node_key?: string | null
      payload?: Json
      created_at?: string
    }
    Update: {
      id?: string
      session_id?: string
      seq?: number
      kind?: string
      node_key?: string | null
      payload?: Json
      created_at?: string
    }
    Relationships: []
  }
  instance_webhooks: {
    Row: {
      id: string
      instance_id: string
      name: string
      url: string
      secret: string
      events: string[]
      enabled: boolean
      created_by: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      instance_id: string
      name: string
      url: string
      secret?: string
      events?: string[]
      enabled?: boolean
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      instance_id?: string
      name?: string
      url?: string
      secret?: string
      events?: string[]
      enabled?: boolean
      created_by?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: []
  }
  webhook_deliveries: {
    Row: {
      id: string
      webhook_id: string
      event: string
      payload: Json
      status_code: number | null
      ok: boolean | null
      error: string | null
      created_at: string
    }
    Insert: {
      id?: string
      webhook_id: string
      event: string
      payload: Json
      status_code?: number | null
      ok?: boolean | null
      error?: string | null
      created_at?: string
    }
    Update: {
      id?: string
      webhook_id?: string
      event?: string
      payload?: Json
      status_code?: number | null
      ok?: boolean | null
      error?: string | null
      created_at?: string
    }
    Relationships: []
  }
}

export interface Database {
  public: {
    Tables: Tables
    Views: Record<string, never>
    Functions: {
      is_instance_member: {
        Args: { p_instance_id: string }
        Returns: boolean
      }
      has_instance_role: {
        Args: { p_instance_id: string; p_roles: InstanceRole[] }
        Returns: boolean
      }
      lookup_profile_id_by_email: {
        Args: { p_email: string }
        Returns: string
      }
      is_superuser: {
        Args: Record<string, never>
        Returns: boolean
      }
      create_organisation: {
        Args: {
          p_name: string
          p_slug: string
          p_legal_name?: string | null
          p_contact_email?: string | null
          p_phone?: string | null
          p_website?: string | null
          p_billing_address?: string | null
          p_notes?: string | null
        }
        Returns: Tables['instances']['Row']
      }
      update_organisation: {
        Args: {
          p_id: string
          p_name: string
          p_slug: string
          p_legal_name?: string | null
          p_contact_email?: string | null
          p_phone?: string | null
          p_website?: string | null
          p_billing_address?: string | null
          p_notes?: string | null
        }
        Returns: Tables['instances']['Row']
      }
      create_instance: {
        Args: { p_name: string; p_slug: string }
        Returns: Tables['instances']['Row']
      }
      add_organisation_member: {
        Args: {
          p_instance_id: string
          p_email: string
          p_role?: InstanceRole
          p_display_name?: string | null
          p_job_title?: string | null
          p_phone?: string | null
          p_department?: string | null
          p_notes?: string | null
        }
        Returns: Json
      }
      update_organisation_member: {
        Args: {
          p_instance_id: string
          p_user_id: string
          p_role?: InstanceRole | null
          p_display_name?: string | null
          p_job_title?: string | null
          p_phone?: string | null
          p_department?: string | null
          p_notes?: string | null
        }
        Returns: Tables['instance_members']['Row']
      }
      remove_organisation_member: {
        Args: { p_instance_id: string; p_user_id: string }
        Returns: undefined
      }
      get_invite_for_sending: {
        Args: { p_invite_id: string }
        Returns: Json
      }
      lookup_organisation_invite: {
        Args: { p_token: string }
        Returns: Json
      }
      claim_my_organisation_invites: {
        Args: Record<string, never>
        Returns: number
      }
      can_manage_connection: {
        Args: { p_connection_id: string }
        Returns: boolean
      }
      can_see_connection_meta: {
        Args: { p_connection_id: string }
        Returns: boolean
      }
      connection_config_for_use: {
        Args: { p_connection_id: string; p_chatbot_id: string }
        Returns: Json
      }
      write_audit_event: {
        Args: {
          p_instance_id: string
          p_action: string
          p_resource_type: string
          p_resource_id?: string | null
          p_meta?: Json
        }
        Returns: string // uuid
      }
      mark_invite_email_status: {
        Args: {
          p_invite_id: string
          p_ok: boolean
          p_error?: string | null
        }
        Returns: undefined
      }
      increment_instance_usage: {
        Args: {
          p_instance_id: string
          p_conversations?: number
          p_emails?: number
          p_http_calls?: number
        }
        Returns: Tables['instance_usage_monthly']['Row']
      }
      check_instance_quota: {
        Args: { p_instance_id: string; p_kind: string }
        Returns: boolean
      }
      get_public_chatbot: {
        Args: { p_slug: string }
        Returns: Json
      }
      start_public_conversation: {
        Args: { p_slug: string; p_visitor_key?: string | null }
        Returns: Json
      }
      append_conversation_event: {
        Args: {
          p_session_id: string
          p_kind: string
          p_node_key?: string | null
          p_payload?: Json
        }
        Returns: Tables['conversation_events']['Row']
      }
      complete_conversation_session: {
        Args: {
          p_session_id: string
          p_status?: string
          p_error_summary?: string | null
          p_variables?: Json | null
        }
        Returns: Tables['conversation_sessions']['Row']
      }
      publish_flow_version: {
        Args: {
          p_flow_id: string
          p_published_graph: Json
          p_note?: string | null
        }
        Returns: Tables['flow_publish_versions']['Row']
      }
      rollback_flow_version: {
        Args: { p_flow_id: string; p_version: number }
        Returns: Tables['chatbot_flows']['Row']
      }
      soft_delete_chatbot: {
        Args: { p_chatbot_id: string }
        Returns: undefined
      }
      restore_chatbot: {
        Args: { p_chatbot_id: string }
        Returns: undefined
      }
      soft_delete_connection: {
        Args: { p_connection_id: string }
        Returns: undefined
      }
      restore_connection: {
        Args: { p_connection_id: string }
        Returns: undefined
      }
      soft_delete_entity: {
        Args: { p_entity_id: string }
        Returns: undefined
      }
      restore_entity: {
        Args: { p_entity_id: string }
        Returns: undefined
      }
      get_conversation_session_for_webhook: {
        Args: { p_session_id: string }
        Returns: Json
      }
      record_webhook_delivery: {
        Args: {
          p_webhook_id: string
          p_event: string
          p_payload?: Json
          p_status_code?: number | null
          p_ok?: boolean | null
          p_error?: string | null
        }
        Returns: string
      }
      instance_http_allowlist: {
        Args: { p_instance_id: string }
        Returns: string[]
      }
    }
    Enums: {
      instance_role: InstanceRole
      variable_type: VariableType
      variable_scope: VariableScope
      connection_kind: ConnectionKind
      connection_visibility: ConnectionVisibility
      flow_node_type: FlowNodeType
      entity_kind: EntityKind
      template_kind: TemplateKind
    }
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Tables['profiles']['Row']
export type Instance = Tables['instances']['Row']
export type InstanceMember = Tables['instance_members']['Row']
export type InstanceInvite = Tables['instance_invites']['Row']
export type Chatbot = Tables['chatbots']['Row']
export type ChatbotVariable = Tables['chatbot_variables']['Row']
export type Connection = Tables['connections']['Row']
export type ConnectionSecret = Tables['connection_secrets']['Row']
export type ConnectionShare = Tables['connection_shares']['Row']
export type ChatbotConnection = Tables['chatbot_connections']['Row']
/** Connection metadata + optional secrets (managers only). */
export type ConnectionWithConfig = Connection & { config?: Json | null; canManage?: boolean }
export type ChatbotFlow = Tables['chatbot_flows']['Row']
export type FlowNode = Tables['flow_nodes']['Row']
export type FlowEdge = Tables['flow_edges']['Row']
export type ChatbotEntity = Tables['chatbot_entities']['Row']
export type ChatbotTemplate = Tables['chatbot_templates']['Row']
export type ChatbotTestScenario = Tables['chatbot_test_scenarios']['Row']
export type EntityAttribute = Tables['entity_attributes']['Row']
export type EntityStaticRecord = Tables['entity_static_records']['Row']
export type EntityDynamicRecord = Tables['entity_dynamic_records']['Row']
export type InstanceUsageMonthly = Tables['instance_usage_monthly']['Row']
export type FlowPublishVersion = Tables['flow_publish_versions']['Row']
export type AuditEvent = Tables['audit_events']['Row']
export type ConversationSession = Tables['conversation_sessions']['Row']
export type ConversationEvent = Tables['conversation_events']['Row']
export type InstanceWebhook = Tables['instance_webhooks']['Row']
export type WebhookDelivery = Tables['webhook_deliveries']['Row']

export const EDITOR_ROLES: InstanceRole[] = ['owner', 'admin', 'editor']
export const ADMIN_ROLES: InstanceRole[] = ['owner', 'admin']

export function canEdit(role: InstanceRole | null | undefined): boolean {
  return !!role && EDITOR_ROLES.includes(role)
}

export function canAdmin(role: InstanceRole | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role)
}
