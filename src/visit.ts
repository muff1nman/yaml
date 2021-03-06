import { Alias, Node, Pair, Scalar, YAMLMap, YAMLSeq } from './ast/index.js'
import { Document } from './doc/Document.js'

const BREAK = Symbol('break visit')
const SKIP = Symbol('skip children')
const REMOVE = Symbol('remove node')

export type visitorFn<T> = (
  key: number | 'key' | 'value' | null,
  node: T,
  path: readonly Node[]
) => void | symbol | number | Node

export type visitor =
  | visitorFn<any>
  | {
      Alias?: visitorFn<Alias>
      Map?: visitorFn<YAMLMap>
      Pair?: visitorFn<Pair>
      Scalar?: visitorFn<Scalar>
      Seq?: visitorFn<YAMLSeq>
    }

/**
 * Apply a visitor to an AST node or document.
 *
 * Walks through the tree (depth-first) starting from `node`, calling a
 * `visitor` function with three arguments:
 *   - `key`: For sequence values and map `Pair`, the node's index in the
 *     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
 *     `null` for the root node.
 *   - `node`: The current node.
 *   - `path`: The ancestry of the current node.
 *
 * The return value of the visitor may be used to control the traversal:
 *   - `undefined` (default): Do nothing and continue
 *   - `visit.SKIP`: Do not visit the children of this node, continue with next
 *     sibling
 *   - `visit.BREAK`: Terminate traversal completely
 *   - `visit.REMOVE`: Remove the current node, then continue with the next one
 *   - `Node`: Replace the current node, then continue by visiting it
 *   - `number`: While iterating the items of a sequence or map, set the index
 *     of the next step. This is useful especially if the index of the current
 *     node has changed.
 *
 * If `visitor` is a single function, it will be called with all values
 * encountered in the tree, including e.g. `null` values. Alternatively,
 * separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
 * `Alias` and `Scalar` node.
 */
export function visit(
  node: Node | Document,
  visitor:
    | visitorFn<any>
    | {
        Alias?: visitorFn<Alias>
        Map?: visitorFn<YAMLMap>
        Pair?: visitorFn<Pair>
        Scalar?: visitorFn<Scalar>
        Seq?: visitorFn<YAMLSeq>
      }
) {
  if (node instanceof Document) {
    const cd = _visit(null, node.contents, visitor, Object.freeze([node]))
    if (cd === REMOVE) node.contents = null
  } else _visit(null, node, visitor, Object.freeze([]))
}

// Without the `as symbol` casts, TS declares these in the `visit`
// namespace using `var`, but then complains about that because
// `unique symbol` must be `const`.

/** Terminate visit traversal completely */
visit.BREAK = BREAK as symbol

/** Do not visit the children of the current node */
visit.SKIP = SKIP as symbol

/** Remove the current node */
visit.REMOVE = REMOVE as symbol

function _visit(
  key: number | 'key' | 'value' | null,
  node: Node,
  visitor: visitor,
  path: readonly Node[]
): void | symbol | number | Node {
  let ctrl = undefined
  if (typeof visitor === 'function') ctrl = visitor(key, node, path)
  else if (node instanceof YAMLMap) {
    if (visitor.Map) ctrl = visitor.Map(key, node, path)
  } else if (node instanceof YAMLSeq) {
    if (visitor.Seq) ctrl = visitor.Seq(key, node, path)
  } else if (node instanceof Pair) {
    if (visitor.Pair) ctrl = visitor.Pair(key, node, path)
  } else if (node instanceof Scalar) {
    if (visitor.Scalar) ctrl = visitor.Scalar(key, node, path)
  } else if (node instanceof Alias) {
    if (visitor.Alias) ctrl = visitor.Alias(key, node, path)
  }

  if (ctrl instanceof Node) {
    const parent = path[path.length - 1]
    if (parent instanceof YAMLMap || parent instanceof YAMLSeq) {
      parent.items[key as number] = ctrl
    } else if (parent instanceof Pair) {
      if (key === 'key') parent.key = ctrl
      else parent.value = ctrl
    } else if (parent instanceof Document) {
      parent.contents = ctrl
    } else {
      const pt = parent && parent.type
      throw new Error(`Cannot replace node with ${pt} parent`)
    }
    return _visit(key, ctrl, visitor, path)
  }

  if (typeof ctrl !== 'symbol') {
    if (node instanceof YAMLMap || node instanceof YAMLSeq) {
      path = Object.freeze(path.concat(node))
      for (let i = 0; i < node.items.length; ++i) {
        const ci = _visit(i, node.items[i], visitor, path)
        if (typeof ci === 'number') i = ci - 1
        else if (ci === BREAK) return BREAK
        else if (ci === REMOVE) {
          node.items.splice(i, 1)
          i -= 1
        }
      }
    } else if (node instanceof Pair) {
      path = Object.freeze(path.concat(node))
      const ck = _visit('key', node.key, visitor, path)
      if (ck === BREAK) return BREAK
      else if (ck === REMOVE) node.key = null
      const cv = _visit('value', node.value, visitor, path)
      if (cv === BREAK) return BREAK
      else if (cv === REMOVE) node.value = null
    }
  }

  return ctrl
}
