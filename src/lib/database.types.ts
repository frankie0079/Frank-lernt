export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audio_notes: {
        Row: {
          audio_url: string
          author_name: string
          created_at: string
          diary_entry_id: string
          duration_seconds: number | null
          id: string
          storage_path: string
          tour_id: string
        }
        Insert: {
          audio_url: string
          author_name?: string
          created_at?: string
          diary_entry_id: string
          duration_seconds?: number | null
          id?: string
          storage_path: string
          tour_id: string
        }
        Update: {
          audio_url?: string
          author_name?: string
          created_at?: string
          diary_entry_id?: string
          duration_seconds?: number | null
          id?: string
          storage_path?: string
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_notes_diary_entry_id_fkey"
            columns: ["diary_entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_notes_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_entries: {
        Row: {
          author_name: string
          content: string
          created_at: string
          entry_date: string
          gps_lat: number | null
          gps_lng: number | null
          id: string
          title: string
          tour_id: string
        }
        Insert: {
          author_name?: string
          content?: string
          created_at?: string
          entry_date?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          title: string
          tour_id: string
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string
          entry_date?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          title?: string
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          author_name: string
          caption: string | null
          created_at: string
          diary_entry_id: string | null
          full_url: string
          gps_lat: number | null
          gps_lng: number | null
          height: number | null
          id: string
          storage_path: string
          taken_at: string | null
          thumbnail_url: string | null
          tour_id: string
          width: number | null
        }
        Insert: {
          author_name?: string
          caption?: string | null
          created_at?: string
          diary_entry_id?: string | null
          full_url: string
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          storage_path: string
          taken_at?: string | null
          thumbnail_url?: string | null
          tour_id: string
          width?: number | null
        }
        Update: {
          author_name?: string
          caption?: string | null
          created_at?: string
          diary_entry_id?: string | null
          full_url?: string
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          storage_path?: string
          taken_at?: string | null
          thumbnail_url?: string | null
          tour_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_diary_entry_id_fkey"
            columns: ["diary_entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tours: {
        Row: {
          cover_photo_url: string | null
          created_at: string
          current_stage: string | null
          description: string
          end_date: string
          id: string
          name: string
          participants: number
          start_date: string
          status: string
          subtitle: string
          total_km: number
        }
        Insert: {
          cover_photo_url?: string | null
          created_at?: string
          current_stage?: string | null
          description?: string
          end_date: string
          id: string
          name: string
          participants?: number
          start_date: string
          status?: string
          subtitle: string
          total_km?: number
        }
        Update: {
          cover_photo_url?: string | null
          created_at?: string
          current_stage?: string | null
          description?: string
          end_date?: string
          id?: string
          name?: string
          participants?: number
          start_date?: string
          status?: string
          subtitle?: string
          total_km?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  TableName extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]),
> = (DefaultSchema["Tables"] &
  DefaultSchema["Views"])[TableName] extends { Row: infer R }
  ? R
  : never

export type TablesInsert<
  TableName extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][TableName] extends { Insert: infer I } ? I : never

export type TablesUpdate<
  TableName extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][TableName] extends { Update: infer U } ? U : never
