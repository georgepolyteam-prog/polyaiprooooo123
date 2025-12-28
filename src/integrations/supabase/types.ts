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
      chat_logs: {
        Row: {
          conversation_id: string | null
          created_at: string
          detail_mode: string | null
          id: string
          ip_address: string | null
          is_voice: boolean | null
          message_count: number | null
          user_agent: string | null
          user_message: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          detail_mode?: string | null
          id?: string
          ip_address?: string | null
          is_voice?: boolean | null
          message_count?: number | null
          user_agent?: string | null
          user_message: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          detail_mode?: string | null
          id?: string
          ip_address?: string | null
          is_voice?: boolean | null
          message_count?: number | null
          user_agent?: string | null
          user_message?: string
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
          tool_calls: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
          tool_calls?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
          tool_calls?: Json | null
        }
        Relationships: []
      }
      credit_deposits: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          status: string | null
          tx_signature: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          status?: string | null
          tx_signature: string
          user_id: string
          wallet_address: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          status?: string | null
          tx_signature?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      credit_usage: {
        Row: {
          created_at: string | null
          credits_used: number | null
          id: string
          message_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credits_used?: number | null
          id?: string
          message_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          credits_used?: number | null
          id?: string
          message_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      help_tickets: {
        Row: {
          created_at: string
          description: string
          email: string | null
          id: string
          page_url: string | null
          priority: string | null
          status: string | null
          subject: string
          type: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          description: string
          email?: string | null
          id?: string
          page_url?: string | null
          priority?: string | null
          status?: string | null
          subject: string
          type: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          page_url?: string | null
          priority?: string | null
          status?: string | null
          subject?: string
          type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      leaderboard_cache: {
        Row: {
          data: Json
          id: string
          min_volume: number
          timeframe: string
          updated_at: string
        }
        Insert: {
          data: Json
          id: string
          min_volume?: number
          timeframe: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          min_volume?: number
          timeframe?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_cache: {
        Row: {
          category: string | null
          confidence: string | null
          current_odds: number
          description: string | null
          edge: number | null
          end_date: string | null
          id: string
          image_url: string | null
          last_updated: string
          liquidity: number | null
          reasoning: string | null
          recommendation: string | null
          slug: string | null
          title: string
          vera_probability: number | null
          volume_24h: number | null
        }
        Insert: {
          category?: string | null
          confidence?: string | null
          current_odds: number
          description?: string | null
          edge?: number | null
          end_date?: string | null
          id: string
          image_url?: string | null
          last_updated?: string
          liquidity?: number | null
          reasoning?: string | null
          recommendation?: string | null
          slug?: string | null
          title: string
          vera_probability?: number | null
          volume_24h?: number | null
        }
        Update: {
          category?: string | null
          confidence?: string | null
          current_odds?: number
          description?: string | null
          edge?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          last_updated?: string
          liquidity?: number | null
          reasoning?: string | null
          recommendation?: string | null
          slug?: string | null
          title?: string
          vera_probability?: number | null
          volume_24h?: number | null
        }
        Relationships: []
      }
      polymarket_credentials: {
        Row: {
          api_key: string
          api_passphrase: string
          api_secret: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_address: string
        }
        Insert: {
          api_key: string
          api_passphrase: string
          api_secret: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_address: string
        }
        Update: {
          api_key?: string
          api_passphrase?: string
          api_secret?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_address?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string
          current_price: number | null
          entry_price: number
          id: string
          market_id: string
          market_title: string
          notes: string | null
          pnl: number | null
          side: string
          size: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_price?: number | null
          entry_price: number
          id?: string
          market_id: string
          market_title: string
          notes?: string | null
          pnl?: number | null
          side: string
          size: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_price?: number | null
          entry_price?: number
          id?: string
          market_id?: string
          market_title?: string
          notes?: string | null
          pnl?: number | null
          side?: string
          size?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      price_alerts: {
        Row: {
          created_at: string
          current_price: number | null
          direction: string
          id: string
          market_title: string
          market_url: string
          target_price: number
          telegram_chat_id: number
          telegram_username: string | null
          triggered: boolean
          triggered_at: string | null
        }
        Insert: {
          created_at?: string
          current_price?: number | null
          direction?: string
          id?: string
          market_title: string
          market_url: string
          target_price: number
          telegram_chat_id: number
          telegram_username?: string | null
          triggered?: boolean
          triggered_at?: string | null
        }
        Update: {
          created_at?: string
          current_price?: number | null
          direction?: string
          id?: string
          market_title?: string
          market_url?: string
          target_price?: number
          telegram_chat_id?: number
          telegram_username?: string | null
          triggered?: boolean
          triggered_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signup_logs: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          is_suspicious: boolean | null
          rejection_reason: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          is_suspicious?: boolean | null
          rejection_reason?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          is_suspicious?: boolean | null
          rejection_reason?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      system_stats: {
        Row: {
          id: string
          stats: Json
          updated_at: string
        }
        Insert: {
          id?: string
          stats?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          stats?: Json
          updated_at?: string
        }
        Relationships: []
      }
      telegram_followed_markets: {
        Row: {
          created_at: string
          id: string
          last_checked: string | null
          last_price: number | null
          market_title: string
          market_url: string
          telegram_chat_id: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_checked?: string | null
          last_price?: number | null
          market_title: string
          market_url: string
          telegram_chat_id: number
        }
        Update: {
          created_at?: string
          id?: string
          last_checked?: string | null
          last_price?: number | null
          market_title?: string
          market_url?: string
          telegram_chat_id?: number
        }
        Relationships: []
      }
      tracked_wallets: {
        Row: {
          created_at: string | null
          id: string
          nickname: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nickname?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nickname?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      twitter_bot_status: {
        Row: {
          id: number
          last_mention_id: string | null
          updated_at: string | null
        }
        Insert: {
          id: number
          last_mention_id?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          last_mention_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          created_at: string | null
          credits_balance: number | null
          id: string
          total_deposited: number | null
          total_spent: number | null
          updated_at: string | null
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string | null
          credits_balance?: number | null
          id?: string
          total_deposited?: number | null
          total_spent?: number | null
          updated_at?: string | null
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string | null
          credits_balance?: number | null
          id?: string
          total_deposited?: number | null
          total_spent?: number | null
          updated_at?: string | null
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: []
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
      voice_feedback: {
        Row: {
          bug_description: string | null
          conversation_id: string
          created_at: string
          feedback_type: string
          id: string
          message_content: string
          message_id: string
          user_agent: string | null
        }
        Insert: {
          bug_description?: string | null
          conversation_id: string
          created_at?: string
          feedback_type: string
          id?: string
          message_content: string
          message_id: string
          user_agent?: string | null
        }
        Update: {
          bug_description?: string | null
          conversation_id?: string
          created_at?: string
          feedback_type?: string
          id?: string
          message_content?: string
          message_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      whale_trades: {
        Row: {
          amount: number
          created_at: string
          id: string
          market_question: string
          market_url: string | null
          platform: string
          price: number
          side: string
          size: number
          timestamp: string
          trade_hash: string | null
          wallet: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          market_question: string
          market_url?: string | null
          platform: string
          price: number
          side: string
          size: number
          timestamp?: string
          trade_hash?: string | null
          wallet?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          market_question?: string
          market_url?: string | null
          platform?: string
          price?: number
          side?: string
          size?: number
          timestamp?: string
          trade_hash?: string | null
          wallet?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
