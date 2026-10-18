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
			collection_grants: {
				Row: {
					collection_id: string
					granted_at: string
					id: string
					reward_rule_id: string | null
					source: string
					user_id: string
				}
				Insert: {
					collection_id: string
					granted_at?: string
					id?: string
					reward_rule_id?: string | null
					source: string
					user_id: string
				}
				Update: {
					collection_id?: string
					granted_at?: string
					id?: string
					reward_rule_id?: string | null
					source?: string
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'collection_grants_collection_id_fkey'
						columns: ['collection_id']
						isOneToOne: false
						referencedRelation: 'puzzle_collections'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'collection_grants_reward_rule_id_fkey'
						columns: ['reward_rule_id']
						isOneToOne: false
						referencedRelation: 'reward_rules'
						referencedColumns: ['id']
					},
				]
			}
			collection_puzzles: {
				Row: {
					collection_id: string
					position: number
					puzzle_id: string
					puzzle_usage: string
					shape_id: string
				}
				Insert: {
					collection_id: string
					position: number
					puzzle_id: string
					puzzle_usage?: string
					shape_id: string
				}
				Update: {
					collection_id?: string
					position?: number
					puzzle_id?: string
					puzzle_usage?: string
					shape_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'collection_puzzles_collection_id_shape_id_fkey'
						columns: ['collection_id', 'shape_id']
						isOneToOne: false
						referencedRelation: 'puzzle_collections'
						referencedColumns: ['id', 'shape_id']
					},
					{
						foreignKeyName: 'collection_puzzles_puzzle_id_shape_id_puzzle_usage_fkey'
						columns: ['puzzle_id', 'shape_id', 'puzzle_usage']
						isOneToOne: false
						referencedRelation: 'puzzles'
						referencedColumns: ['id', 'shape_id', 'usage']
					},
				]
			}
			completion_routes: {
				Row: {
					collection_id: string
					id: string
					name: string
					position: number
				}
				Insert: {
					collection_id: string
					id?: string
					name: string
					position: number
				}
				Update: {
					collection_id?: string
					id?: string
					name?: string
					position?: number
				}
				Relationships: [
					{
						foreignKeyName: 'completion_routes_collection_id_fkey'
						columns: ['collection_id']
						isOneToOne: false
						referencedRelation: 'puzzle_collections'
						referencedColumns: ['id']
					},
				]
			}
			core_progression: {
				Row: {
					name: string
					published_at: string | null
					release_at: string | null
					singleton: boolean
				}
				Insert: {
					name: string
					published_at?: string | null
					release_at?: string | null
					singleton?: boolean
				}
				Update: {
					name?: string
					published_at?: string | null
					release_at?: string | null
					singleton?: boolean
				}
				Relationships: []
			}
			core_steps: {
				Row: {
					collection_id: string
					position: number
				}
				Insert: {
					collection_id: string
					position: number
				}
				Update: {
					collection_id?: string
					position?: number
				}
				Relationships: [
					{
						foreignKeyName: 'core_steps_collection_id_fkey'
						columns: ['collection_id']
						isOneToOne: true
						referencedRelation: 'puzzle_collections'
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
					puzzle_usage: string
					release_at: string
				}
				Insert: {
					expires_at: string
					id?: string
					puzzle_id: string
					puzzle_usage?: string
					release_at: string
				}
				Update: {
					expires_at?: string
					id?: string
					puzzle_id?: string
					puzzle_usage?: string
					release_at?: string
				}
				Relationships: [
					{
						foreignKeyName: 'daily_puzzles_puzzle_id_puzzle_usage_fkey'
						columns: ['puzzle_id', 'puzzle_usage']
						isOneToOne: false
						referencedRelation: 'puzzles'
						referencedColumns: ['id', 'usage']
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
			palette_pack_palettes: {
				Row: {
					pack_id: string
					palette_id: string
					position: number
				}
				Insert: {
					pack_id: string
					palette_id: string
					position: number
				}
				Update: {
					pack_id?: string
					palette_id?: string
					position?: number
				}
				Relationships: [
					{
						foreignKeyName: 'palette_pack_palettes_pack_id_fkey'
						columns: ['pack_id']
						isOneToOne: false
						referencedRelation: 'palette_packs'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'palette_pack_palettes_palette_id_fkey'
						columns: ['palette_id']
						isOneToOne: false
						referencedRelation: 'palettes'
						referencedColumns: ['id']
					},
				]
			}
			palette_packs: {
				Row: {
					id: string
					name: string
					published_at: string | null
					release_at: string | null
				}
				Insert: {
					id?: string
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
			puzzle_collections: {
				Row: {
					id: string
					kind: string
					name: string
					published_at: string | null
					release_at: string | null
					selection_mode: string
					shape_id: string
				}
				Insert: {
					id?: string
					kind: string
					name: string
					published_at?: string | null
					release_at?: string | null
					selection_mode?: string
					shape_id: string
				}
				Update: {
					id?: string
					kind?: string
					name?: string
					published_at?: string | null
					release_at?: string | null
					selection_mode?: string
					shape_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'puzzle_collections_shape_id_fkey'
						columns: ['shape_id']
						isOneToOne: false
						referencedRelation: 'shapes'
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
					usage: string
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
					usage: string
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
					usage?: string
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
			reward_rules: {
				Row: {
					collection_id: string
					id: string
					route_id: string | null
				}
				Insert: {
					collection_id: string
					id?: string
					route_id?: string | null
				}
				Update: {
					collection_id?: string
					id?: string
					route_id?: string | null
				}
				Relationships: [
					{
						foreignKeyName: 'reward_rules_collection_id_fkey'
						columns: ['collection_id']
						isOneToOne: false
						referencedRelation: 'puzzle_collections'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'reward_rules_route_id_collection_id_fkey'
						columns: ['route_id', 'collection_id']
						isOneToOne: false
						referencedRelation: 'completion_routes'
						referencedColumns: ['id', 'collection_id']
					},
				]
			}
			reward_sets: {
				Row: {
					collection_id: string
					reward_rule_id: string
				}
				Insert: {
					collection_id: string
					reward_rule_id: string
				}
				Update: {
					collection_id?: string
					reward_rule_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'reward_sets_collection_id_fkey'
						columns: ['collection_id']
						isOneToOne: false
						referencedRelation: 'puzzle_collections'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'reward_sets_reward_rule_id_fkey'
						columns: ['reward_rule_id']
						isOneToOne: false
						referencedRelation: 'reward_rules'
						referencedColumns: ['id']
					},
				]
			}
			reward_shapes: {
				Row: {
					reward_rule_id: string
					shape_id: string
				}
				Insert: {
					reward_rule_id: string
					shape_id: string
				}
				Update: {
					reward_rule_id?: string
					shape_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'reward_shapes_reward_rule_id_fkey'
						columns: ['reward_rule_id']
						isOneToOne: false
						referencedRelation: 'reward_rules'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'reward_shapes_shape_id_fkey'
						columns: ['shape_id']
						isOneToOne: false
						referencedRelation: 'shapes'
						referencedColumns: ['id']
					},
				]
			}
			route_puzzles: {
				Row: {
					collection_id: string
					puzzle_id: string
					route_id: string
				}
				Insert: {
					collection_id: string
					puzzle_id: string
					route_id: string
				}
				Update: {
					collection_id?: string
					puzzle_id?: string
					route_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'route_puzzles_collection_id_puzzle_id_fkey'
						columns: ['collection_id', 'puzzle_id']
						isOneToOne: false
						referencedRelation: 'collection_puzzles'
						referencedColumns: ['collection_id', 'puzzle_id']
					},
					{
						foreignKeyName: 'route_puzzles_route_id_collection_id_fkey'
						columns: ['route_id', 'collection_id']
						isOneToOne: false
						referencedRelation: 'completion_routes'
						referencedColumns: ['id', 'collection_id']
					},
				]
			}
			set_qualifications: {
				Row: {
					collection_id: string
					qualified_at: string
					route_id: string
					user_id: string
				}
				Insert: {
					collection_id: string
					qualified_at?: string
					route_id: string
					user_id: string
				}
				Update: {
					collection_id?: string
					qualified_at?: string
					route_id?: string
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'set_qualifications_collection_id_fkey'
						columns: ['collection_id']
						isOneToOne: false
						referencedRelation: 'puzzle_collections'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'set_qualifications_route_id_collection_id_fkey'
						columns: ['route_id', 'collection_id']
						isOneToOne: false
						referencedRelation: 'completion_routes'
						referencedColumns: ['id', 'collection_id']
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
			starter_palettes: {
				Row: {
					palette_id: string
				}
				Insert: {
					palette_id: string
				}
				Update: {
					palette_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'starter_palettes_palette_id_fkey'
						columns: ['palette_id']
						isOneToOne: true
						referencedRelation: 'palettes'
						referencedColumns: ['id']
					},
				]
			}
			starter_shapes: {
				Row: {
					shape_id: string
				}
				Insert: {
					shape_id: string
				}
				Update: {
					shape_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'starter_shapes_shape_id_fkey'
						columns: ['shape_id']
						isOneToOne: true
						referencedRelation: 'shapes'
						referencedColumns: ['id']
					},
				]
			}
		}
		Views: {
			[_ in never]: never
		}
		Functions: {
			save_hex_puzzle_draft: {
				Args: {
					p_id: string
					p_name: string
					p_usage: string
					p_palette_id: string
					p_board_size: string
					p_rotation_allowed: boolean
					p_difficulty: string
					p_definition: Json
					p_seed: string
					p_generator_version: string
					p_known_solution: Json
				}
				Returns: string
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
