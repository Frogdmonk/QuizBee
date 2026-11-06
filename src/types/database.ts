/**
 * Database types for supabase-js.
 *
 * Hand-maintained to match supabase/migrations. You can regenerate them from
 * the hosted project with:
 *   npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts
 * (then re-add the convenience aliases at the bottom).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type QuizStatusEnum = 'draft' | 'published' | 'archived';
type QuestionTypeEnum = 'multiple_choice' | 'true_false' | 'image_choice';

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
      quizzes: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string;
          subject: string;
          cover_image_path: string | null;
          speed_scoring: boolean;
          status: QuizStatusEnum;
          source_quiz_id: string | null;
          question_count: number;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      quiz_questions: {
        Row: {
          id: string;
          quiz_id: string;
          position: number;
          type: QuestionTypeEnum;
          prompt: string;
          image_path: string | null;
          time_limit_seconds: number;
          points: number;
          explanation: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'quiz_questions_quiz_id_fkey';
            columns: ['quiz_id'];
            isOneToOne: false;
            referencedRelation: 'quizzes';
            referencedColumns: ['id'];
          },
        ];
      };
      question_options: {
        Row: {
          id: string;
          question_id: string;
          position: number;
          label: string;
          image_path: string | null;
          is_correct: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'question_options_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'quiz_questions';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      ensure_teacher_profile: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Tables']['teacher_profiles']['Row'];
      };
      save_quiz: {
        Args: { p_quiz: Json };
        Returns: string;
      };
      set_quiz_status: {
        Args: { p_quiz_id: string; p_status: QuizStatusEnum };
        Returns: QuizStatusEnum;
      };
      duplicate_quiz: {
        Args: { p_quiz_id: string };
        Returns: string;
      };
    };
    Enums: {
      quiz_status: QuizStatusEnum;
      question_type: QuestionTypeEnum;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database['public'];
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];

export type TeacherProfile = Tables<'teacher_profiles'>;
export type QuizRow = Tables<'quizzes'>;
export type QuizQuestionRow = Tables<'quiz_questions'>;
export type QuestionOptionRow = Tables<'question_options'>;
