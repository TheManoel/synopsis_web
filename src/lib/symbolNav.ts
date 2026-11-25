/** Route of a symbol's analysis (keys carry `^`, `=` and `@`). */
export const symbolPath = (key: string) => `/simbolos/${encodeURIComponent(key)}`

/** Opens the ⌘K symbol palette from anywhere (a button, a link). */
export const openSymbolSearch = () => window.dispatchEvent(new Event('synopsis:search'))
