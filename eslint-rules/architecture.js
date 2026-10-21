// Local ESLint rules that keep the src/ folder structure honest. See the
// Architecture section of CONTEXT.md for the layers and their directions.
import fs from 'node:fs'
import path from 'node:path'

const srcDir = path.resolve(import.meta.dirname, '..', 'src')
const codeExtensions = ['.ts', '.tsx']

function relativeToSrc(file) {
	const relative = path.relative(srcDir, file)
	return relative.startsWith('..') ? null : relative.split(path.sep).join('/')
}

// Tests may reach into internals and mock exact files.
function isExempt(file) {
	const relative = relativeToSrc(file)
	return (
		!relative ||
		relative.startsWith('test/') ||
		/\.test\.tsx?$/.test(relative)
	)
}

// app | features/<name> | ui | domain | lib, or null for root files like main.tsx.
function layerOf(relative) {
	const [top, second] = relative.split('/')
	if (top === 'features' && second) return `features/${second}`
	return ['app', 'ui', 'domain', 'lib'].includes(top) ? top : null
}

function allowed(from, to) {
	if (from === to || from === 'app') return true
	if (from.startsWith('features/'))
		return ['ui', 'domain', 'lib'].includes(to)
	if (from === 'ui') return ['domain', 'lib'].includes(to)
	if (from === 'domain') return to === 'lib'
	return false
}

// Resolves '@/…' to a file, or to a folder with an index, or null.
function resolveAlias(specifier) {
	if (!specifier.startsWith('@/')) return null
	const base = path.join(srcDir, specifier.slice(2))
	if (fs.existsSync(base) && fs.statSync(base).isFile()) return { file: base }
	for (const extension of codeExtensions)
		if (fs.existsSync(base + extension)) return { file: base + extension }
	for (const extension of codeExtensions)
		if (fs.existsSync(path.join(base, `index${extension}`)))
			return { folder: base }
	return null
}

function onImportSources(check) {
	const visit = node => {
		if (node.source && typeof node.source.value === 'string')
			check(node, node.source.value)
	}
	return {
		ImportDeclaration: visit,
		ExportNamedDeclaration: visit,
		ExportAllDeclaration: visit,
		ImportExpression: visit,
	}
}

const layers = {
	meta: {
		type: 'problem',
		messages: {
			direction:
				"'{{from}}' code may not import from '{{to}}'. Dependencies point app → features → ui → domain/lib, and features never import each other.",
		},
		schema: [],
	},
	create(context) {
		if (isExempt(context.filename)) return {}
		const from = layerOf(relativeToSrc(context.filename))
		if (!from) return {}
		return onImportSources((node, specifier) => {
			if (!specifier.startsWith('@/')) return
			const to = layerOf(specifier.slice(2))
			if (to && !allowed(from, to))
				context.report({
					node: node.source,
					messageId: 'direction',
					data: { from, to },
				})
		})
	},
}

const noReactInDomain = {
	meta: {
		type: 'problem',
		messages: {
			react: 'domain/ is React-free and style-free; move UI code to ui/ or a feature.',
		},
		schema: [],
	},
	create(context) {
		const relative = relativeToSrc(context.filename)
		if (isExempt(context.filename) || layerOf(relative) !== 'domain')
			return {}
		return onImportSources((node, specifier) => {
			if (
				/^react(-dom)?(\/|$)/.test(specifier) ||
				specifier.endsWith('.css')
			)
				context.report({ node: node.source, messageId: 'react' })
		})
	},
}

const useBarrels = {
	meta: {
		type: 'suggestion',
		messages: {
			barrel: "Import '{{folder}}' (its index.ts) instead of a file inside it.",
		},
		schema: [],
	},
	create(context) {
		if (isExempt(context.filename)) return {}
		const importerDir = path.dirname(context.filename)
		return onImportSources((node, specifier) => {
			if (specifier.endsWith('.css')) return
			const target = resolveAlias(specifier)
			if (!target?.file) return
			const folder = path.dirname(target.file)
			const hasBarrel = codeExtensions.some(extension =>
				fs.existsSync(path.join(folder, `index${extension}`)),
			)
			// Files inside a barrel's folder (or below it) import siblings directly,
			// since going through their own barrel would create a cycle.
			const inside =
				importerDir === folder ||
				importerDir.startsWith(folder + path.sep)
			if (hasBarrel && !inside)
				context.report({
					node: node.source,
					messageId: 'barrel',
					data: { folder: `@/${relativeToSrc(folder)}` },
				})
		})
	},
}

const colocatedStyles = {
	meta: {
		type: 'suggestion',
		messages: {
			css: "Import only stylesheets from this file's own folder ('./X.module.css'); share styling through a component instead.",
			parent: "Use the '@/' alias instead of '../' imports.",
		},
		schema: [],
	},
	create(context) {
		if (isExempt(context.filename)) return {}
		return onImportSources((node, specifier) => {
			if (specifier.startsWith('../'))
				context.report({ node: node.source, messageId: 'parent' })
			else if (
				specifier.endsWith('.module.css') &&
				!/^\.\/[^/]+$/.test(specifier)
			)
				context.report({ node: node.source, messageId: 'css' })
		})
	},
}

export default {
	rules: {
		layers,
		'no-react-in-domain': noReactInDomain,
		'use-barrels': useBarrels,
		'colocated-styles': colocatedStyles,
	},
}
