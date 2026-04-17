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
      admin_wallet_ledger: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          organizacion_id: string | null
          pedido_id: number | null
          transaction_type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          organizacion_id?: string | null
          pedido_id?: number | null
          transaction_type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          organizacion_id?: string | null
          pedido_id?: number | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_wallet_ledger_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
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
          organizacion_id: string | null
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
          organizacion_id?: string | null
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
          organizacion_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_credentials_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
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
      api_rate_limits: {
        Row: {
          credential_id: string
          id: string
          request_count: number
          window_start: string
        }
        Insert: {
          credential_id: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Update: {
          credential_id?: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_rate_limits_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "api_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      dropium_sync_logs: {
        Row: {
          action: string
          created_at: string
          detail_code: string | null
          error_message: string | null
          external_status: string | null
          http_status: number | null
          id: string
          internal_status: string | null
          numero_guia: string | null
          organizacion_id: string | null
          pedido_id: number | null
          request_payload: Json | null
          response_payload: Json | null
          success: boolean
        }
        Insert: {
          action: string
          created_at?: string
          detail_code?: string | null
          error_message?: string | null
          external_status?: string | null
          http_status?: number | null
          id?: string
          internal_status?: string | null
          numero_guia?: string | null
          organizacion_id?: string | null
          pedido_id?: number | null
          request_payload?: Json | null
          response_payload?: Json | null
          success?: boolean
        }
        Update: {
          action?: string
          created_at?: string
          detail_code?: string | null
          error_message?: string | null
          external_status?: string | null
          http_status?: number | null
          id?: string
          internal_status?: string | null
          numero_guia?: string | null
          organizacion_id?: string | null
          pedido_id?: number | null
          request_payload?: Json | null
          response_payload?: Json | null
          success?: boolean
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
          is_deleted: boolean
          low_stock_threshold: number
          organizacion_id: string | null
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
          is_deleted?: boolean
          low_stock_threshold?: number
          organizacion_id?: string | null
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
          is_deleted?: boolean
          low_stock_threshold?: number
          organizacion_id?: string | null
          price?: number | null
          product_name?: string
          sku?: string
          stock_available?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
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
          organizacion_id: string | null
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
          organizacion_id?: string | null
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
          organizacion_id?: string | null
          recorded_at?: string
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "location_history_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_products: {
        Row: {
          category: string | null
          cost_price: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          image_url_2: string | null
          image_url_3: string | null
          is_active: boolean
          is_deleted: boolean
          organizacion_id: string | null
          product_name: string
          product_type: string
          sku: string
          stock_available: number
          suggested_price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost_price?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          is_active?: boolean
          is_deleted?: boolean
          organizacion_id?: string | null
          product_name: string
          product_type?: string
          sku: string
          stock_available?: number
          suggested_price?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_price?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          is_active?: boolean
          is_deleted?: boolean
          organizacion_id?: string | null
          product_name?: string
          product_type?: string
          sku?: string
          stock_available?: number
          suggested_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_products_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          created_at: string
          destinatario: string
          estado: string | null
          id: string
          mensaje: string
          organizacion_id: string | null
          pedido_id: number
          tipo: string
        }
        Insert: {
          created_at?: string
          destinatario: string
          estado?: string | null
          id?: string
          mensaje: string
          organizacion_id?: string | null
          pedido_id: number
          tipo: string
        }
        Update: {
          created_at?: string
          destinatario?: string
          estado?: string | null
          id?: string
          mensaje?: string
          organizacion_id?: string | null
          pedido_id?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string | null
          line_total: number | null
          organizacion_id: string | null
          pedido_id: number
          product_name: string
          quantity: number
          sku: string | null
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          line_total?: number | null
          organizacion_id?: string | null
          pedido_id: number
          product_name: string
          quantity?: number
          sku?: string | null
          unit_price?: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          line_total?: number | null
          organizacion_id?: string | null
          pedido_id?: number
          product_name?: string
          quantity?: number
          sku?: string | null
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      organizaciones: {
        Row: {
          color_primario: string | null
          color_secundario: string | null
          created_at: string | null
          dominio_personalizado: string | null
          id: string
          logo_url: string | null
          nombre: string
          plan_activo: boolean | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          color_primario?: string | null
          color_secundario?: string | null
          created_at?: string | null
          dominio_personalizado?: string | null
          id?: string
          logo_url?: string | null
          nombre: string
          plan_activo?: boolean | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          color_primario?: string | null
          color_secundario?: string | null
          created_at?: string | null
          dominio_personalizado?: string | null
          id?: string
          logo_url?: string | null
          nombre?: string
          plan_activo?: boolean | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pedido_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          organizacion_id: string | null
          pedido_id: number
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          organizacion_id?: string | null
          pedido_id: number
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          organizacion_id?: string | null
          pedido_id?: number
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_messages_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_status_logs: {
        Row: {
          created_at: string
          estado_anterior: string | null
          estado_nuevo: string
          id: string
          motivo: string | null
          organizacion_id: string | null
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
          organizacion_id?: string | null
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
          organizacion_id?: string | null
          pedido_id?: number
          usuario_id?: string | null
          usuario_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_status_logs_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          barrio: string | null
          canal: string | null
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
          flete_aliado: number | null
          flete_tienda: number | null
          foto_evidencia: string | null
          foto_paquete: string | null
          fulfillment_cost: number | null
          guia_impresa: boolean | null
          guia_impresa_at: string | null
          hora_cierre_flex: string | null
          id: number
          id_externo: string | null
          indicador_trayecto: string | null
          integration_partner: string | null
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
          organizacion_id: string | null
          primer_intento_fecha: string | null
          producto_nombre: string | null
          proveedor_logistico_id: string | null
          quantity: number | null
          sla_cumplido: boolean | null
          tipo_novedad: string | null
          tipo_servicio: string
          utilidad: number | null
          valor_flete: number | null
          valor_producto: number | null
          valor_recaudar: number | null
          variant_id: string | null
          zona: string | null
        }
        Insert: {
          barrio?: string | null
          canal?: string | null
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
          flete_aliado?: number | null
          flete_tienda?: number | null
          foto_evidencia?: string | null
          foto_paquete?: string | null
          fulfillment_cost?: number | null
          guia_impresa?: boolean | null
          guia_impresa_at?: string | null
          hora_cierre_flex?: string | null
          id?: number
          id_externo?: string | null
          indicador_trayecto?: string | null
          integration_partner?: string | null
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
          organizacion_id?: string | null
          primer_intento_fecha?: string | null
          producto_nombre?: string | null
          proveedor_logistico_id?: string | null
          quantity?: number | null
          sla_cumplido?: boolean | null
          tipo_novedad?: string | null
          tipo_servicio?: string
          utilidad?: number | null
          valor_flete?: number | null
          valor_producto?: number | null
          valor_recaudar?: number | null
          variant_id?: string | null
          zona?: string | null
        }
        Update: {
          barrio?: string | null
          canal?: string | null
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
          flete_aliado?: number | null
          flete_tienda?: number | null
          foto_evidencia?: string | null
          foto_paquete?: string | null
          fulfillment_cost?: number | null
          guia_impresa?: boolean | null
          guia_impresa_at?: string | null
          hora_cierre_flex?: string | null
          id?: number
          id_externo?: string | null
          indicador_trayecto?: string | null
          integration_partner?: string | null
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
          organizacion_id?: string | null
          primer_intento_fecha?: string | null
          producto_nombre?: string | null
          proveedor_logistico_id?: string | null
          quantity?: number | null
          sla_cumplido?: boolean | null
          tipo_novedad?: string | null
          tipo_servicio?: string
          utilidad?: number | null
          valor_flete?: number | null
          valor_producto?: number | null
          valor_recaudar?: number | null
          variant_id?: string | null
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
          {
            foreignKeyName: "pedidos_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json
          cost_price: number | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          organizacion_id: string | null
          price: number | null
          product_id: string
          sku: string
          stock_available: number
          updated_at: string
          variant_name: string
        }
        Insert: {
          attributes?: Json
          cost_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          organizacion_id?: string | null
          price?: number | null
          product_id: string
          sku: string
          stock_available?: number
          updated_at?: string
          variant_name: string
        }
        Update: {
          attributes?: Json
          cost_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          organizacion_id?: string | null
          price?: number | null
          product_id?: string
          sku?: string
          stock_available?: number
          updated_at?: string
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
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
          integration_provider: string | null
          is_online: boolean | null
          last_location_lat: number | null
          last_location_lng: number | null
          last_location_updated_at: string | null
          logo_url: string | null
          nit_rut: string | null
          organizacion_id: string | null
          phone: string | null
          status: string
          store_name: string | null
          transaction_pin: string | null
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
          integration_provider?: string | null
          is_online?: boolean | null
          last_location_lat?: number | null
          last_location_lng?: number | null
          last_location_updated_at?: string | null
          logo_url?: string | null
          nit_rut?: string | null
          organizacion_id?: string | null
          phone?: string | null
          status?: string
          store_name?: string | null
          transaction_pin?: string | null
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
          integration_provider?: string | null
          is_online?: boolean | null
          last_location_lat?: number | null
          last_location_lng?: number | null
          last_location_updated_at?: string | null
          logo_url?: string | null
          nit_rut?: string | null
          organizacion_id?: string | null
          phone?: string | null
          status?: string
          store_name?: string | null
          transaction_pin?: string | null
          updated_at?: string
          user_id?: string
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_batches: {
        Row: {
          created_at: string
          failed_records: number
          filename: string
          id: string
          organizacion_id: string | null
          successful_records: number
          total_records: number
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          failed_records?: number
          filename: string
          id?: string
          organizacion_id?: string | null
          successful_records?: number
          total_records?: number
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          failed_records?: number
          filename?: string
          id?: string
          organizacion_id?: string | null
          successful_records?: number
          total_records?: number
          uploaded_by?: string | null
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
      transacciones_billetera: {
        Row: {
          client_user_id: string
          comprobante_url: string | null
          concepto: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json | null
          monto: number
          notas: string | null
          organizacion_id: string | null
          pedido_id: number | null
          saldo_anterior: number
          saldo_nuevo: number
          tipo: string
        }
        Insert: {
          client_user_id: string
          comprobante_url?: string | null
          concepto?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          monto: number
          notas?: string | null
          organizacion_id?: string | null
          pedido_id?: number | null
          saldo_anterior?: number
          saldo_nuevo?: number
          tipo?: string
        }
        Update: {
          client_user_id?: string
          comprobante_url?: string | null
          concepto?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          monto?: number
          notas?: string | null
          organizacion_id?: string | null
          pedido_id?: number | null
          saldo_anterior?: number
          saldo_nuevo?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "transacciones_billetera_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacciones_billetera_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          organizacion_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          organizacion_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          organizacion_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_payment_methods: {
        Row: {
          account_number: string | null
          account_type: string | null
          bank_name: string | null
          bre_b_key: string | null
          created_at: string
          id: string
          is_primary: boolean
          key_type: string | null
          method_type: string
          organizacion_id: string | null
          payment_mode: string
          recipient_doc_number: string | null
          recipient_doc_type: string | null
          recipient_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          bank_name?: string | null
          bre_b_key?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          key_type?: string | null
          method_type?: string
          organizacion_id?: string | null
          payment_mode?: string
          recipient_doc_number?: string | null
          recipient_doc_type?: string | null
          recipient_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          bank_name?: string | null
          bre_b_key?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          key_type?: string | null
          method_type?: string
          organizacion_id?: string | null
          payment_mode?: string
          recipient_doc_number?: string | null
          recipient_doc_type?: string | null
          recipient_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          organizacion_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          organizacion_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          organizacion_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          client_user_id: string
          created_at: string
          events: string[] | null
          failure_count: number
          id: string
          is_active: boolean
          label: string | null
          last_status_code: number | null
          last_triggered_at: string | null
          organizacion_id: string | null
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          client_user_id: string
          created_at?: string
          events?: string[] | null
          failure_count?: number
          id?: string
          is_active?: boolean
          label?: string | null
          last_status_code?: number | null
          last_triggered_at?: string | null
          organizacion_id?: string | null
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          client_user_id?: string
          created_at?: string
          events?: string[] | null
          failure_count?: number
          id?: string
          is_active?: boolean
          label?: string | null
          last_status_code?: number | null
          last_triggered_at?: string | null
          organizacion_id?: string | null
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs_incoming: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          payload: Json
          processing_status: string
          source: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json
          processing_status?: string
          source?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json
          processing_status?: string
          source?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          organizacion_id: string | null
          payment_method_id: string | null
          processed_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          id?: string
          organizacion_id?: string | null
          payment_method_id?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          organizacion_id?: string | null
          payment_method_id?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "user_payment_methods"
            referencedColumns: ["id"]
          },
        ]
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
      delete_user_completely: {
        Args: { target_user_id: string }
        Returns: Json
      }
      get_public_tracking_info: {
        Args: { search_tracking_number: string }
        Returns: Json
      }
      get_user_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      marketplace_reserve_stock: {
        Args: { p_product_id: string; p_quantity?: number }
        Returns: Json
      }
      process_bold_reconciliation: {
        Args: { p_filename: string; p_records: Json }
        Returns: Json
      }
      recalcular_billeteras_faltantes: {
        Args: { p_desde_fecha?: string; p_dry_run?: boolean }
        Returns: Json
      }
      transfer_store_balance: {
        Args: {
          p_provided_pin: string
          p_receiver_email: string
          p_sender_id: string
          p_transfer_amount: number
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "motorizado"
        | "cliente"
        | "despachador"
        | "super_admin"
        | "aliado_logistico"
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
      app_role: [
        "admin",
        "motorizado",
        "cliente",
        "despachador",
        "super_admin",
        "aliado_logistico",
      ],
    },
  },
} as const
