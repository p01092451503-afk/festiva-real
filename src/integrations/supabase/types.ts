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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      announcement_i18n: {
        Row: {
          announcement_id: string
          content: string
          created_at: string
          id: string
          language_code: string
          source_hash: string | null
          title: string
          translated_at: string | null
          translation_status: string
          updated_at: string
        }
        Insert: {
          announcement_id: string
          content: string
          created_at?: string
          id?: string
          language_code: string
          source_hash?: string | null
          title: string
          translated_at?: string | null
          translation_status?: string
          updated_at?: string
        }
        Update: {
          announcement_id?: string
          content?: string
          created_at?: string
          id?: string
          language_code?: string
          source_hash?: string | null
          title?: string
          translated_at?: string | null
          translation_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_i18n_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string
          category: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          is_published: boolean
          target_branch_id: string | null
          target_branch_ids: string[]
          target_country_code: string | null
          target_country_codes: string[]
          target_course_id: string | null
          target_course_ids: string[]
          target_scope: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          category?: string
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          target_branch_id?: string | null
          target_branch_ids?: string[]
          target_country_code?: string | null
          target_country_codes?: string[]
          target_course_id?: string | null
          target_course_ids?: string[]
          target_scope?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          target_branch_id?: string | null
          target_branch_ids?: string[]
          target_country_code?: string | null
          target_country_codes?: string[]
          target_course_id?: string | null
          target_course_ids?: string[]
          target_scope?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_target_branch_id_fkey"
            columns: ["target_branch_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_target_course_id_fkey"
            columns: ["target_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      article_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          author_id: string | null
          body: string
          category_id: string | null
          created_at: string
          id: string
          language_code: string
          publish_at: string | null
          published_at: string | null
          search_tsv: unknown
          slug: string | null
          status: Database["public"]["Enums"]["article_status"]
          summary: string | null
          tags: string[]
          thumbnail_url: string | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id?: string | null
          body?: string
          category_id?: string | null
          created_at?: string
          id?: string
          language_code?: string
          publish_at?: string | null
          published_at?: string | null
          search_tsv?: unknown
          slug?: string | null
          status?: Database["public"]["Enums"]["article_status"]
          summary?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string | null
          body?: string
          category_id?: string | null
          created_at?: string
          id?: string
          language_code?: string
          publish_at?: string | null
          published_at?: string | null
          search_tsv?: unknown
          slug?: string | null
          status?: Database["public"]["Enums"]["article_status"]
          summary?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "article_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_answers: {
        Row: {
          attempt_id: string
          created_at: string
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          is_correct: boolean | null
          points_earned: number | null
          question_id: string
          user_answer: string | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id: string
          user_answer?: string | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id?: string
          user_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_attempts: {
        Row: {
          assessment_id: string
          completed_at: string | null
          created_at: string
          id: string
          passed: boolean | null
          score: number | null
          started_at: string
          total_points: number | null
          user_id: string
        }
        Insert: {
          assessment_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          passed?: boolean | null
          score?: number | null
          started_at?: string
          total_points?: number | null
          user_id: string
        }
        Update: {
          assessment_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          passed?: boolean | null
          score?: number | null
          started_at?: string
          total_points?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_i18n: {
        Row: {
          assessment_id: string
          created_at: string
          description: string | null
          id: string
          language_code: string
          source_hash: string | null
          title: string
          translated_at: string | null
          translation_status: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          description?: string | null
          id?: string
          language_code: string
          source_hash?: string | null
          title: string
          translated_at?: string | null
          translation_status?: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          description?: string | null
          id?: string
          language_code?: string
          source_hash?: string | null
          title?: string
          translated_at?: string | null
          translation_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_i18n_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_pool_rules: {
        Row: {
          assessment_id: string
          category_id: string | null
          created_at: string
          difficulty: Database["public"]["Enums"]["question_difficulty"] | null
          id: string
          include_course: boolean
          include_global: boolean
          learner_level: Database["public"]["Enums"]["learner_level"] | null
          question_count: number
          sort_order: number
          tag: string | null
          updated_at: string
        }
        Insert: {
          assessment_id: string
          category_id?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["question_difficulty"] | null
          id?: string
          include_course?: boolean
          include_global?: boolean
          learner_level?: Database["public"]["Enums"]["learner_level"] | null
          question_count?: number
          sort_order?: number
          tag?: string | null
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          category_id?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["question_difficulty"] | null
          id?: string
          include_course?: boolean
          include_global?: boolean
          learner_level?: Database["public"]["Enums"]["learner_level"] | null
          question_count?: number
          sort_order?: number
          tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_pool_rules_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_pool_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "question_bank_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_question_i18n: {
        Row: {
          correct_answer: string | null
          created_at: string
          explanation: string | null
          hint: string | null
          id: string
          language_code: string
          options: Json | null
          question_id: string
          question_text: string
          source_hash: string | null
          translated_at: string | null
          translation_status: string
          updated_at: string
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string
          explanation?: string | null
          hint?: string | null
          id?: string
          language_code: string
          options?: Json | null
          question_id: string
          question_text: string
          source_hash?: string | null
          translated_at?: string | null
          translation_status?: string
          updated_at?: string
        }
        Update: {
          correct_answer?: string | null
          created_at?: string
          explanation?: string | null
          hint?: string | null
          id?: string
          language_code?: string
          options?: Json | null
          question_id?: string
          question_text?: string
          source_hash?: string | null
          translated_at?: string | null
          translation_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_question_i18n_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          correct_answer: string
          created_at: string
          explanation: string | null
          hint: string | null
          id: string
          options: Json | null
          order_index: number
          points: number
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          updated_at: string
        }
        Insert: {
          assessment_id: string
          correct_answer: string
          created_at?: string
          explanation?: string | null
          hint?: string | null
          id?: string
          options?: Json | null
          order_index?: number
          points?: number
          question_text: string
          question_type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          correct_answer?: string
          created_at?: string
          explanation?: string | null
          hint?: string | null
          id?: string
          options?: Json | null
          order_index?: number
          points?: number
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          completion_threshold: number
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          max_attempts: number
          order_index: number
          passing_score: number
          randomize_questions: boolean
          require_assessment_for_completion: boolean
          selection_mode: Database["public"]["Enums"]["assessment_selection_mode"]
          time_limit_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          completion_threshold?: number
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          max_attempts?: number
          order_index?: number
          passing_score?: number
          randomize_questions?: boolean
          require_assessment_for_completion?: boolean
          selection_mode?: Database["public"]["Enums"]["assessment_selection_mode"]
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          completion_threshold?: number
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          max_attempts?: number
          order_index?: number
          passing_score?: number
          randomize_questions?: boolean
          require_assessment_for_completion?: boolean
          selection_mode?: Database["public"]["Enums"]["assessment_selection_mode"]
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          feedback: string | null
          file_urls: string[] | null
          graded_at: string | null
          graded_by: string | null
          id: string
          score: number | null
          status: Database["public"]["Enums"]["submission_status"] | null
          student_id: string
          submission_text: string | null
          submitted_at: string | null
        }
        Insert: {
          assignment_id: string
          feedback?: string | null
          file_urls?: string[] | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"] | null
          student_id: string
          submission_text?: string | null
          submitted_at?: string | null
        }
        Update: {
          assignment_id?: string
          feedback?: string | null
          file_urls?: string[] | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"] | null
          student_id?: string
          submission_text?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_late_submission: boolean | null
          course_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          instructions: string | null
          max_score: number | null
          status: Database["public"]["Enums"]["assignment_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          allow_late_submission?: boolean | null
          course_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          max_score?: number | null
          status?: Database["public"]["Enums"]["assignment_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          allow_late_submission?: boolean | null
          course_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          max_score?: number | null
          status?: Database["public"]["Enums"]["assignment_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          attendance_date: string | null
          check_in_time: string | null
          course_id: string
          created_at: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attendance_date?: string | null
          check_in_time?: string | null
          course_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attendance_date?: string | null
          check_in_time?: string | null
          course_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          badge_type: string
          created_at: string | null
          description: string | null
          icon: string
          id: string
          name: string
          requirement_type: string
          requirement_value: number
        }
        Insert: {
          badge_type: string
          created_at?: string | null
          description?: string | null
          icon: string
          id?: string
          name: string
          requirement_type: string
          requirement_value: number
        }
        Update: {
          badge_type?: string
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          name?: string
          requirement_type?: string
          requirement_value?: number
        }
        Relationships: []
      }
      beneficiary_students: {
        Row: {
          birth_year: number | null
          branch_id: string | null
          cohort: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          dept_name: string | null
          enrolled_on: string | null
          full_name: string
          gender: string | null
          grade: string | null
          id: string
          income_bracket: number | null
          is_vulnerable: boolean
          metadata: Json
          nationality: string | null
          notes: string | null
          profile_id: string | null
          program_name: string | null
          status: string
          student_no: string
          track: string | null
          updated_at: string
          vulnerable_type: string | null
        }
        Insert: {
          birth_year?: number | null
          branch_id?: string | null
          cohort?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          dept_name?: string | null
          enrolled_on?: string | null
          full_name: string
          gender?: string | null
          grade?: string | null
          id?: string
          income_bracket?: number | null
          is_vulnerable?: boolean
          metadata?: Json
          nationality?: string | null
          notes?: string | null
          profile_id?: string | null
          program_name?: string | null
          status?: string
          student_no: string
          track?: string | null
          updated_at?: string
          vulnerable_type?: string | null
        }
        Update: {
          birth_year?: number | null
          branch_id?: string | null
          cohort?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          dept_name?: string | null
          enrolled_on?: string | null
          full_name?: string
          gender?: string | null
          grade?: string | null
          id?: string
          income_bracket?: number | null
          is_vulnerable?: boolean
          metadata?: Json
          nationality?: string | null
          notes?: string | null
          profile_id?: string | null
          program_name?: string | null
          status?: string
          student_no?: string
          track?: string | null
          updated_at?: string
          vulnerable_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beneficiary_students_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiary_students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      board_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      board_post_i18n: {
        Row: {
          content: string
          created_at: string
          id: string
          language_code: string
          post_id: string
          source_hash: string | null
          title: string
          translated_at: string | null
          translation_status: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          language_code: string
          post_id: string
          source_hash?: string | null
          title: string
          translated_at?: string | null
          translation_status?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          language_code?: string
          post_id?: string
          source_hash?: string | null
          title?: string
          translated_at?: string | null
          translation_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_post_i18n_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      board_posts: {
        Row: {
          author_id: string
          content: string
          course_id: string | null
          created_at: string
          file_urls: string[] | null
          id: string
          is_pinned: boolean
          is_published: boolean
          target_branch_id: string | null
          target_branch_ids: string[]
          target_country_code: string | null
          target_country_codes: string[]
          target_course_ids: string[]
          target_scope: string
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id: string
          content: string
          course_id?: string | null
          created_at?: string
          file_urls?: string[] | null
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          target_branch_id?: string | null
          target_branch_ids?: string[]
          target_country_code?: string | null
          target_country_codes?: string[]
          target_course_ids?: string[]
          target_scope?: string
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string
          content?: string
          course_id?: string | null
          created_at?: string
          file_urls?: string[] | null
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          target_branch_id?: string | null
          target_branch_ids?: string[]
          target_country_code?: string | null
          target_country_codes?: string[]
          target_course_ids?: string[]
          target_scope?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "board_posts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_posts_target_branch_id_fkey"
            columns: ["target_branch_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_admin_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          branch_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          branch_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          branch_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_admin_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_admin_capabilities: {
        Row: {
          code: string
          created_at: string
          description_en: string | null
          description_ko: string | null
          id: string
          name_en: string
          name_ko: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          description_en?: string | null
          description_ko?: string | null
          id?: string
          name_en: string
          name_ko: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          description_en?: string | null
          description_ko?: string | null
          id?: string
          name_en?: string
          name_ko?: string
          sort_order?: number
        }
        Relationships: []
      }
      branch_admin_permissions: {
        Row: {
          branch_id: string
          capability_code: string
          created_at: string
          enabled: boolean
          granted_at: string
          granted_by: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id: string
          capability_code: string
          created_at?: string
          enabled?: boolean
          granted_at?: string
          granted_by?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          capability_code?: string
          created_at?: string
          enabled?: boolean
          granted_at?: string
          granted_by?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_admin_permissions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_admin_permissions_capability_code_fkey"
            columns: ["capability_code"]
            isOneToOne: false
            referencedRelation: "branch_admin_capabilities"
            referencedColumns: ["code"]
          },
        ]
      }
      cart_items: {
        Row: {
          added_at: string
          course_id: string
          id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          course_id: string
          id?: string
          user_id: string
        }
        Update: {
          added_at?: string
          course_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          description_en: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      certificate_templates: {
        Row: {
          background_image_url: string | null
          course_id: string | null
          created_at: string
          description_text: string | null
          id: string
          issuer_name: string | null
          title_text: string
          updated_at: string
        }
        Insert: {
          background_image_url?: string | null
          course_id?: string | null
          created_at?: string
          description_text?: string | null
          id?: string
          issuer_name?: string | null
          title_text?: string
          updated_at?: string
        }
        Update: {
          background_image_url?: string | null
          course_id?: string | null
          created_at?: string
          description_text?: string | null
          id?: string
          issuer_name?: string | null
          title_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_templates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          certificate_number: string
          course_id: string
          created_at: string
          id: string
          issued_at: string
          user_id: string
        }
        Insert: {
          certificate_number: string
          course_id: string
          created_at?: string
          id?: string
          issued_at?: string
          user_id: string
        }
        Update: {
          certificate_number?: string
          course_id?: string
          created_at?: string
          id?: string
          issued_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      community_badges: {
        Row: {
          code: string
          color: string | null
          created_at: string
          criteria: Json | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          criteria?: Json | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          criteria?: Json | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      community_bookmarks: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_categories: {
        Row: {
          category_type: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
          write_role: string
        }
        Insert: {
          category_type?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
          write_role?: string
        }
        Update: {
          category_type?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          write_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "community_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_hidden: boolean
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      community_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string
          category_id: string | null
          content: string
          created_at: string
          id: string
          image_urls: string[]
          is_hidden: boolean
          is_pinned: boolean
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id: string
          category_id?: string | null
          content: string
          created_at?: string
          id?: string
          image_urls?: string[]
          is_hidden?: boolean
          is_pinned?: boolean
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string
          category_id?: string | null
          content?: string
          created_at?: string
          id?: string
          image_urls?: string[]
          is_hidden?: boolean
          is_pinned?: boolean
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "community_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      community_qna_answers: {
        Row: {
          accepted_at: string | null
          author_id: string
          content: string
          created_at: string
          id: string
          is_accepted: boolean
          like_count: number
          post_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_accepted?: boolean
          like_count?: number
          post_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_accepted?: boolean
          like_count?: number
          post_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_rankings_daily: {
        Row: {
          comment_count: number
          created_at: string
          follower_count: number
          id: string
          like_received: number
          post_count: number
          rank: number | null
          score: number
          snapshot_date: string
          user_id: string
        }
        Insert: {
          comment_count?: number
          created_at?: string
          follower_count?: number
          id?: string
          like_received?: number
          post_count?: number
          rank?: number | null
          score?: number
          snapshot_date: string
          user_id: string
        }
        Update: {
          comment_count?: number
          created_at?: string
          follower_count?: number
          id?: string
          like_received?: number
          post_count?: number
          rank?: number | null
          score?: number
          snapshot_date?: string
          user_id?: string
        }
        Relationships: []
      }
      community_reports: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          reason: string
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      community_user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "community_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      completion_criteria: {
        Row: {
          certificate_enabled: boolean
          course_id: string
          created_at: string
          id: string
          min_assessment_score: number | null
          min_progress_pct: number
          updated_at: string
        }
        Insert: {
          certificate_enabled?: boolean
          course_id: string
          created_at?: string
          id?: string
          min_assessment_score?: number | null
          min_progress_pct?: number
          updated_at?: string
        }
        Update: {
          certificate_enabled?: boolean
          course_id?: string
          created_at?: string
          id?: string
          min_assessment_score?: number | null
          min_progress_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "completion_criteria_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      content_comments: {
        Row: {
          body: string
          content_id: string
          course_id: string | null
          created_at: string
          id: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          content_id: string
          course_id?: string | null
          created_at?: string
          id?: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          content_id?: string
          course_id?: string | null
          created_at?: string
          id?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "content_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      content_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          content_id: string
          id: string
          last_accessed_at: string | null
          last_position_seconds: number | null
          progress_percentage: number | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          content_id: string
          id?: string
          last_accessed_at?: string | null
          last_position_seconds?: number | null
          progress_percentage?: number | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          content_id?: string
          id?: string
          last_accessed_at?: string | null
          last_position_seconds?: number | null
          progress_percentage?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_progress_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "course_contents"
            referencedColumns: ["id"]
          },
        ]
      }
      content_summaries: {
        Row: {
          content_id: string
          created_at: string
          id: string
          key_points: Json
          keywords: Json
          language: string
          model: string | null
          source: string
          summary: string
          transcript: string | null
          transcript_chars: number | null
          transcript_lang: string | null
          updated_at: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          key_points?: Json
          keywords?: Json
          language?: string
          model?: string | null
          source?: string
          summary: string
          transcript?: string | null
          transcript_chars?: number | null
          transcript_lang?: string | null
          updated_at?: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          key_points?: Json
          keywords?: Json
          language?: string
          model?: string | null
          source?: string
          summary?: string
          transcript?: string | null
          transcript_chars?: number | null
          transcript_lang?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_summaries_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "course_contents"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_annotations: {
        Row: {
          author_id: string
          comment: string | null
          created_at: string
          id: string
          page_id: string
          request_id: string
          snapshot: Json | null
          updated_at: string
        }
        Insert: {
          author_id: string
          comment?: string | null
          created_at?: string
          id?: string
          page_id: string
          request_id: string
          snapshot?: Json | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          page_id?: string
          request_id?: string
          snapshot?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_annotations_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "correction_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_annotations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "correction_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_assignment_targets: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          request_id: string | null
          status: string
          student_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          request_id?: string | null
          status?: string
          student_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          request_id?: string | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_assignment_targets_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "correction_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_assignment_targets_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "correction_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_assignments: {
        Row: {
          assigned_by: string
          course_id: string | null
          created_at: string
          due_at: string | null
          id: string
          instructions: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          course_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          course_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_pages: {
        Row: {
          annotated_path: string | null
          created_at: string
          height: number | null
          id: string
          original_path: string
          page_no: number
          request_id: string
          updated_at: string
          width: number | null
        }
        Insert: {
          annotated_path?: string | null
          created_at?: string
          height?: number | null
          id?: string
          original_path: string
          page_no: number
          request_id: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          annotated_path?: string | null
          created_at?: string
          height?: number | null
          id?: string
          original_path?: string
          page_no?: number
          request_id?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "correction_pages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "correction_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_requests: {
        Row: {
          assigned_teacher_id: string | null
          completed_at: string | null
          course_id: string | null
          created_at: string
          id: string
          next_recommendation: string | null
          note: string | null
          score: number | null
          status: Database["public"]["Enums"]["correction_status"]
          student_id: string
          submitted_at: string
          summary: string | null
          topic: string
          updated_at: string
        }
        Insert: {
          assigned_teacher_id?: string | null
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          next_recommendation?: string | null
          note?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["correction_status"]
          student_id: string
          submitted_at?: string
          summary?: string | null
          topic: string
          updated_at?: string
        }
        Update: {
          assigned_teacher_id?: string | null
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          next_recommendation?: string | null
          note?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["correction_status"]
          student_id?: string
          submitted_at?: string
          summary?: string | null
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          max_discount_amount: number | null
          min_order_amount: number
          name: string
          starts_at: string | null
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          min_order_amount?: number
          name: string
          starts_at?: string | null
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          min_order_amount?: number
          name?: string
          starts_at?: string | null
          usage_limit?: number | null
          used_count?: number
        }
        Relationships: []
      }
      course_content_i18n: {
        Row: {
          bunny_video_guid: string | null
          content_id: string
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          language_code: string
          source_hash: string | null
          title: string
          translated_at: string | null
          translation_status: string
          updated_at: string | null
          video_provider: string | null
          video_url: string | null
        }
        Insert: {
          bunny_video_guid?: string | null
          content_id: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          language_code: string
          source_hash?: string | null
          title: string
          translated_at?: string | null
          translation_status?: string
          updated_at?: string | null
          video_provider?: string | null
          video_url?: string | null
        }
        Update: {
          bunny_video_guid?: string | null
          content_id?: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          language_code?: string
          source_hash?: string | null
          title?: string
          translated_at?: string | null
          translation_status?: string
          updated_at?: string | null
          video_provider?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_content_i18n_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "course_contents"
            referencedColumns: ["id"]
          },
        ]
      }
      course_contents: {
        Row: {
          bunny_video_guid: string | null
          content_type: Database["public"]["Enums"]["content_type"] | null
          course_id: string
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_preview: boolean | null
          is_published: boolean | null
          order_index: number | null
          title: string
          transcript: string | null
          updated_at: string | null
          video_provider: Database["public"]["Enums"]["video_provider"] | null
          video_url: string | null
        }
        Insert: {
          bunny_video_guid?: string | null
          content_type?: Database["public"]["Enums"]["content_type"] | null
          course_id: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_preview?: boolean | null
          is_published?: boolean | null
          order_index?: number | null
          title: string
          transcript?: string | null
          updated_at?: string | null
          video_provider?: Database["public"]["Enums"]["video_provider"] | null
          video_url?: string | null
        }
        Update: {
          bunny_video_guid?: string | null
          content_type?: Database["public"]["Enums"]["content_type"] | null
          course_id?: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_preview?: boolean | null
          is_published?: boolean | null
          order_index?: number | null
          title?: string
          transcript?: string | null
          updated_at?: string | null
          video_provider?: Database["public"]["Enums"]["video_provider"] | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_contents_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_detail_blocks: {
        Row: {
          block_type: string
          checklist_items: string[] | null
          content: string | null
          course_id: string
          created_at: string
          id: string
          image_url: string | null
          sort_order: number
          title: string | null
          video_provider: string | null
          video_url: string | null
        }
        Insert: {
          block_type: string
          checklist_items?: string[] | null
          content?: string | null
          course_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          sort_order?: number
          title?: string | null
          video_provider?: string | null
          video_url?: string | null
        }
        Update: {
          block_type?: string
          checklist_items?: string[] | null
          content?: string | null
          course_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          sort_order?: number
          title?: string | null
          video_provider?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_detail_blocks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_drafts: {
        Row: {
          created_at: string
          draft_data: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          draft_data?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          draft_data?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      course_i18n: {
        Row: {
          course_id: string
          created_at: string | null
          description: string | null
          id: string
          language_code: string
          source_hash: string | null
          title: string
          translated_at: string | null
          translation_status: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          language_code: string
          source_hash?: string | null
          title: string
          translated_at?: string | null
          translation_status?: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          language_code?: string
          source_hash?: string | null
          title?: string
          translated_at?: string | null
          translation_status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_i18n_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_invitations: {
        Row: {
          affiliation: string | null
          branch_id: string | null
          consumed_at: string | null
          course_id: string | null
          created_at: string
          created_by: string | null
          delivery_method: string
          email: string | null
          error_message: string | null
          expires_at: string
          id: string
          message_body: string | null
          phone: string
          recipient_name: string
          sent_at: string | null
          status: string
          temp_password: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          affiliation?: string | null
          branch_id?: string | null
          consumed_at?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_method: string
          email?: string | null
          error_message?: string | null
          expires_at?: string
          id?: string
          message_body?: string | null
          phone: string
          recipient_name: string
          sent_at?: string | null
          status?: string
          temp_password?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          affiliation?: string | null
          branch_id?: string | null
          consumed_at?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_method?: string
          email?: string | null
          error_message?: string | null
          expires_at?: string
          id?: string
          message_body?: string | null
          phone?: string
          recipient_name?: string
          sent_at?: string | null
          status?: string
          temp_password?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      course_package_items: {
        Row: {
          child_course_id: string
          created_at: string
          id: string
          package_course_id: string
          sort_order: number
        }
        Insert: {
          child_course_id: string
          created_at?: string
          id?: string
          package_course_id: string
          sort_order?: number
        }
        Update: {
          child_course_id?: string
          created_at?: string
          id?: string
          package_course_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_package_items_child_course_id_fkey"
            columns: ["child_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_package_items_package_course_id_fkey"
            columns: ["package_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_pricing_tiers: {
        Row: {
          course_id: string
          created_at: string
          display_name: string | null
          duration_days: number
          id: string
          list_price: number
          points: number
          sale_price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          display_name?: string | null
          duration_days: number
          id?: string
          list_price?: number
          points?: number
          sale_price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          display_name?: string | null
          duration_days?: number
          id?: string
          list_price?: number
          points?: number
          sale_price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_pricing_tiers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_target_departments: {
        Row: {
          course_id: string
          department_id: string
        }
        Insert: {
          course_id: string
          department_id: string
        }
        Update: {
          course_id?: string
          department_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_target_departments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_target_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          always_recruiting: boolean
          attachment_url: string | null
          auto_start_grace_days: number
          base_category: string | null
          category_id: string | null
          course_type: string
          created_at: string | null
          daily_learning_limit_min: number | null
          deadline: string | null
          description: string | null
          detail_intro_html: string | null
          difficulty_level: string | null
          enrolled_count: number
          estimated_duration_hours: number | null
          id: string
          installment_enabled: boolean
          installment_months: number | null
          instructor_bio: string | null
          instructor_id: string | null
          intro_video_provider: string | null
          intro_video_url: string | null
          is_b2c: boolean
          is_mandatory: boolean | null
          is_sequential: boolean
          keywords: string[]
          max_students: number | null
          period_mode: boolean
          preview_video_url: string | null
          price: number
          rating_avg: number
          rating_count: number
          retake_allow_coupon_stack: boolean
          retake_discount_enabled: boolean
          retake_discount_percent: number | null
          sale_ends_at: string | null
          sale_price: number | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          short_intro_html: string | null
          status: string | null
          subtitle: string | null
          support_options: string[]
          suspension_enabled: boolean
          tags: string[] | null
          target_departments: string[] | null
          textbook_author: string | null
          textbook_description: string | null
          textbook_image_url: string | null
          textbook_isbn: string | null
          textbook_price: number | null
          textbook_publisher: string | null
          textbook_purchase_url: string | null
          textbook_title: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          version: number | null
          visibility: string
          visibility_end_at: string | null
          visibility_start_at: string | null
        }
        Insert: {
          always_recruiting?: boolean
          attachment_url?: string | null
          auto_start_grace_days?: number
          base_category?: string | null
          category_id?: string | null
          course_type?: string
          created_at?: string | null
          daily_learning_limit_min?: number | null
          deadline?: string | null
          description?: string | null
          detail_intro_html?: string | null
          difficulty_level?: string | null
          enrolled_count?: number
          estimated_duration_hours?: number | null
          id?: string
          installment_enabled?: boolean
          installment_months?: number | null
          instructor_bio?: string | null
          instructor_id?: string | null
          intro_video_provider?: string | null
          intro_video_url?: string | null
          is_b2c?: boolean
          is_mandatory?: boolean | null
          is_sequential?: boolean
          keywords?: string[]
          max_students?: number | null
          period_mode?: boolean
          preview_video_url?: string | null
          price?: number
          rating_avg?: number
          rating_count?: number
          retake_allow_coupon_stack?: boolean
          retake_discount_enabled?: boolean
          retake_discount_percent?: number | null
          sale_ends_at?: string | null
          sale_price?: number | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          short_intro_html?: string | null
          status?: string | null
          subtitle?: string | null
          support_options?: string[]
          suspension_enabled?: boolean
          tags?: string[] | null
          target_departments?: string[] | null
          textbook_author?: string | null
          textbook_description?: string | null
          textbook_image_url?: string | null
          textbook_isbn?: string | null
          textbook_price?: number | null
          textbook_publisher?: string | null
          textbook_purchase_url?: string | null
          textbook_title?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          version?: number | null
          visibility?: string
          visibility_end_at?: string | null
          visibility_start_at?: string | null
        }
        Update: {
          always_recruiting?: boolean
          attachment_url?: string | null
          auto_start_grace_days?: number
          base_category?: string | null
          category_id?: string | null
          course_type?: string
          created_at?: string | null
          daily_learning_limit_min?: number | null
          deadline?: string | null
          description?: string | null
          detail_intro_html?: string | null
          difficulty_level?: string | null
          enrolled_count?: number
          estimated_duration_hours?: number | null
          id?: string
          installment_enabled?: boolean
          installment_months?: number | null
          instructor_bio?: string | null
          instructor_id?: string | null
          intro_video_provider?: string | null
          intro_video_url?: string | null
          is_b2c?: boolean
          is_mandatory?: boolean | null
          is_sequential?: boolean
          keywords?: string[]
          max_students?: number | null
          period_mode?: boolean
          preview_video_url?: string | null
          price?: number
          rating_avg?: number
          rating_count?: number
          retake_allow_coupon_stack?: boolean
          retake_discount_enabled?: boolean
          retake_discount_percent?: number | null
          sale_ends_at?: string | null
          sale_price?: number | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          short_intro_html?: string | null
          status?: string | null
          subtitle?: string | null
          support_options?: string[]
          suspension_enabled?: boolean
          tags?: string[] | null
          target_departments?: string[] | null
          textbook_author?: string | null
          textbook_description?: string | null
          textbook_image_url?: string | null
          textbook_isbn?: string | null
          textbook_price?: number | null
          textbook_publisher?: string | null
          textbook_purchase_url?: string | null
          textbook_title?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          version?: number | null
          visibility?: string
          visibility_end_at?: string | null
          visibility_start_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_preset_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          override_thumbnail_url: string | null
          override_title: string | null
          preset_id: string
          sort_order: number
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          override_thumbnail_url?: string | null
          override_title?: string | null
          preset_id: string
          sort_order?: number
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          override_thumbnail_url?: string | null
          override_title?: string | null
          preset_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "demo_preset_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_preset_courses_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "demo_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_presets: {
        Row: {
          accent_hsl: string | null
          brand_name: string | null
          brand_tagline: string | null
          created_at: string
          id: string
          industry: string
          is_active: boolean
          login_bg_image_url: string | null
          login_form_brand_name: string | null
          login_form_logo_url: string | null
          login_subtitle: string | null
          login_top_text: string | null
          logo_url: string | null
          name: string
          sidebar_brand_name: string | null
          sidebar_logo_url: string | null
          updated_at: string
        }
        Insert: {
          accent_hsl?: string | null
          brand_name?: string | null
          brand_tagline?: string | null
          created_at?: string
          id?: string
          industry?: string
          is_active?: boolean
          login_bg_image_url?: string | null
          login_form_brand_name?: string | null
          login_form_logo_url?: string | null
          login_subtitle?: string | null
          login_top_text?: string | null
          logo_url?: string | null
          name: string
          sidebar_brand_name?: string | null
          sidebar_logo_url?: string | null
          updated_at?: string
        }
        Update: {
          accent_hsl?: string | null
          brand_name?: string | null
          brand_tagline?: string | null
          created_at?: string
          id?: string
          industry?: string
          is_active?: boolean
          login_bg_image_url?: string | null
          login_form_brand_name?: string | null
          login_form_logo_url?: string | null
          login_subtitle?: string | null
          login_top_text?: string | null
          logo_url?: string | null
          name?: string
          sidebar_brand_name?: string | null
          sidebar_logo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string | null
          country_code: string | null
          created_at: string | null
          display_order: number | null
          entity_type: string | null
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          parent_department_id: string | null
          team_name: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          country_code?: string | null
          created_at?: string | null
          display_order?: number | null
          entity_type?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          parent_department_id?: string | null
          team_name?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          country_code?: string | null
          created_at?: string | null
          display_order?: number | null
          entity_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          parent_department_id?: string | null
          team_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_department_id_fkey"
            columns: ["parent_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      english_corrections: {
        Row: {
          alternatives: Json | null
          cefr_level: string | null
          corrected_text: string
          created_at: string
          diffs: Json | null
          id: string
          issues: Json | null
          model: string | null
          original_text: string
          overall_feedback_ko: string | null
          tone: string
          user_id: string
        }
        Insert: {
          alternatives?: Json | null
          cefr_level?: string | null
          corrected_text: string
          created_at?: string
          diffs?: Json | null
          id?: string
          issues?: Json | null
          model?: string | null
          original_text: string
          overall_feedback_ko?: string | null
          tone?: string
          user_id: string
        }
        Update: {
          alternatives?: Json | null
          cefr_level?: string | null
          corrected_text?: string
          created_at?: string
          diffs?: Json | null
          id?: string
          issues?: Json | null
          model?: string | null
          original_text?: string
          overall_feedback_ko?: string | null
          tone?: string
          user_id?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          enrolled_at: string | null
          expires_at: string | null
          id: string
          order_id: string | null
          progress: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          enrolled_at?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          progress?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          enrolled_at?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          progress?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_categories: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_required: boolean
          name: string
          scope: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_required?: boolean
          name: string
          scope?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_required?: boolean
          name?: string
          scope?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      evidence_submissions: {
        Row: {
          beneficiary_id: string | null
          category_id: string
          created_at: string
          file_mime: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          note: string | null
          program_id: string | null
          project_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          submitter_name: string | null
          title: string
          updated_at: string
        }
        Insert: {
          beneficiary_id?: string | null
          category_id: string
          created_at?: string
          file_mime?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          note?: string | null
          program_id?: string | null
          project_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
          submitter_name?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          beneficiary_id?: string | null
          category_id?: string
          created_at?: string
          file_mime?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          note?: string | null
          program_id?: string | null
          project_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          submitter_name?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_submissions_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiary_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_submissions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "evidence_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_submissions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ia_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_modules: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          label_en: string
          label_ko: string
          module_key: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          label_en: string
          label_ko: string
          module_key: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          label_en?: string
          label_ko?: string
          module_key?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      hero_banners: {
        Row: {
          bg_color: string | null
          created_at: string
          cta_text: string | null
          cta_url: string | null
          ends_at: string | null
          id: string
          image_url: string
          is_active: boolean
          sort_order: number
          starts_at: string | null
          subtitle: string | null
          title: string
        }
        Insert: {
          bg_color?: string | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title: string
        }
        Update: {
          bg_color?: string | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      i18n_review_history: {
        Row: {
          content_type: string
          created_at: string
          from_status: string | null
          id: string
          item_id: string
          language_code: string
          note: string | null
          reviewer_id: string | null
          to_status: string
        }
        Insert: {
          content_type: string
          created_at?: string
          from_status?: string | null
          id?: string
          item_id: string
          language_code?: string
          note?: string | null
          reviewer_id?: string | null
          to_status: string
        }
        Update: {
          content_type?: string
          created_at?: string
          from_status?: string | null
          id?: string
          item_id?: string
          language_code?: string
          note?: string | null
          reviewer_id?: string | null
          to_status?: string
        }
        Relationships: []
      }
      ia_project_deliverables: {
        Row: {
          created_at: string
          description: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          milestone_id: string | null
          project_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string | null
          submitted_by_name: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          milestone_id?: string | null
          project_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          submitted_by_name?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          milestone_id?: string | null
          project_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          submitted_by_name?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_project_deliverables_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "ia_project_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_project_deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ia_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_project_members: {
        Row: {
          beneficiary_id: string | null
          created_at: string
          id: string
          joined_at: string | null
          member_email: string | null
          member_name: string
          note: string | null
          project_id: string
          role: string
          user_id: string | null
        }
        Insert: {
          beneficiary_id?: string | null
          created_at?: string
          id?: string
          joined_at?: string | null
          member_email?: string | null
          member_name: string
          note?: string | null
          project_id: string
          role?: string
          user_id?: string | null
        }
        Update: {
          beneficiary_id?: string | null
          created_at?: string
          id?: string
          joined_at?: string | null
          member_email?: string | null
          member_name?: string
          note?: string | null
          project_id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_project_members_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiary_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ia_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_project_milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          order_index: number
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ia_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_projects: {
        Row: {
          budget: number | null
          category: string | null
          cohort: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          lead_teacher_id: string | null
          lead_teacher_name: string | null
          manager_name: string | null
          partner_company: string | null
          partner_contact: string | null
          partner_email: string | null
          partner_phone: string | null
          progress: number
          starts_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          category?: string | null
          cohort?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          lead_teacher_id?: string | null
          lead_teacher_name?: string | null
          manager_name?: string | null
          partner_company?: string | null
          partner_contact?: string | null
          partner_email?: string | null
          partner_phone?: string | null
          progress?: number
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          category?: string | null
          cohort?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          lead_teacher_id?: string | null
          lead_teacher_name?: string | null
          manager_name?: string | null
          partner_company?: string | null
          partner_contact?: string | null
          partner_email?: string | null
          partner_phone?: string | null
          progress?: number
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      instructor_profiles: {
        Row: {
          bio: string | null
          created_at: string
          expertise: string[]
          headline: string | null
          photo_url: string | null
          public_email: string | null
          social: Json
          updated_at: string
          user_id: string
          website_url: string | null
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          expertise?: string[]
          headline?: string | null
          photo_url?: string | null
          public_email?: string | null
          social?: Json
          updated_at?: string
          user_id: string
          website_url?: string | null
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          expertise?: string[]
          headline?: string | null
          photo_url?: string | null
          public_email?: string | null
          social?: Json
          updated_at?: string
          user_id?: string
          website_url?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      learning_tracks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          description_en: string | null
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          sort_order: number
          target_branch_ids: string[]
          target_country_codes: string[]
          target_scope: string
          target_user_ids: string[]
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          sort_order?: number
          target_branch_ids?: string[]
          target_country_codes?: string[]
          target_scope?: string
          target_user_ids?: string[]
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          sort_order?: number
          target_branch_ids?: string[]
          target_country_codes?: string[]
          target_scope?: string
          target_user_ids?: string[]
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lesson_corrections: {
        Row: {
          content_id: string
          corrected_text: string
          created_at: string
          id: string
          input_mode: string
          issues: Json
          model: string | null
          overall_feedback: string | null
          reference_text: string | null
          score: number | null
          student_answer: string
          suggestions: Json
          user_id: string
        }
        Insert: {
          content_id: string
          corrected_text: string
          created_at?: string
          id?: string
          input_mode?: string
          issues?: Json
          model?: string | null
          overall_feedback?: string | null
          reference_text?: string | null
          score?: number | null
          student_answer: string
          suggestions?: Json
          user_id: string
        }
        Update: {
          content_id?: string
          corrected_text?: string
          created_at?: string
          id?: string
          input_mode?: string
          issues?: Json
          model?: string | null
          overall_feedback?: string | null
          reference_text?: string | null
          score?: number | null
          student_answer?: string
          suggestions?: Json
          user_id?: string
        }
        Relationships: []
      }
      lesson_notes: {
        Row: {
          content_id: string
          created_at: string
          id: string
          note: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          note?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          note?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "course_contents"
            referencedColumns: ["id"]
          },
        ]
      }
      nav_items: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          label_en: string | null
          open_in_new_tab: boolean
          position: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          label_en?: string | null
          open_in_new_tab?: boolean
          position?: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          label_en?: string | null
          open_in_new_tab?: boolean
          position?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      oauth_auth_codes: {
        Row: {
          client_id: string
          code: string
          code_challenge: string | null
          code_challenge_method: string | null
          created_at: string
          expires_at: string
          id: string
          member_code: string
          redirect_uri: string
          scopes: string[]
          tenant_domain: string
          used_at: string | null
        }
        Insert: {
          client_id: string
          code: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          created_at?: string
          expires_at: string
          id?: string
          member_code: string
          redirect_uri: string
          scopes: string[]
          tenant_domain?: string
          used_at?: string | null
        }
        Update: {
          client_id?: string
          code?: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          member_code?: string
          redirect_uri?: string
          scopes?: string[]
          tenant_domain?: string
          used_at?: string | null
        }
        Relationships: []
      }
      oauth_clients: {
        Row: {
          client_id: string
          client_secret_hash: string
          created_at: string
          created_by: string | null
          description: string | null
          grant_types: string[]
          id: string
          is_active: boolean
          name: string
          redirect_uris: string[]
          scopes: string[]
          tenant_domain: string
          updated_at: string
        }
        Insert: {
          client_id: string
          client_secret_hash: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          grant_types?: string[]
          id?: string
          is_active?: boolean
          name: string
          redirect_uris?: string[]
          scopes?: string[]
          tenant_domain?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_secret_hash?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          grant_types?: string[]
          id?: string
          is_active?: boolean
          name?: string
          redirect_uris?: string[]
          scopes?: string[]
          tenant_domain?: string
          updated_at?: string
        }
        Relationships: []
      }
      oauth_tenant_keys: {
        Row: {
          created_at: string
          jwt_secret: string
          rotated_at: string | null
          tenant_domain: string
        }
        Insert: {
          created_at?: string
          jwt_secret: string
          rotated_at?: string | null
          tenant_domain: string
        }
        Update: {
          created_at?: string
          jwt_secret?: string
          rotated_at?: string | null
          tenant_domain?: string
        }
        Relationships: []
      }
      oauth_tokens: {
        Row: {
          access_token: string
          client_id: string
          created_at: string
          expires_at: string
          grant_type: string
          id: string
          member_code: string | null
          refresh_expires_at: string | null
          refresh_token: string | null
          revoked_at: string | null
          scopes: string[]
          tenant_domain: string
          token_type: string
        }
        Insert: {
          access_token: string
          client_id: string
          created_at?: string
          expires_at: string
          grant_type: string
          id?: string
          member_code?: string | null
          refresh_expires_at?: string | null
          refresh_token?: string | null
          revoked_at?: string | null
          scopes: string[]
          tenant_domain?: string
          token_type?: string
        }
        Update: {
          access_token?: string
          client_id?: string
          created_at?: string
          expires_at?: string
          grant_type?: string
          id?: string
          member_code?: string | null
          refresh_expires_at?: string | null
          refresh_token?: string | null
          revoked_at?: string | null
          scopes?: string[]
          tenant_domain?: string
          token_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      one_time_login_tokens: {
        Row: {
          course_id: string | null
          created_at: string
          expires_at: string
          id: string
          invitation_id: string | null
          max_uses: number
          revoked_at: string | null
          token: string
          use_count: number
          used_at: string | null
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invitation_id?: string | null
          max_uses?: number
          revoked_at?: string | null
          token: string
          use_count?: number
          used_at?: string | null
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invitation_id?: string | null
          max_uses?: number
          revoked_at?: string | null
          token?: string
          use_count?: number
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_time_login_tokens_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "course_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_cert_templates: {
        Row: {
          accent_color: string
          body_template: string
          cert_type: string
          created_at: string
          id: string
          is_default: boolean
          issuer_name: string | null
          issuer_title: string | null
          name: string
          subtitle_en: string
          title: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          body_template?: string
          cert_type?: string
          created_at?: string
          id?: string
          is_default?: boolean
          issuer_name?: string | null
          issuer_title?: string | null
          name: string
          subtitle_en?: string
          title?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          body_template?: string
          cert_type?: string
          created_at?: string
          id?: string
          is_default?: boolean
          issuer_name?: string | null
          issuer_title?: string | null
          name?: string
          subtitle_en?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ops_certificates: {
        Row: {
          cert_number: string | null
          created_at: string
          id: string
          issued_at: string
          issued_by: string | null
          notes: string | null
          recipient_branch: string | null
          recipient_email: string | null
          recipient_name: string
          recipient_team: string | null
          recipient_user_id: string | null
          revoked_at: string | null
          revoked_reason: string | null
          source_id: string | null
          source_title: string
          source_type: string
          template_id: string | null
          verification_code: string
        }
        Insert: {
          cert_number?: string | null
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          notes?: string | null
          recipient_branch?: string | null
          recipient_email?: string | null
          recipient_name: string
          recipient_team?: string | null
          recipient_user_id?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          source_id?: string | null
          source_title: string
          source_type: string
          template_id?: string | null
          verification_code?: string
        }
        Update: {
          cert_number?: string | null
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          notes?: string | null
          recipient_branch?: string | null
          recipient_email?: string | null
          recipient_name?: string
          recipient_team?: string | null
          recipient_user_id?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          source_id?: string | null
          source_title?: string
          source_type?: string
          template_id?: string | null
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_certificates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ops_cert_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_survey_responses: {
        Row: {
          answers: Json
          created_at: string
          id: string
          nps_score: number | null
          respondent_id: string | null
          survey_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          nps_score?: number | null
          respondent_id?: string | null
          survey_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          nps_score?: number | null
          respondent_id?: string | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "ops_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_surveys: {
        Row: {
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_anonymous: boolean
          opens_at: string | null
          phase: string
          questions: Json
          target_id: string | null
          target_type: string
          title: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_anonymous?: boolean
          opens_at?: string | null
          phase?: string
          questions?: Json
          target_id?: string | null
          target_type: string
          title: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_anonymous?: boolean
          opens_at?: string | null
          phase?: string
          questions?: Json
          target_id?: string | null
          target_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          course_id: string
          created_at: string
          id: string
          order_id: string
          price_at_purchase: number
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          order_id: string
          price_at_purchase: number
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          order_id?: string
          price_at_purchase?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          bank_code: string | null
          bank_name: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          card_approve_no: string | null
          card_company: string | null
          card_installment_months: number | null
          card_is_interest_free: boolean | null
          card_number: string | null
          card_owner_type: string | null
          card_type: string | null
          coupon_id: string | null
          created_at: string
          discount_amount: number
          easy_pay_discount_amount: number | null
          easy_pay_provider: string | null
          final_amount: number
          id: string
          mobile_carrier: string | null
          order_number: string
          paid_at: string | null
          payment_method: string | null
          receipt_url: string | null
          status: string
          toss_approved_at: string | null
          toss_order_id: string | null
          toss_payment_key: string | null
          total_amount: number
          user_id: string
          vat: number | null
        }
        Insert: {
          bank_code?: string | null
          bank_name?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          card_approve_no?: string | null
          card_company?: string | null
          card_installment_months?: number | null
          card_is_interest_free?: boolean | null
          card_number?: string | null
          card_owner_type?: string | null
          card_type?: string | null
          coupon_id?: string | null
          created_at?: string
          discount_amount?: number
          easy_pay_discount_amount?: number | null
          easy_pay_provider?: string | null
          final_amount?: number
          id?: string
          mobile_carrier?: string | null
          order_number: string
          paid_at?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          status?: string
          toss_approved_at?: string | null
          toss_order_id?: string | null
          toss_payment_key?: string | null
          total_amount?: number
          user_id: string
          vat?: number | null
        }
        Update: {
          bank_code?: string | null
          bank_name?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          card_approve_no?: string | null
          card_company?: string | null
          card_installment_months?: number | null
          card_is_interest_free?: boolean | null
          card_number?: string | null
          card_owner_type?: string | null
          card_type?: string | null
          coupon_id?: string | null
          created_at?: string
          discount_amount?: number
          easy_pay_discount_amount?: number | null
          easy_pay_provider?: string | null
          final_amount?: number
          id?: string
          mobile_carrier?: string | null
          order_number?: string
          paid_at?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          status?: string
          toss_approved_at?: string | null
          toss_order_id?: string | null
          toss_payment_key?: string | null
          total_amount?: number
          user_id?: string
          vat?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      point_history: {
        Row: {
          action_type: string
          created_at: string | null
          description: string | null
          id: string
          points: number
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          points: number
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          points?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          department: string | null
          department_id: string | null
          email: string | null
          employee_id: string | null
          full_name: string | null
          phone_number: string | null
          position: string | null
          team_name: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          department_id?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          phone_number?: string | null
          position?: string | null
          team_name?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          department_id?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          phone_number?: string | null
          position?: string | null
          team_name?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      program_applications: {
        Row: {
          answers: Json
          applicant_email: string | null
          applicant_name: string
          applicant_phone: string | null
          applicant_user_id: string | null
          beneficiary_id: string | null
          created_at: string
          id: string
          program_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          applicant_email?: string | null
          applicant_name: string
          applicant_phone?: string | null
          applicant_user_id?: string | null
          beneficiary_id?: string | null
          created_at?: string
          id?: string
          program_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          applicant_email?: string | null
          applicant_name?: string
          applicant_phone?: string | null
          applicant_user_id?: string | null
          beneficiary_id?: string | null
          created_at?: string
          id?: string
          program_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_applications_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiary_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_applications_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_attendance: {
        Row: {
          application_id: string
          checked_by: string | null
          checked_in_at: string | null
          created_at: string
          id: string
          note: string | null
          program_id: string
          session_date: string
          session_label: string
          status: string
          updated_at: string
        }
        Insert: {
          application_id: string
          checked_by?: string | null
          checked_in_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          program_id: string
          session_date: string
          session_label?: string
          status?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          checked_by?: string | null
          checked_in_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          program_id?: string
          session_date?: string
          session_label?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_attendance_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "program_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_attendance_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          apply_ends_at: string | null
          apply_starts_at: string | null
          budget: number | null
          capacity: number | null
          category: string | null
          contact: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          form_schema: Json
          id: string
          is_public: boolean
          location: string | null
          manager_name: string | null
          starts_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          apply_ends_at?: string | null
          apply_starts_at?: string | null
          budget?: number | null
          capacity?: number | null
          category?: string | null
          contact?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          form_schema?: Json
          id?: string
          is_public?: boolean
          location?: string | null
          manager_name?: string | null
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          apply_ends_at?: string | null
          apply_starts_at?: string | null
          budget?: number | null
          capacity?: number | null
          category?: string | null
          contact?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          form_schema?: Json
          id?: string
          is_public?: boolean
          location?: string | null
          manager_name?: string | null
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_bank: {
        Row: {
          category_id: string | null
          correct_answer: string
          course_id: string | null
          created_at: string
          created_by: string | null
          difficulty: Database["public"]["Enums"]["question_difficulty"]
          explanation: string | null
          hint: string | null
          id: string
          is_active: boolean
          learner_level: Database["public"]["Enums"]["learner_level"]
          options: Json | null
          points: number
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          tags: string[]
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          correct_answer: string
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          explanation?: string | null
          hint?: string | null
          id?: string
          is_active?: boolean
          learner_level?: Database["public"]["Enums"]["learner_level"]
          options?: Json | null
          points?: number
          question_text: string
          question_type?: Database["public"]["Enums"]["question_type"]
          tags?: string[]
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          correct_answer?: string
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          explanation?: string | null
          hint?: string | null
          id?: string
          is_active?: boolean
          learner_level?: Database["public"]["Enums"]["learner_level"]
          options?: Json | null
          points?: number
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "question_bank_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          name_en: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          name_en?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          name_en?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          content: string | null
          course_id: string
          created_at: string
          id: string
          is_published: boolean
          rating: number
          user_id: string
        }
        Insert: {
          content?: string | null
          course_id: string
          created_at?: string
          id?: string
          is_published?: boolean
          rating: number
          user_id: string
        }
        Update: {
          content?: string | null
          course_id?: string
          created_at?: string
          id?: string
          is_published?: boolean
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          b2c_enabled: boolean
          blog_url: string | null
          business_number: string | null
          ceo_name: string | null
          company_address: string | null
          company_email: string | null
          company_name: string | null
          company_name_en: string | null
          company_phone: string | null
          content_protection_enabled: boolean
          copyright_text: string | null
          created_at: string
          default_language: string | null
          facebook_url: string | null
          footer_description: string | null
          footer_logo_url: string | null
          header_logo_url: string | null
          hidden_nav_keys: string[]
          hours_holiday: string | null
          hours_lunch: string | null
          hours_weekday: string | null
          hours_weekend: string | null
          id: string
          instagram_url: string | null
          min_password_length: number | null
          notify_assignment_submit: boolean | null
          notify_completion: boolean | null
          notify_new_signup: boolean | null
          platform_name: string | null
          privacy_policy: string | null
          pwa_app_name: string | null
          pwa_apple_icon_url: string | null
          pwa_background_color: string | null
          pwa_icon_192_url: string | null
          pwa_icon_512_url: string | null
          pwa_short_name: string | null
          pwa_theme_color: string | null
          session_expiry_hours: number | null
          sidebar_logo_url: string | null
          teacher_role_enabled: boolean
          timezone: string | null
          two_factor_auth: boolean | null
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          b2c_enabled?: boolean
          blog_url?: string | null
          business_number?: string | null
          ceo_name?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_name_en?: string | null
          company_phone?: string | null
          content_protection_enabled?: boolean
          copyright_text?: string | null
          created_at?: string
          default_language?: string | null
          facebook_url?: string | null
          footer_description?: string | null
          footer_logo_url?: string | null
          header_logo_url?: string | null
          hidden_nav_keys?: string[]
          hours_holiday?: string | null
          hours_lunch?: string | null
          hours_weekday?: string | null
          hours_weekend?: string | null
          id?: string
          instagram_url?: string | null
          min_password_length?: number | null
          notify_assignment_submit?: boolean | null
          notify_completion?: boolean | null
          notify_new_signup?: boolean | null
          platform_name?: string | null
          privacy_policy?: string | null
          pwa_app_name?: string | null
          pwa_apple_icon_url?: string | null
          pwa_background_color?: string | null
          pwa_icon_192_url?: string | null
          pwa_icon_512_url?: string | null
          pwa_short_name?: string | null
          pwa_theme_color?: string | null
          session_expiry_hours?: number | null
          sidebar_logo_url?: string | null
          teacher_role_enabled?: boolean
          timezone?: string | null
          two_factor_auth?: boolean | null
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          b2c_enabled?: boolean
          blog_url?: string | null
          business_number?: string | null
          ceo_name?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_name_en?: string | null
          company_phone?: string | null
          content_protection_enabled?: boolean
          copyright_text?: string | null
          created_at?: string
          default_language?: string | null
          facebook_url?: string | null
          footer_description?: string | null
          footer_logo_url?: string | null
          header_logo_url?: string | null
          hidden_nav_keys?: string[]
          hours_holiday?: string | null
          hours_lunch?: string | null
          hours_weekday?: string | null
          hours_weekend?: string | null
          id?: string
          instagram_url?: string | null
          min_password_length?: number | null
          notify_assignment_submit?: boolean | null
          notify_completion?: boolean | null
          notify_new_signup?: boolean | null
          platform_name?: string | null
          privacy_policy?: string | null
          pwa_app_name?: string | null
          pwa_apple_icon_url?: string | null
          pwa_background_color?: string | null
          pwa_icon_192_url?: string | null
          pwa_icon_512_url?: string | null
          pwa_short_name?: string | null
          pwa_theme_color?: string | null
          session_expiry_hours?: number | null
          sidebar_logo_url?: string | null
          teacher_role_enabled?: boolean
          timezone?: string | null
          two_factor_auth?: boolean | null
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          invitation_id: string | null
          message: string
          provider: string
          provider_message_id: string | null
          request_payload: Json | null
          response: Json | null
          sent_at: string | null
          status: string
          to_phone: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          invitation_id?: string | null
          message: string
          provider?: string
          provider_message_id?: string | null
          request_payload?: Json | null
          response?: Json | null
          sent_at?: string | null
          status?: string
          to_phone: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          invitation_id?: string | null
          message?: string
          provider?: string
          provider_message_id?: string | null
          request_payload?: Json | null
          response?: Json | null
          sent_at?: string | null
          status?: string
          to_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "course_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          body_template: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          label: string
          template_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_template: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          label: string
          template_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_template?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          label?: string
          template_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      survey_answers: {
        Row: {
          answer_text: string | null
          answer_value: number | null
          created_at: string
          id: string
          question_id: string
          response_id: string
        }
        Insert: {
          answer_text?: string | null
          answer_value?: number | null
          created_at?: string
          id?: string
          question_id: string
          response_id: string
        }
        Update: {
          answer_text?: string | null
          answer_value?: number | null
          created_at?: string
          id?: string
          question_id?: string
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          options: Json | null
          order_index: number
          question_text: string
          question_type: Database["public"]["Enums"]["survey_question_type"]
          survey_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          order_index?: number
          question_text: string
          question_type?: Database["public"]["Enums"]["survey_question_type"]
          survey_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: Database["public"]["Enums"]["survey_question_type"]
          survey_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          survey_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          survey_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          survey_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          domain: string | null
          id: string
          is_active: boolean | null
          monthly_storage_limit_gb: number | null
          monthly_traffic_limit_gb: number | null
          name: string
          notes: string | null
          plan: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean | null
          monthly_storage_limit_gb?: number | null
          monthly_traffic_limit_gb?: number | null
          name: string
          notes?: string | null
          plan?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean | null
          monthly_storage_limit_gb?: number | null
          monthly_traffic_limit_gb?: number | null
          name?: string
          notes?: string | null
          plan?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      track_step_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          is_required: boolean
          sort_order: number
          step_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          is_required?: boolean
          sort_order?: number
          step_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          is_required?: boolean
          sort_order?: number
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_step_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_step_courses_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "track_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      track_steps: {
        Row: {
          badge_color: string | null
          created_at: string
          description: string | null
          description_en: string | null
          id: string
          level_order: number
          name: string
          name_en: string | null
          require_assessment_pass: boolean
          track_id: string
          unlock_previous_required: boolean
          updated_at: string
        }
        Insert: {
          badge_color?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          id?: string
          level_order?: number
          name: string
          name_en?: string | null
          require_assessment_pass?: boolean
          track_id: string
          unlock_previous_required?: boolean
          updated_at?: string
        }
        Update: {
          badge_color?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          id?: string
          level_order?: number
          name?: string
          name_en?: string | null
          require_assessment_pass?: boolean
          track_id?: string
          unlock_previous_required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_steps_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "learning_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      traffic_logs: {
        Row: {
          content_id: string | null
          course_id: string | null
          created_at: string
          estimated_bytes: number | null
          event_type: string
          id: string
          metadata: Json | null
          page_path: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          content_id?: string | null
          course_id?: string | null
          created_at?: string
          estimated_bytes?: number | null
          event_type: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          content_id?: string | null
          course_id?: string | null
          created_at?: string
          estimated_bytes?: number | null
          event_type?: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traffic_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_glossary: {
        Row: {
          created_at: string
          en_term: string
          id: string
          is_active: boolean
          ko_term: string
          notes: string | null
          scope: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          en_term: string
          id?: string
          is_active?: boolean
          ko_term: string
          notes?: string | null
          scope?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          en_term?: string
          id?: string
          is_active?: boolean
          ko_term?: string
          notes?: string | null
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_department_roles: {
        Row: {
          created_at: string | null
          department_id: string
          dept_role: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          department_id: string
          dept_role: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          department_id?: string
          dept_role?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_department_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_gamification: {
        Row: {
          created_at: string | null
          experience_points: number | null
          id: string
          last_activity_date: string | null
          level: number | null
          streak_days: number | null
          total_points: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          experience_points?: number | null
          id?: string
          last_activity_date?: string | null
          level?: number | null
          streak_days?: number | null
          total_points?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          experience_points?: number | null
          id?: string
          last_activity_date?: string | null
          level?: number | null
          streak_days?: number | null
          total_points?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          id: string
          login_at: string
          logout_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          login_at?: string
          logout_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          login_at?: string
          logout_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_track_progress: {
        Row: {
          completed_at: string | null
          completed_step_ids: string[]
          created_at: string
          current_step_id: string | null
          id: string
          last_accessed_at: string
          started_at: string
          track_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_step_ids?: string[]
          created_at?: string
          current_step_id?: string | null
          id?: string
          last_accessed_at?: string
          started_at?: string
          track_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_step_ids?: string[]
          created_at?: string
          current_step_id?: string | null
          id?: string
          last_accessed_at?: string
          started_at?: string
          track_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_track_progress_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "track_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_track_progress_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "learning_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      video_assets: {
        Row: {
          bunny_video_guid: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          file_size_mb: number | null
          id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          uploaded_by: string
          video_provider: string
          video_url: string
        }
        Insert: {
          bunny_video_guid?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          file_size_mb?: number | null
          id?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          uploaded_by: string
          video_provider?: string
          video_url: string
        }
        Update: {
          bunny_video_guid?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          file_size_mb?: number | null
          id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string
          video_provider?: string
          video_url?: string
        }
        Relationships: []
      }
      video_session_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_session_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "video_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_session_participants: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          left_at: string | null
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          role?: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "video_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_sessions: {
        Row: {
          course_id: string | null
          created_at: string
          daily_room_name: string | null
          daily_room_url: string | null
          description: string | null
          host_user_id: string
          id: string
          max_participants: number
          recording_enabled: boolean
          scheduled_end: string
          scheduled_start: string
          session_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          daily_room_name?: string | null
          daily_room_url?: string | null
          description?: string | null
          host_user_id: string
          id?: string
          max_participants?: number
          recording_enabled?: boolean
          scheduled_end: string
          scheduled_start: string
          session_type?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          daily_room_name?: string | null
          daily_room_url?: string | null
          description?: string | null
          host_user_id?: string
          id?: string
          max_participants?: number
          recording_enabled?: boolean
          scheduled_end?: string
          scheduled_start?: string
          session_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          added_at: string
          course_id: string
          id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          course_id: string
          id?: string
          user_id: string
        }
        Update: {
          added_at?: string
          course_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_simple_i18n: {
        Args: {
          p_description_en?: string
          p_item_id: string
          p_kind: string
          p_name_en: string
        }
        Returns: undefined
      }
      award_community_badge: {
        Args: { _badge_code: string; _user_id: string }
        Returns: undefined
      }
      award_points: {
        Args: {
          p_action_type: string
          p_description?: string
          p_points: number
          p_user_id: string
        }
        Returns: undefined
      }
      can_manage_correction_assignment: {
        Args: { _assignment_id: string }
        Returns: boolean
      }
      check_and_award_badges: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      cleanup_expired_oauth_tokens: { Args: never; Returns: number }
      community_aggregate_daily_rankings: {
        Args: { target_date?: string }
        Returns: number
      }
      confirm_payment_and_enroll: {
        Args: {
          p_order_id: string
          p_toss_order_id: string
          p_toss_payment_key: string
        }
        Returns: undefined
      }
      detect_i18n_drift: { Args: never; Returns: Json }
      export_i18n_rows: {
        Args: { p_content_type: string }
        Returns: {
          en_body: string
          en_title: string
          item_id: string
          ko_body: string
          ko_title: string
          status: string
          updated_at: string
        }[]
      }
      generate_order_number: { Args: never; Returns: string }
      get_assessment_pool_questions_for_student: {
        Args: { p_assessment_id: string }
        Returns: {
          difficulty: Database["public"]["Enums"]["question_difficulty"]
          hint: string
          id: string
          learner_level: Database["public"]["Enums"]["learner_level"]
          options: Json
          order_index: number
          points: number
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
        }[]
      }
      get_assessment_pool_questions_with_answers: {
        Args: { p_assessment_id: string; p_question_ids: string[] }
        Returns: {
          correct_answer: string
          difficulty: Database["public"]["Enums"]["question_difficulty"]
          explanation: string
          hint: string
          id: string
          learner_level: Database["public"]["Enums"]["learner_level"]
          options: Json
          points: number
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
        }[]
      }
      get_assessment_question_i18n_for_student: {
        Args: { p_assessment_id: string; p_language_code: string }
        Returns: {
          hint: string
          language_code: string
          options: Json
          question_id: string
          question_text: string
        }[]
      }
      get_assessment_questions_for_student: {
        Args: { p_assessment_id: string }
        Returns: {
          assessment_id: string
          hint: string
          id: string
          options: Json
          order_index: number
          points: number
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
        }[]
      }
      get_assessment_questions_with_answers: {
        Args: { p_assessment_id: string }
        Returns: {
          assessment_id: string
          correct_answer: string
          explanation: string
          hint: string
          id: string
          options: Json
          order_index: number
          points: number
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
        }[]
      }
      get_i18n_dashboard_stats: {
        Args: never
        Returns: {
          content_type: string
          en_missing: number
          ko_only: number
          reviewed: number
          sync_required: number
          total: number
        }[]
      }
      get_i18n_missing_items: {
        Args: { p_content_type: string; p_filter?: string }
        Returns: {
          en_title: string
          item_id: string
          ko_content: string
          ko_title: string
          status: string
          updated_at: string
        }[]
      }
      get_i18n_pending_ids: {
        Args: { p_content_type: string; p_limit?: number }
        Returns: {
          item_id: string
        }[]
      }
      get_i18n_preview: {
        Args: { p_content_type: string; p_item_id: string }
        Returns: Json
      }
      get_simple_i18n_missing: {
        Args: { p_filter?: string; p_kind: string }
        Returns: {
          en_description: string
          en_name: string
          item_id: string
          ko_description: string
          ko_name: string
        }[]
      }
      get_user_branch_admin_branches: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_branch_id: { Args: { _user_id: string }; Returns: string }
      has_branch_capability: {
        Args: { _branch_id: string; _capability: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_i18n_rows: {
        Args: { p_content_type: string; p_rows: Json }
        Returns: Json
      }
      increment_article_view: {
        Args: { p_article_id: string }
        Returns: undefined
      }
      is_branch_admin_of: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      is_correction_assignment_target: {
        Args: { _assignment_id: string }
        Returns: boolean
      }
      is_video_session_host: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      is_video_session_participant: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      publish_scheduled_articles: { Args: never; Returns: number }
      recommend_articles: {
        Args: { p_article_id: string; p_limit?: number }
        Returns: {
          category_name: string
          id: string
          publish_at: string
          similarity_score: number
          summary: string
          thumbnail_url: string
          title: string
        }[]
      }
      save_i18n_translation: {
        Args: {
          p_content_type: string
          p_en_body: string
          p_en_title: string
          p_item_id: string
          p_mark_reviewed?: boolean
        }
        Returns: Json
      }
      search_articles: {
        Args: {
          p_category_id?: string
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_tag?: string
        }
        Returns: {
          category_id: string
          category_name: string
          id: string
          publish_at: string
          rank: number
          slug: string
          summary: string
          tags: string[]
          thumbnail_url: string
          title: string
          total_count: number
          view_count: number
        }[]
      }
      seed_global_demo_data: { Args: never; Returns: string }
      set_i18n_status: {
        Args: {
          p_content_type: string
          p_item_ids: string[]
          p_note?: string
          p_to_status: string
        }
        Returns: Json
      }
      submit_and_grade_assessment: {
        Args: { p_answers: Json; p_attempt_id: string }
        Returns: Json
      }
      update_streak: { Args: { p_user_id: string }; Returns: undefined }
      user_has_any_branch_capability: {
        Args: { _capability: string; _user_id: string }
        Returns: boolean
      }
      verify_ops_certificate: {
        Args: { _code: string }
        Returns: {
          cert_number: string
          is_revoked: boolean
          issued_at: string
          recipient_name: string
          source_title: string
          source_type: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "student" | "super_admin" | "branch_admin"
      article_status: "draft" | "scheduled" | "published" | "archived"
      assessment_selection_mode: "fixed" | "random_pool"
      assignment_status: "draft" | "published" | "closed"
      attendance_status: "present" | "absent" | "late" | "excused"
      content_type: "video" | "document" | "quiz" | "assignment" | "live"
      correction_status: "pending" | "in_progress" | "completed" | "returned"
      enrollment_status: "pending" | "approved" | "rejected"
      learner_level: "beginner" | "intermediate" | "advanced"
      question_difficulty: "easy" | "medium" | "hard"
      question_type:
        | "multiple_choice_4"
        | "multiple_choice_5"
        | "short_answer"
        | "essay"
        | "ox"
      submission_status: "submitted" | "graded" | "returned"
      survey_question_type: "multiple_choice" | "text" | "rating"
      video_provider:
        | "youtube"
        | "vimeo"
        | "custom"
        | "upload"
        | "bunny"
        | "cloudflare"
        | "kollus"
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
      app_role: ["admin", "teacher", "student", "super_admin", "branch_admin"],
      article_status: ["draft", "scheduled", "published", "archived"],
      assessment_selection_mode: ["fixed", "random_pool"],
      assignment_status: ["draft", "published", "closed"],
      attendance_status: ["present", "absent", "late", "excused"],
      content_type: ["video", "document", "quiz", "assignment", "live"],
      correction_status: ["pending", "in_progress", "completed", "returned"],
      enrollment_status: ["pending", "approved", "rejected"],
      learner_level: ["beginner", "intermediate", "advanced"],
      question_difficulty: ["easy", "medium", "hard"],
      question_type: [
        "multiple_choice_4",
        "multiple_choice_5",
        "short_answer",
        "essay",
        "ox",
      ],
      submission_status: ["submitted", "graded", "returned"],
      survey_question_type: ["multiple_choice", "text", "rating"],
      video_provider: [
        "youtube",
        "vimeo",
        "custom",
        "upload",
        "bunny",
        "cloudflare",
        "kollus",
      ],
    },
  },
} as const
