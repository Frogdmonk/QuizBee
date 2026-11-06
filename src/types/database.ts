/**
 * Database types for supabase-js.
 *
 * Hand-maintained until the hosted project exists; afterwards regenerate with:
 *   npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts
 * Keep this file in sync with supabase/migrations.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      teacher_profiles: {
        Row: {
          id: string;
          display_name: string;
          school_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          school_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          school_name?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      ensure_teacher_profile: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Tables']['teacher_profiles']['Row'];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database['public'];
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];

export type TeacherProfile = Tables<'teacher_profiles'>;
