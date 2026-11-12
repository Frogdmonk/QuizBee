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
type WorkspaceRoleEnum = 'owner' | 'member';
type QuizAccessEnum = 'view' | 'copy' | 'edit';
type QuizActivityActionEnum = 'edited' | 'published' | 'unpublished' | 'archived' | 'restored' | 'copied';
type SessionStatusEnum = 'lobby' | 'in_progress' | 'ended' | 'cancelled';
type SessionPhaseEnum = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'podium';
type ParticipantStatusEnum = 'active' | 'left' | 'removed';

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
          revision: number;
          updated_by: string | null;
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
          level: number | null;
          objective: string;
          topic: string;
          difficulty: 'easy' | 'medium' | 'hard' | null;
          kind: 'recall' | 'concept' | 'application' | 'predict' | 'bug' | 'multistep' | null;
          recovery: Json | null;
          code_language: string | null;
          code_content: string | null;
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
          misconception: string;
          label_is_code: boolean;
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
      workspaces: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      workspace_members: {
        Row: {
          workspace_id: string;
          teacher_id: string;
          role: WorkspaceRoleEnum;
          joined_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      workspace_invites: {
        /* token_hash exists but is not readable through the API. */
        Row: {
          id: string;
          workspace_id: string;
          created_by: string;
          expires_at: string;
          revoked_at: string | null;
          use_count: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      quiz_grants: {
        Row: {
          id: string;
          quiz_id: string;
          workspace_id: string;
          teacher_id: string | null;
          access: QuizAccessEnum;
          can_publish: boolean;
          granted_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      quiz_activity: {
        Row: {
          id: number;
          quiz_id: string;
          actor_id: string | null;
          action: QuizActivityActionEnum;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /** Readable by the host only; presenter_key_hash is not selectable. */
      game_sessions: {
        Row: {
          id: string;
          host_id: string;
          quiz_id: string | null;
          quiz_title: string;
          question_count: number;
          pin: string;
          status: SessionStatusEnum;
          phase: SessionPhaseEnum;
          state_version: number;
          is_locked: boolean;
          max_participants: number;
          participant_count: number;
          created_at: string;
          updated_at: string;
          started_at: string | null;
          ended_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /** Readable by the session host only; user_id is not selectable. */
      participants: {
        Row: {
          id: string;
          session_id: string;
          nickname: string;
          avatar: string;
          status: ParticipantStatusEnum;
          joined_at: string;
          last_seen_at: string;
          removed_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
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
      create_workspace: { Args: { p_name: string }; Returns: string };
      rename_workspace: { Args: { p_workspace_id: string; p_name: string }; Returns: undefined };
      delete_workspace: { Args: { p_workspace_id: string }; Returns: undefined };
      leave_workspace: { Args: { p_workspace_id: string }; Returns: undefined };
      remove_workspace_member: { Args: { p_workspace_id: string; p_teacher_id: string }; Returns: undefined };
      list_my_workspaces: { Args: Record<PropertyKey, never>; Returns: Json };
      get_workspace: { Args: { p_workspace_id: string }; Returns: Json };
      create_workspace_invite: { Args: { p_workspace_id: string }; Returns: Json };
      revoke_workspace_invite: { Args: { p_invite_id: string }; Returns: undefined };
      preview_workspace_invite: { Args: { p_token: string }; Returns: Json };
      accept_workspace_invite: { Args: { p_token: string }; Returns: string };
      get_quiz_sharing: { Args: { p_quiz_id: string }; Returns: Json };
      set_quiz_sharing: { Args: { p_quiz_id: string; p_workspace_id: string; p_settings: Json }; Returns: undefined };
      list_shared_with_me: { Args: Record<PropertyKey, never>; Returns: Json };
      get_quiz_permissions: { Args: { p_quiz_id: string }; Returns: Json };
      get_quiz_activity: { Args: { p_quiz_id: string }; Returns: Json };
      copy_shared_quiz: { Args: { p_quiz_id: string }; Returns: string };
      create_session: { Args: { p_quiz_id: string; p_settings?: Json }; Returns: string };
      get_session_lobby: { Args: { p_session_id: string }; Returns: Json };
      set_session_locked: { Args: { p_session_id: string; p_locked: boolean }; Returns: boolean };
      remove_participant: { Args: { p_session_id: string; p_participant_id: string }; Returns: undefined };
      cancel_session: { Args: { p_session_id: string }; Returns: undefined };
      create_presenter_link: { Args: { p_session_id: string }; Returns: string };
      claim_presenter: { Args: { p_session_id: string; p_key: string }; Returns: undefined };
      lookup_session: { Args: { p_pin: string }; Returns: Json };
      join_session: { Args: { p_session_id: string; p_nickname: string; p_avatar: string }; Returns: Json };
      leave_session: { Args: { p_session_id: string }; Returns: undefined };
      get_player_state: { Args: { p_session_id: string }; Returns: Json };
      start_game: { Args: { p_session_id: string; p_expected_version?: number | null }; Returns: number };
      close_question: { Args: { p_session_id: string; p_expected_version?: number | null }; Returns: number };
      show_leaderboard: { Args: { p_session_id: string; p_expected_version?: number | null }; Returns: number };
      next_question: { Args: { p_session_id: string; p_expected_version?: number | null }; Returns: number };
      end_game: { Args: { p_session_id: string }; Returns: number };
      advance_if_due: { Args: { p_session_id: string }; Returns: number };
      send_reaction: { Args: { p_session_id: string; p_emote: string }; Returns: Json };
      set_reactions_enabled: { Args: { p_session_id: string; p_enabled: boolean }; Returns: number };
      set_battle_settings: { Args: { p_session_id: string; p_settings: Json }; Returns: number };
      set_battle_monster: { Args: { p_session_id: string; p_spec: Json | null }; Returns: number };
      set_battle_difficulty: { Args: { p_session_id: string; p_difficulty: string }; Returns: number };
      set_weapon_settings: { Args: { p_session_id: string; p_settings: Json }; Returns: number };
      cast_weapon_vote: { Args: { p_vote_id: string; p_weapon: string }; Returns: Json };
      decide_weapon_vote: { Args: { p_session_id: string; p_weapon: string | null }; Returns: number };
      use_weapon_special: { Args: { p_session_id: string }; Returns: number };
      set_recovery_skipped: { Args: { p_session_id: string; p_skipped: boolean }; Returns: number };
      set_learning_settings: { Args: { p_session_id: string; p_settings: Json }; Returns: number };
      choose_powerup: { Args: { p_session_id: string; p_key: string }; Returns: Json };
      use_powerup: { Args: { p_session_id: string }; Returns: Json };
      use_team_ability: { Args: { p_session_id: string; p_ability: string }; Returns: number };
      set_powerup_settings: { Args: { p_session_id: string; p_settings: Json }; Returns: number };
      submit_answer: { Args: { p_session_question_id: string; p_option_id: string }; Returns: Json };
      server_now: { Args: Record<PropertyKey, never>; Returns: string };
      get_game_state: { Args: { p_session_id: string }; Returns: Json };
    };
    Enums: {
      quiz_status: QuizStatusEnum;
      question_type: QuestionTypeEnum;
      workspace_role: WorkspaceRoleEnum;
      quiz_access: QuizAccessEnum;
      quiz_activity_action: QuizActivityActionEnum;
      session_status: SessionStatusEnum;
      session_phase: SessionPhaseEnum;
      participant_status: ParticipantStatusEnum;
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
