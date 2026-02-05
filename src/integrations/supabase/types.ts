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
      admin_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          message: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_credentials: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          client_user_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          last_used_at: string | null
          updated_at: string
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          client_user_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          last_used_at?: string | null
          updated_at?: string
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          client_user_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          last_used_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      api_logs: {
        Row: {
          action: string
          created_at: string | null
          credential_id: string | null
          id: string
          platform: string
          request_payload: Json | null
          response_message: string | null
          response_status: number | null
          success: boolean | null
        }
        Insert: {
          action: string
          created_at?: string | null
          credential_id?: string | null
          id?: string
          platform: string
          request_payload?: Json | null
          response_message?: string | null
          response_status?: number | null
          success?: boolean | null
        }
        Update: {
          action?: string
          created_at?: string | null
          credential_id?: string | null
          id?: string
          platform?: string
          request_payload?: Json | null
          response_message?: string | null
          response_status?: number | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "api_logs_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "api_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      api_queue: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number
          payload: Json
          priority: number
          processed_at: string | null
          source: string
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          payload: Json
          priority?: number
          processed_at?: string | null
          source?: string
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          payload?: Json
          priority?: number
          processed_at?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          client_user_id: string
          created_at: string
          fulfillment_value: number | null
          id: string
          image_url: string | null
          low_stock_threshold: number
          price: number | null
          product_name: string
          sku: string
          stock_available: number
          updated_at: string
        }
        Insert: {
          client_user_id: string
          created_at?: string
          fulfillment_value?: number | null
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          price?: number | null
          product_name: string
          sku: string
          stock_available?: number
          updated_at?: string
        }
        Update: {
          client_user_id?: string
          created_at?: string
          fulfillment_value?: number | null
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          price?: number | null
          product_name?: string
          sku?: string
          stock_available?: number
          updated_at?: string
        }
        Relationships: []
      }
      location_history: {
        Row: {
          accuracy: number | null
          created_at: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          motorizado_id: string
          recorded_at: string
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          motorizado_id: string
          recorded_at?: string
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          motorizado_id?: string
          recorded_at?: string
          speed?: number | null
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          created_at: string
          destinatario: string
          estado: string | null
          id: string
          mensaje: string
          pedido_id: number
          tipo: string
        }
        Insert: {
          created_at?: string
          destinatario: string
          estado?: string | null
          id?: string
          mensaje: string
          pedido_id: number
          tipo: string
        }
        Update: {
          created_at?: string
          destinatario?: string
          estado?: string | null
          id?: string
          mensaje?: string
          pedido_id?: number
          tipo?: string
        }
        Relationships: []
      }
      pedido_status_logs: {
        Row: {
          created_at: string
          estado_anterior: string | null
          estado_nuevo: string
          id: string
          motivo: string | null
          pedido_id: number
          usuario_id: string | null
          usuario_nombre: string | null
        }
        Insert: {
          created_at?: string
          estado_anterior?: string | null
          estado_nuevo: string
          id?: string
          motivo?: string | null
          pedido_id: number
          usuario_id?: string | null
          usuario_nombre?: string | null
        }
        Update: {
          created_at?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          id?: string
          motivo?: string | null
          pedido_id?: number
          usuario_id?: string | null
          usuario_nombre?: string | null
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          barrio: string | null
          client_phone: string | null
          client_user_id: string | null
          cliente_nombre: string | null
          corte_horario: string | null
          costo_devolucion: number | null
          devolucion_cobrada: boolean | null
          dias_en_transito: number | null
          direccion_entrega: string | null
          dropi_guia_id: string | null
          dropi_sync_status: string | null
          estado: string | null
          fecha_actualizacion: string | null
          fecha_cierre_logistico: string | null
          fecha_creacion: string | null
          fecha_entrega: string | null
          fecha_recoleccion_real: string | null
          firma_cliente: string | null
          foto_evidencia: string | null
          foto_paquete: string | null
          fulfillment_cost: number | null
          guia_impresa: boolean | null
          guia_impresa_at: string | null
          id: number
          indicador_trayecto: string | null
          intentos_entrega: number | null
          inventory_item_id: string | null
          latitud: number | null
          longitud: number | null
          metodo_pago: string | null
          motorizado_asignado: string | null
          motorizado_id: string | null
          municipio: string | null
          novedad_latitud: number | null
          novedad_longitud: number | null
          novedad_resuelta: boolean | null
          novedad_tipo_clasificacion: string | null
          numero_guia: string | null
          observaciones: string | null
          primer_intento_fecha: string | null
          producto_nombre: string | null
          quantity: number | null
          sla_cumplido: boolean | null
          tipo_novedad: string | null
          utilidad: number | null
          valor_flete: number | null
          valor_producto: number | null
          valor_recaudar: number | null
          zona: string | null
        }
        Insert: {
          barrio?: string | null
          client_phone?: string | null
          client_user_id?: string | null
          cliente_nombre?: string | null
          corte_horario?: string | null
          costo_devolucion?: number | null
          devolucion_cobrada?: boolean | null
          dias_en_transito?: number | null
          direccion_entrega?: string | null
          dropi_guia_id?: string | null
          dropi_sync_status?: string | null
          estado?: string | null
          fecha_actualizacion?: string | null
          fecha_cierre_logistico?: string | null
          fecha_creacion?: string | null
          fecha_entrega?: string | null
          fecha_recoleccion_real?: string | null
          firma_cliente?: string | null
          foto_evidencia?: string | null
          foto_paquete?: string | null
          fulfillment_cost?: number | null
          guia_impresa?: boolean | null
          guia_impresa_at?: string | null
          id?: number
          indicador_trayecto?: string | null
          intentos_entrega?: number | null
          inventory_item_id?: string | null
          latitud?: number | null
          longitud?: number | null
          metodo_pago?: string | null
          motorizado_asignado?: string | null
          motorizado_id?: string | null
          municipio?: string | null
          novedad_latitud?: number | null
          novedad_longitud?: number | null
          novedad_resuelta?: boolean | null
          novedad_tipo_clasificacion?: string | null
          numero_guia?: string | null
          observaciones?: string | null
          primer_intento_fecha?: string | null
          producto_nombre?: string | null
          quantity?: number | null
          sla_cumplido?: boolean | null
          tipo_novedad?: string | null
          utilidad?: number | null
          valor_flete?: number | null
          valor_producto?: number | null
          valor_recaudar?: number | null
          zona?: string | null
        }
        Update: {
          barrio?: string | null
          client_phone?: string | null
          client_user_id?: string | null
          cliente_nombre?: string | null
          corte_horario?: string | null
          costo_devolucion?: number | null
          devolucion_cobrada?: boolean | null
          dias_en_transito?: number | null
          direccion_entrega?: string | null
          dropi_guia_id?: string | null
          dropi_sync_status?: string | null
          estado?: string | null
          fecha_actualizacion?: string | null
          fecha_cierre_logistico?: string | null
          fecha_creacion?: string | null
          fecha_entrega?: string | null
          fecha_recoleccion_real?: string | null
          firma_cliente?: string | null
          foto_evidencia?: string | null
          foto_paquete?: string | null
          fulfillment_cost?: number | null
          guia_impresa?: boolean | null
          guia_impresa_at?: string | null
          id?: number
          indicador_trayecto?: string | null
          intentos_entrega?: number | null
          inventory_item_id?: string | null
          latitud?: number | null
          longitud?: number | null
          metodo_pago?: string | null
          motorizado_asignado?: string | null
          motorizado_id?: string | null
          municipio?: string | null
          novedad_latitud?: number | null
          novedad_longitud?: number | null
          novedad_resuelta?: boolean | null
          novedad_tipo_clasificacion?: string | null
          numero_guia?: string | null
          observaciones?: string | null
          primer_intento_fecha?: string | null
          producto_nombre?: string | null
          quantity?: number | null
          sla_cumplido?: boolean | null
          tipo_novedad?: string | null
          utilidad?: number | null
          valor_flete?: number | null
          valor_producto?: number | null
          valor_recaudar?: number | null
          zona?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          fulfillment_rate: number | null
          full_name: string
          id: string
          is_online: boolean | null
          last_location_lat: number | null
          last_location_lng: number | null
          last_location_updated_at: string | null
          logo_url: string | null
          nit_rut: string | null
          phone: string | null
          status: string
          store_name: string | null
          updated_at: string
          user_id: string
          vehicle_plate: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          fulfillment_rate?: number | null
          full_name: string
          id?: string
          is_online?: boolean | null
          last_location_lat?: number | null
          last_location_lng?: number | null
          last_location_updated_at?: string | null
          logo_url?: string | null
          nit_rut?: string | null
          phone?: string | null
          status?: string
          store_name?: string | null
          updated_at?: string
          user_id: string
          vehicle_plate?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          fulfillment_rate?: number | null
          full_name?: string
          id?: string
          is_online?: boolean | null
          last_location_lat?: number | null
          last_location_lng?: number | null
          last_location_updated_at?: string | null
          logo_url?: string | null
          nit_rut?: string | null
          phone?: string | null
          status?: string
          store_name?: string | null
          updated_at?: string
          user_id?: string
          vehicle_plate?: string | null
        }
        Relationships: []
      }
      state_mappings: {
        Row: {
          created_at: string | null
          external_code: string | null
          external_state: string
          id: string
          internal_state: string
          is_active: boolean | null
          platform: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          external_code?: string | null
          external_state: string
          id?: string
          internal_state: string
          is_active?: boolean | null
          platform: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          external_code?: string | null
          external_state?: string
          id?: string
          internal_state?: string
          is_active?: boolean | null
          platform?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      dropi_indicators: {
        Row: {
          entregas_en_sla: number | null
          guias_con_novedad: number | null
          guias_con_recaudo: number | null
          guias_devueltas: number | null
          guias_entregadas: number | null
          guias_movilizadas: number | null
          novedades_automaticas: number | null
          novedades_manuales: number | null
          porcentaje_entregas: number | null
          porcentaje_sla_cumplido: number | null
          primer_intento_exitoso: number | null
          promedio_dias_transito: number | null
          total_guias: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "motorizado" | "cliente" | "despachador"
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
      app_role: ["admin", "motorizado", "cliente", "despachador"],
    },
  },
} as const
