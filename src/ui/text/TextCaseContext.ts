import { createContext } from 'react'

// How buttons and headings capitalize their text. Text is shown as written unless
// an app opts in; the player app uses title case.
export type TextCase = 'title' | 'asWritten'

export const TextCaseContext = createContext<TextCase>('asWritten')
