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
		PostgrestVersion: '14.18'
	}
	graphql_public: {
		Tables: {
			[_ in never]: never
		}
		Views: {
			[_ in never]: never
		}
		Functions: {
			graphql: {
				Args: {
					extensions?: Json
					operationName?: string
					query?: string
					variables?: Json
				}
				Returns: Json
			}
		}
		Enums: {
			[_ in never]: never
		}
		CompositeTypes: {
			[_ in never]: never
		}
	}
	public: {
		Tables: {
			admin_account: {
				Row: {
					singleton: boolean
					user_id: string
				}
				Insert: {
					singleton?: boolean
					user_id: string
				}
				Update: {
					singleton?: boolean
					user_id?: string
				}
				Relationships: []
			}
			beta_announcements: {
				Row: {
					body: string
					created_at: string
					id: string
					pinned: boolean
					published_at: string | null
					round_id: string
					title: string
				}
				Insert: {
					body?: string
					created_at?: string
					id?: string
					pinned?: boolean
					published_at?: string | null
					round_id: string
					title: string
				}
				Update: {
					body?: string
					created_at?: string
					id?: string
					pinned?: boolean
					published_at?: string | null
					round_id?: string
					title?: string
				}
				Relationships: [
					{
						foreignKeyName: 'beta_announcements_round_id_fkey'
						columns: ['round_id']
						isOneToOne: false
						referencedRelation: 'beta_rounds'
						referencedColumns: ['id']
					},
				]
			}
			beta_invites: {
				Row: {
					created_at: string
					email: string
					id: string
					name: string
					redeemed_at: string | null
					redeemed_by: string | null
					round_id: string
					token_hash: string
				}
				Insert: {
					created_at?: string
					email: string
					id?: string
					name: string
					redeemed_at?: string | null
					redeemed_by?: string | null
					round_id: string
					token_hash: string
				}
				Update: {
					created_at?: string
					email?: string
					id?: string
					name?: string
					redeemed_at?: string | null
					redeemed_by?: string | null
					round_id?: string
					token_hash?: string
				}
				Relationships: [
					{
						foreignKeyName: 'beta_invites_round_id_fkey'
						columns: ['round_id']
						isOneToOne: false
						referencedRelation: 'beta_rounds'
						referencedColumns: ['id']
					},
				]
			}
			beta_report_admin: {
				Row: {
					github_url: string | null
					internal_note: string | null
					report_id: string
				}
				Insert: {
					github_url?: string | null
					internal_note?: string | null
					report_id: string
				}
				Update: {
					github_url?: string | null
					internal_note?: string | null
					report_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'beta_report_admin_report_id_fkey'
						columns: ['report_id']
						isOneToOne: true
						referencedRelation: 'beta_reports'
						referencedColumns: ['id']
					},
				]
			}
			beta_report_images: {
				Row: {
					path: string
					report_id: string
				}
				Insert: {
					path: string
					report_id: string
				}
				Update: {
					path?: string
					report_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'beta_report_images_report_id_fkey'
						columns: ['report_id']
						isOneToOne: false
						referencedRelation: 'beta_reports'
						referencedColumns: ['id']
					},
				]
			}
			beta_reports: {
				Row: {
					admin_note: string | null
					attempted: string | null
					created_at: string
					details: string | null
					device: Json
					expected: string | null
					feature: string | null
					happened: string | null
					id: string
					kind: string
					round_id: string
					status: string
					user_id: string
				}
				Insert: {
					admin_note?: string | null
					attempted?: string | null
					created_at?: string
					details?: string | null
					device?: Json
					expected?: string | null
					feature?: string | null
					happened?: string | null
					id: string
					kind: string
					round_id: string
					status?: string
					user_id: string
				}
				Update: {
					admin_note?: string | null
					attempted?: string | null
					created_at?: string
					details?: string | null
					device?: Json
					expected?: string | null
					feature?: string | null
					happened?: string | null
					id?: string
					kind?: string
					round_id?: string
					status?: string
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'beta_reports_round_id_fkey'
						columns: ['round_id']
						isOneToOne: false
						referencedRelation: 'beta_rounds'
						referencedColumns: ['id']
					},
				]
			}
			beta_rounds: {
				Row: {
					created_at: string
					ends_at: string
					id: string
					instructions: string
					name: string
					starts_at: string
					survey_version: number
					welcome: string
				}
				Insert: {
					created_at?: string
					ends_at: string
					id?: string
					instructions?: string
					name: string
					starts_at: string
					survey_version?: number
					welcome?: string
				}
				Update: {
					created_at?: string
					ends_at?: string
					id?: string
					instructions?: string
					name?: string
					starts_at?: string
					survey_version?: number
					welcome?: string
				}
				Relationships: []
			}
			beta_settings: {
				Row: {
					singleton: boolean
					site_url: string
				}
				Insert: {
					singleton?: boolean
					site_url: string
				}
				Update: {
					singleton?: boolean
					site_url?: string
				}
				Relationships: []
			}
			beta_surveys: {
				Row: {
					answers: Json
					round_id: string
					submitted_at: string
					survey_version: number
					user_id: string
				}
				Insert: {
					answers: Json
					round_id: string
					submitted_at?: string
					survey_version: number
					user_id: string
				}
				Update: {
					answers?: Json
					round_id?: string
					submitted_at?: string
					survey_version?: number
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'beta_surveys_round_id_fkey'
						columns: ['round_id']
						isOneToOne: false
						referencedRelation: 'beta_rounds'
						referencedColumns: ['id']
					},
				]
			}
			beta_testers: {
				Row: {
					granted_at: string
					invite_id: string | null
					revoked_at: string | null
					round_id: string
					user_id: string
				}
				Insert: {
					granted_at?: string
					invite_id?: string | null
					revoked_at?: string | null
					round_id: string
					user_id: string
				}
				Update: {
					granted_at?: string
					invite_id?: string | null
					revoked_at?: string | null
					round_id?: string
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'beta_testers_invite_id_fkey'
						columns: ['invite_id']
						isOneToOne: false
						referencedRelation: 'beta_invites'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'beta_testers_round_id_fkey'
						columns: ['round_id']
						isOneToOne: false
						referencedRelation: 'beta_rounds'
						referencedColumns: ['id']
					},
				]
			}
			daily_play_sessions: {
				Row: {
					closed_at: string | null
					daily_id: string
					id: string
					opened_at: string
					user_id: string
				}
				Insert: {
					closed_at?: string | null
					daily_id: string
					id?: string
					opened_at?: string
					user_id: string
				}
				Update: {
					closed_at?: string | null
					daily_id?: string
					id?: string
					opened_at?: string
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'daily_play_sessions_daily_id_fkey'
						columns: ['daily_id']
						isOneToOne: false
						referencedRelation: 'daily_puzzles'
						referencedColumns: ['id']
					},
				]
			}
			daily_puzzles: {
				Row: {
					expires_at: string
					id: string
					puzzle_id: string
					release_at: string
				}
				Insert: {
					expires_at: string
					id?: string
					puzzle_id: string
					release_at: string
				}
				Update: {
					expires_at?: string
					id?: string
					puzzle_id?: string
					release_at?: string
				}
				Relationships: [
					{
						foreignKeyName: 'daily_puzzles_puzzle_id_fkey'
						columns: ['puzzle_id']
						isOneToOne: true
						referencedRelation: 'puzzles'
						referencedColumns: ['id']
					},
				]
			}
			daily_schedule: {
				Row: {
					rollover_time_utc: string
					singleton: boolean
				}
				Insert: {
					rollover_time_utc: string
					singleton?: boolean
				}
				Update: {
					rollover_time_utc?: string
					singleton?: boolean
				}
				Relationships: []
			}
			feature_grants: {
				Row: {
					feature: string
					granted_at: string
					source: string
					user_id: string
				}
				Insert: {
					feature: string
					granted_at?: string
					source: string
					user_id: string
				}
				Update: {
					feature?: string
					granted_at?: string
					source?: string
					user_id?: string
				}
				Relationships: []
			}
			group_completions: {
				Row: {
					completed_at: string
					group_id: string
					user_id: string
				}
				Insert: {
					completed_at?: string
					group_id: string
					user_id: string
				}
				Update: {
					completed_at?: string
					group_id?: string
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'group_completions_group_id_fkey'
						columns: ['group_id']
						isOneToOne: false
						referencedRelation: 'puzzle_groups'
						referencedColumns: ['id']
					},
				]
			}
			palette_corrections: {
				Row: {
					changed_at: string
					changed_by: string | null
					id: number
					new_colors: string[]
					old_colors: string[]
					palette_id: string
					revision: number
				}
				Insert: {
					changed_at?: string
					changed_by?: string | null
					id?: never
					new_colors: string[]
					old_colors: string[]
					palette_id: string
					revision: number
				}
				Update: {
					changed_at?: string
					changed_by?: string | null
					id?: never
					new_colors?: string[]
					old_colors?: string[]
					palette_id?: string
					revision?: number
				}
				Relationships: [
					{
						foreignKeyName: 'palette_corrections_palette_id_fkey'
						columns: ['palette_id']
						isOneToOne: false
						referencedRelation: 'palettes'
						referencedColumns: ['id']
					},
				]
			}
			palette_grants: {
				Row: {
					granted_at: string
					id: string
					palette_id: string
					reward_rule_id: string | null
					source: string
					user_id: string
				}
				Insert: {
					granted_at?: string
					id?: string
					palette_id: string
					reward_rule_id?: string | null
					source: string
					user_id: string
				}
				Update: {
					granted_at?: string
					id?: string
					palette_id?: string
					reward_rule_id?: string | null
					source?: string
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'palette_grants_palette_id_fkey'
						columns: ['palette_id']
						isOneToOne: false
						referencedRelation: 'palettes'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'palette_grants_reward_rule_id_fkey'
						columns: ['reward_rule_id']
						isOneToOne: false
						referencedRelation: 'reward_rules'
						referencedColumns: ['id']
					},
				]
			}
			palette_group_members: {
				Row: {
					group_id: string
					palette_id: string
					position: number
				}
				Insert: {
					group_id: string
					palette_id: string
					position: number
				}
				Update: {
					group_id?: string
					palette_id?: string
					position?: number
				}
				Relationships: [
					{
						foreignKeyName: 'palette_group_members_group_id_fkey'
						columns: ['group_id']
						isOneToOne: false
						referencedRelation: 'palette_groups'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'palette_group_members_palette_id_fkey'
						columns: ['palette_id']
						isOneToOne: true
						referencedRelation: 'palettes'
						referencedColumns: ['id']
					},
				]
			}
			palette_groups: {
				Row: {
					id: string
					name: string
					published_at: string | null
					purpose: string
					release_at: string | null
				}
				Insert: {
					id?: string
					name: string
					published_at?: string | null
					purpose: string
					release_at?: string | null
				}
				Update: {
					id?: string
					name?: string
					published_at?: string | null
					purpose?: string
					release_at?: string | null
				}
				Relationships: []
			}
			palettes: {
				Row: {
					colors: string[]
					id: string
					name: string
					published_at: string | null
					release_at: string | null
					revision: number
				}
				Insert: {
					colors: string[]
					id: string
					name: string
					published_at?: string | null
					release_at?: string | null
					revision?: number
				}
				Update: {
					colors?: string[]
					id?: string
					name?: string
					published_at?: string | null
					release_at?: string | null
					revision?: number
				}
				Relationships: []
			}
			profiles: {
				Row: {
					created_at: string
					user_id: string
					username: string | null
				}
				Insert: {
					created_at?: string
					user_id: string
					username?: string | null
				}
				Update: {
					created_at?: string
					user_id?: string
					username?: string | null
				}
				Relationships: []
			}
			puzzle_attempts: {
				Row: {
					placements: Json
					puzzle_id: string
					revision: number
					updated_at: string
					user_id: string
				}
				Insert: {
					placements?: Json
					puzzle_id: string
					revision?: number
					updated_at?: string
					user_id: string
				}
				Update: {
					placements?: Json
					puzzle_id?: string
					revision?: number
					updated_at?: string
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'puzzle_attempts_puzzle_id_fkey'
						columns: ['puzzle_id']
						isOneToOne: false
						referencedRelation: 'puzzles'
						referencedColumns: ['id']
					},
				]
			}
			puzzle_authoring: {
				Row: {
					generator_version: string
					known_solution: Json
					puzzle_id: string
					seed: string
				}
				Insert: {
					generator_version: string
					known_solution: Json
					puzzle_id: string
					seed: string
				}
				Update: {
					generator_version?: string
					known_solution?: Json
					puzzle_id?: string
					seed?: string
				}
				Relationships: [
					{
						foreignKeyName: 'puzzle_authoring_puzzle_id_fkey'
						columns: ['puzzle_id']
						isOneToOne: true
						referencedRelation: 'puzzles'
						referencedColumns: ['id']
					},
				]
			}
			puzzle_completions: {
				Row: {
					completed_at: string
					puzzle_id: string
					user_id: string
				}
				Insert: {
					completed_at?: string
					puzzle_id: string
					user_id: string
				}
				Update: {
					completed_at?: string
					puzzle_id?: string
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'puzzle_completions_puzzle_id_fkey'
						columns: ['puzzle_id']
						isOneToOne: false
						referencedRelation: 'puzzles'
						referencedColumns: ['id']
					},
				]
			}
			puzzle_group_grants: {
				Row: {
					granted_at: string
					group_id: string
					id: string
					reward_rule_id: string | null
					source: string
					user_id: string
				}
				Insert: {
					granted_at?: string
					group_id: string
					id?: string
					reward_rule_id?: string | null
					source: string
					user_id: string
				}
				Update: {
					granted_at?: string
					group_id?: string
					id?: string
					reward_rule_id?: string | null
					source?: string
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'puzzle_group_grants_group_id_fkey'
						columns: ['group_id']
						isOneToOne: false
						referencedRelation: 'puzzle_groups'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'puzzle_group_grants_reward_rule_id_fkey'
						columns: ['reward_rule_id']
						isOneToOne: false
						referencedRelation: 'reward_rules'
						referencedColumns: ['id']
					},
				]
			}
			puzzle_group_members: {
				Row: {
					group_id: string
					position: number
					puzzle_id: string
				}
				Insert: {
					group_id: string
					position: number
					puzzle_id: string
				}
				Update: {
					group_id?: string
					position?: number
					puzzle_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'puzzle_group_members_group_id_fkey'
						columns: ['group_id']
						isOneToOne: false
						referencedRelation: 'puzzle_groups'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'puzzle_group_members_puzzle_id_fkey'
						columns: ['puzzle_id']
						isOneToOne: true
						referencedRelation: 'puzzles'
						referencedColumns: ['id']
					},
				]
			}
			puzzle_groups: {
				Row: {
					id: string
					name: string
					published_at: string | null
					purpose: string
					release_at: string | null
					selection_mode: string
					shape_id: string | null
					track: string | null
				}
				Insert: {
					id?: string
					name: string
					published_at?: string | null
					purpose: string
					release_at?: string | null
					selection_mode?: string
					shape_id?: string | null
					track?: string | null
				}
				Update: {
					id?: string
					name?: string
					published_at?: string | null
					purpose?: string
					release_at?: string | null
					selection_mode?: string
					shape_id?: string | null
					track?: string | null
				}
				Relationships: [
					{
						foreignKeyName: 'puzzle_groups_shape_id_fkey'
						columns: ['shape_id']
						isOneToOne: false
						referencedRelation: 'shapes'
						referencedColumns: ['id']
					},
				]
			}
			puzzles: {
				Row: {
					board_size: string
					definition: Json
					difficulty: string
					id: string
					name: string
					palette_id: string
					published_at: string | null
					release_at: string | null
					rotation_allowed: boolean
					shape_id: string
				}
				Insert: {
					board_size: string
					definition: Json
					difficulty: string
					id?: string
					name: string
					palette_id: string
					published_at?: string | null
					release_at?: string | null
					rotation_allowed: boolean
					shape_id: string
				}
				Update: {
					board_size?: string
					definition?: Json
					difficulty?: string
					id?: string
					name?: string
					palette_id?: string
					published_at?: string | null
					release_at?: string | null
					rotation_allowed?: boolean
					shape_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'puzzles_palette_id_fkey'
						columns: ['palette_id']
						isOneToOne: false
						referencedRelation: 'palettes'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'puzzles_shape_id_fkey'
						columns: ['shape_id']
						isOneToOne: false
						referencedRelation: 'shapes'
						referencedColumns: ['id']
					},
				]
			}
			reward_palettes: {
				Row: {
					palette_id: string
					reward_rule_id: string
				}
				Insert: {
					palette_id: string
					reward_rule_id: string
				}
				Update: {
					palette_id?: string
					reward_rule_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'reward_palettes_palette_id_fkey'
						columns: ['palette_id']
						isOneToOne: false
						referencedRelation: 'palettes'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'reward_palettes_reward_rule_id_fkey'
						columns: ['reward_rule_id']
						isOneToOne: false
						referencedRelation: 'reward_rules'
						referencedColumns: ['id']
					},
				]
			}
			reward_puzzle_groups: {
				Row: {
					group_id: string
					reward_rule_id: string
				}
				Insert: {
					group_id: string
					reward_rule_id: string
				}
				Update: {
					group_id?: string
					reward_rule_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'reward_puzzle_groups_group_id_fkey'
						columns: ['group_id']
						isOneToOne: false
						referencedRelation: 'puzzle_groups'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'reward_puzzle_groups_reward_rule_id_fkey'
						columns: ['reward_rule_id']
						isOneToOne: false
						referencedRelation: 'reward_rules'
						referencedColumns: ['id']
					},
				]
			}
			reward_rules: {
				Row: {
					group_id: string
					id: string
				}
				Insert: {
					group_id: string
					id?: string
				}
				Update: {
					group_id?: string
					id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'reward_rules_group_id_fkey'
						columns: ['group_id']
						isOneToOne: true
						referencedRelation: 'puzzle_groups'
						referencedColumns: ['id']
					},
				]
			}
			shape_grants: {
				Row: {
					granted_at: string
					id: string
					reward_rule_id: string | null
					shape_id: string
					source: string
					user_id: string
				}
				Insert: {
					granted_at?: string
					id?: string
					reward_rule_id?: string | null
					shape_id: string
					source: string
					user_id: string
				}
				Update: {
					granted_at?: string
					id?: string
					reward_rule_id?: string | null
					shape_id?: string
					source?: string
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'shape_grants_reward_rule_id_fkey'
						columns: ['reward_rule_id']
						isOneToOne: false
						referencedRelation: 'reward_rules'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'shape_grants_shape_id_fkey'
						columns: ['shape_id']
						isOneToOne: false
						referencedRelation: 'shapes'
						referencedColumns: ['id']
					},
				]
			}
			shape_progression: {
				Row: {
					position: number
					shape_id: string
				}
				Insert: {
					position: number
					shape_id: string
				}
				Update: {
					position?: number
					shape_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'shape_progression_shape_id_fkey'
						columns: ['shape_id']
						isOneToOne: true
						referencedRelation: 'shapes'
						referencedColumns: ['id']
					},
				]
			}
			shapes: {
				Row: {
					id: string
					name: string
					published_at: string | null
					release_at: string | null
				}
				Insert: {
					id: string
					name: string
					published_at?: string | null
					release_at?: string | null
				}
				Update: {
					id?: string
					name?: string
					published_at?: string | null
					release_at?: string | null
				}
				Relationships: []
			}
		}
		Views: {
			[_ in never]: never
		}
		Functions: {
			apply_release: {
				Args: {
					p_action: string
					p_id: string
					p_kind: string
					p_release_at?: string
				}
				Returns: Json
			}
			beta_dashboard: { Args: never; Returns: Json }
			bulk_delete_palette_drafts: {
				Args: { p_ids: string[] }
				Returns: string[]
			}
			bulk_puzzle_drafts: {
				Args: {
					p_action: string
					p_ids: string[]
					p_palette_id?: string
				}
				Returns: string[]
			}
			correct_published_palette: {
				Args: {
					p_colors: string[]
					p_expected_colors: string[]
					p_expected_name: string
					p_expected_revision: number
					p_id: string
					p_name: string
				}
				Returns: string
			}
			create_beta_invite: {
				Args: { p_email: string; p_name: string; p_round: string }
				Returns: Json
			}
			delete_palette_draft: {
				Args: {
					p_expected_colors: string[]
					p_expected_name: string
					p_expected_revision: number
					p_id: string
				}
				Returns: string
			}
			delete_puzzle_draft: { Args: { p_id: string }; Returns: string }
			edit_puzzle_draft: {
				Args: { p_id: string; p_name: string; p_palette_id: string }
				Returns: string
			}
			locked_set_previews: {
				Args: never
				Returns: {
					board_size: string
					definition: Json
					difficulty: string
					id: string
					name: string
					palette_id: string
					published_at: string | null
					release_at: string | null
					rotation_allowed: boolean
					shape_id: string
				}[]
				SetofOptions: {
					from: '*'
					to: 'puzzles'
					isOneToOne: false
					isSetofReturn: true
				}
			}
			manage_palette_draft: {
				Args: {
					p_action: string
					p_colors?: string[]
					p_expected_colors?: string[]
					p_expected_name?: string
					p_expected_revision?: number
					p_id: string
					p_name?: string
				}
				Returns: string
			}
			manage_palette_group: {
				Args: {
					p_action: string
					p_id: string
					p_name?: string
					p_palette_ids?: string[]
					p_purpose?: string
				}
				Returns: string
			}
			manage_progression_slot: {
				Args: {
					p_group_id?: string
					p_palette_ids?: string[]
					p_purpose: string
					p_shape_id: string
					p_track: string
				}
				Returns: string
			}
			manage_puzzle_group: {
				Args: {
					p_action: string
					p_id: string
					p_name?: string
					p_purpose?: string
					p_puzzle_ids?: string[]
					p_shape_id?: string
					p_track?: string
				}
				Returns: string
			}
			manage_shape_progression: {
				Args: { p_shape_ids: string[] }
				Returns: string[]
			}
			preview_puzzles: {
				Args: never
				Returns: {
					board_size: string
					definition: Json
					difficulty: string
					id: string
					name: string
					palette_id: string
					published_at: string | null
					release_at: string | null
					rotation_allowed: boolean
					shape_id: string
				}[]
				SetofOptions: {
					from: '*'
					to: 'puzzles'
					isOneToOne: false
					isSetofReturn: true
				}
			}
			preview_release: {
				Args: {
					p_action: string
					p_id: string
					p_kind: string
					p_release_at?: string
				}
				Returns: Json
			}
			record_puzzle_completions: {
				Args: { p_puzzle_ids: string[] }
				Returns: string[]
			}
			redeem_beta_invite: { Args: { p_token: string }; Returns: string }
			replace_puzzle_draft: {
				Args: {
					p_board_size: string
					p_definition: Json
					p_difficulty: string
					p_generator_version: string
					p_id: string
					p_known_solution: Json
					p_name: string
					p_palette_id: string
					p_rotation_allowed: boolean
					p_seed: string
					p_shape_id: string
				}
				Returns: string
			}
			save_puzzle_draft: {
				Args: {
					p_board_size: string
					p_definition: Json
					p_difficulty: string
					p_generator_version: string
					p_id: string
					p_known_solution: Json
					p_name: string
					p_palette_id: string
					p_rotation_allowed: boolean
					p_seed: string
					p_shape_id: string
				}
				Returns: string
			}
			submit_beta_report: {
				Args: {
					p_attempted: string
					p_details: string
					p_device: Json
					p_expected: string
					p_feature: string
					p_happened: string
					p_id: string
					p_images: string[]
					p_kind: string
					p_round: string
				}
				Returns: string
			}
			submit_beta_survey: {
				Args: { p_answers: Json; p_round: string }
				Returns: undefined
			}
		}
		Enums: {
			[_ in never]: never
		}
		CompositeTypes: {
			[_ in never]: never
		}
	}
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never) = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
				DefaultSchema['Views'])
		? (DefaultSchema['Tables'] &
				DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R
			}
			? R
			: never
		: never

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I
			}
			? I
			: never
		: never

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U
			}
			? U
			: never
		: never

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema['Enums']
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends (DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema['CompositeTypes']
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never) = never,
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never

export const Constants = {
	graphql_public: {
		Enums: {},
	},
	public: {
		Enums: {},
	},
} as const
