import type { PlayerPalette } from '@/domain/palettes'
import { supportedGridShapes } from '@/domain/shapes'
import type { PlayerContent } from '@/ui/content'

// Sample palettes for tests; the app itself only uses palettes from the database.
export const palettes: readonly PlayerPalette[] = [
	{
		id: 'tahiti',
		name: 'Tahiti',
		colors: ['#ff9f1c', '#ffbf69', '#ffecb6', '#cbf3f0', '#2ec4b6'],
	},
	{
		id: 'cabo',
		name: 'Cabo',
		colors: ['#a53f2b', '#f09f92', '#ffdccc', '#0f7173', '#124e5f'],
	},
	{
		id: 'club-neon',
		name: 'Club Neon',
		colors: ['#3599a7', '#75dddd', '#9297c4', '#9775b3', '#aa3e98'],
	},
	{
		id: 'regatta',
		name: 'Regatta',
		colors: ['#791818', '#ae1f29', '#c9c2b3', '#2788a3', '#0a465c'],
	},
	{
		id: 'boho',
		name: 'Boho',
		colors: ['#d1ab9b', '#eedcb8', '#acac7b', '#799277', '#4b7478'],
	},
	{
		id: 'lake-house',
		name: 'Lake House',
		colors: ['#8d201e', '#dbb80d', '#f3e5bf', '#239cb7', '#156783'],
	},
	{
		id: 'tahoe',
		name: 'Tahoe',
		colors: ['#bc4749', '#c17c74', '#ddc9b4', '#bcac9b', '#7a6c5d'],
	},
	{
		id: 'wisteria',
		name: 'Wisteria',
		colors: ['#6ab47e', '#96d3be', '#7785ac', '#683991', '#472469'],
	},
	{
		id: 'autumn',
		name: 'Autumn',
		colors: ['#bc6c25', '#dda15e', '#f1c780', '#6d7b42', '#3f5428'],
	},
	{
		id: 'watermelon',
		name: 'Watermelon',
		colors: ['#e34a6f', '#f7b2bd', '#d6e8d5', '#60a561', '#09482c'],
	},
	{
		id: 'sedona',
		name: 'Sedona',
		colors: ['#96431f', '#ae6451', '#cd905f', '#e2cfa1', '#3fa59a'],
	},
	{
		id: 'ocean',
		name: 'Ocean',
		colors: ['#5fa8d3', '#9ad5f2', '#bee9e8', '#62b6cb', '#24597a'],
	},
	{
		id: 'rose-gold',
		name: 'Rose Gold',
		colors: ['#744253', '#c78283', '#ebc9cd', '#e4b8b5', '#aa6e6b'],
	},
	{
		id: 'salmon',
		name: 'Salmon',
		colors: ['#bc4749', '#f2e8cf', '#a7c957', '#6a994e', '#386641'],
	},
	{
		id: 'lilac-mist',
		name: 'Lilac Mist',
		colors: ['#735d78', '#b392ac', '#d1b3c4', '#e8c2ca', '#f7d1cd'],
	},
	{
		id: 'daytona',
		name: 'Daytona',
		colors: ['#e29578', '#ffddd2', '#e6d5d0', '#83c5be', '#006d77'],
	},
	{
		id: 'dianthus',
		name: 'Dianthus',
		colors: ['#cb607b', '#e07d96', '#e8a4b5', '#e9b0bf', '#e9d2d8'],
	},
	{
		id: 'sitka',
		name: 'Sitka',
		colors: ['#b84743', '#d45b49', '#b2ae9b', '#42947b', '#3a625e'],
	},
	{
		id: 'grey-morning',
		name: 'Grey Morning',
		colors: ['#9e9898', '#c3baba', '#e9e3e6', '#b2b2b2', '#736f72'],
	},
]

// Everything unlocked and nothing to solve, so most tests see the whole app.
export const testContent: PlayerContent = {
	palettes,
	unlockedShapes: supportedGridShapes.map(shape => shape.id),
	nextShape: null,
	randomizerUnlocked: true,
	puzzleSets: [],
	rewards: [],
}
