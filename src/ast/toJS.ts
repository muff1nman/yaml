import { Document } from '../doc/Document.js'
import { Node } from './index.js'

export interface ToJSContext {
  anchors: Map<
    Node,
    { alias: string[]; aliasCount: number; count: number; res?: Node }
  > | null
  doc: Document
  indentStep: string
  keep: boolean
  mapAsMap: boolean
  mapKeyWarned: boolean
  maxAliasCount: number
  onCreate?: (res: Node) => void

  /** Requiring directly in Pair would create circular dependencies */
  stringify: () => string
}

/**
 * Recursively convert any node or its contents to native JavaScript
 *
 * @param value - The input value
 * @param arg - If `value` defines a `toJSON()` method, use this
 *   as its first argument
 * @param ctx - Conversion context, originally set in Document#toJS(). If
 *   `{ keep: true }` is not set, output should be suitable for JSON
 *   stringification.
 */
export function toJS(value: any, arg: string | null, ctx: ToJSContext): any {
  if (Array.isArray(value)) return value.map((v, i) => toJS(v, String(i), ctx))
  if (value && typeof value.toJSON === 'function') {
    const anchor = ctx && ctx.anchors && ctx.anchors.get(value)
    if (anchor)
      ctx.onCreate = res => {
        anchor.res = res
        delete ctx.onCreate
      }
    const res = value.toJSON(arg, ctx)
    if (anchor && ctx.onCreate) ctx.onCreate(res)
    return res
  }
  if (!(ctx && ctx.keep) && typeof value === 'bigint') return Number(value)
  return value
}
