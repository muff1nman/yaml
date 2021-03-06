import { Type } from '../constants.js'
import { createNode } from '../doc/createNode.js'
import { warn } from '../log.js'
import { addComment } from '../stringify/addComment.js'
import { Collection } from './Collection.js'
import { Node } from './Node.js'
import { Scalar } from './Scalar.js'
import { YAMLSeq } from './YAMLSeq.js'
import { toJS } from './toJS.js'

function stringifyKey(key, jsKey, ctx) {
  if (jsKey === null) return ''
  if (typeof jsKey !== 'object') return String(jsKey)
  if (key instanceof Node && ctx && ctx.doc) {
    const strKey = key.toString({
      anchors: Object.create(null),
      doc: ctx.doc,
      indent: '',
      indentStep: ctx.indentStep,
      inFlow: true,
      inStringifyKey: true,
      stringify: ctx.stringify
    })
    if (!ctx.mapKeyWarned) {
      let jsonStr = JSON.stringify(strKey)
      if (jsonStr.length > 40)
        jsonStr = jsonStr.split('').splice(36, '..."').join('')
      warn(
        ctx.doc.options.logLevel,
        `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`
      )
      ctx.mapKeyWarned = true
    }
    return strKey
  }
  return JSON.stringify(jsKey)
}

export function createPair(key, value, ctx) {
  const k = createNode(key, null, ctx)
  const v = createNode(value, null, ctx)
  return new Pair(k, v)
}

export class Pair extends Node {
  static Type = {
    PAIR: 'PAIR',
    MERGE_PAIR: 'MERGE_PAIR'
  }

  constructor(key, value = null) {
    super()
    this.key = key
    this.value = value
    this.type = Pair.Type.PAIR
  }

  get commentBefore() {
    return this.key instanceof Node ? this.key.commentBefore : undefined
  }

  set commentBefore(cb) {
    if (this.key == null) this.key = new Scalar(null)
    if (this.key instanceof Node) this.key.commentBefore = cb
    else {
      const msg =
        'Pair.commentBefore is an alias for Pair.key.commentBefore. To set it, the key must be a Node.'
      throw new Error(msg)
    }
  }

  get spaceBefore() {
    return this.key instanceof Node ? this.key.spaceBefore : undefined
  }

  set spaceBefore(sb) {
    if (this.key == null) this.key = new Scalar(null)
    if (this.key instanceof Node) this.key.spaceBefore = sb
    else {
      const msg =
        'Pair.spaceBefore is an alias for Pair.key.spaceBefore. To set it, the key must be a Node.'
      throw new Error(msg)
    }
  }

  addToJSMap(ctx, map) {
    const key = toJS(this.key, '', ctx)
    if (map instanceof Map) {
      const value = toJS(this.value, key, ctx)
      map.set(key, value)
    } else if (map instanceof Set) {
      map.add(key)
    } else {
      const stringKey = stringifyKey(this.key, key, ctx)
      const value = toJS(this.value, stringKey, ctx)
      if (stringKey in map)
        Object.defineProperty(map, stringKey, {
          value,
          writable: true,
          enumerable: true,
          configurable: true
        })
      else map[stringKey] = value
    }
    return map
  }

  toJSON(_, ctx) {
    const pair = ctx && ctx.mapAsMap ? new Map() : {}
    return this.addToJSMap(ctx, pair)
  }

  toString(ctx, onComment, onChompKeep) {
    if (!ctx || !ctx.doc) return JSON.stringify(this)
    const { indent: indentSize, indentSeq, simpleKeys } = ctx.doc.options
    let { key, value } = this
    let keyComment = key instanceof Node && key.comment
    if (simpleKeys) {
      if (keyComment) {
        throw new Error('With simple keys, key nodes cannot have comments')
      }
      if (key instanceof Collection) {
        const msg = 'With simple keys, collection cannot be used as a key value'
        throw new Error(msg)
      }
    }
    let explicitKey =
      !simpleKeys &&
      (!key ||
        (keyComment && value == null) ||
        (key instanceof Node
          ? key instanceof Collection ||
            key.type === Type.BLOCK_FOLDED ||
            key.type === Type.BLOCK_LITERAL
          : typeof key === 'object'))
    const { allNullValues, doc, indent, indentStep, stringify } = ctx
    ctx = Object.assign({}, ctx, {
      allNullValues: false,
      implicitKey: !explicitKey && (simpleKeys || !allNullValues),
      indent: indent + indentStep
    })
    let chompKeep = false
    let str = stringify(
      key,
      ctx,
      () => (keyComment = null),
      () => (chompKeep = true)
    )
    if (!explicitKey && !ctx.inFlow && str.length > 1024) {
      if (simpleKeys)
        throw new Error(
          'With simple keys, single line scalar must not span more than 1024 characters'
        )
      explicitKey = true
    }

    if (
      (allNullValues && (!simpleKeys || ctx.inFlow)) ||
      (value == null && (explicitKey || ctx.inFlow))
    ) {
      str = addComment(str, ctx.indent, keyComment)
      if (this.comment) {
        if (keyComment && !this.comment.includes('\n'))
          str += `\n${ctx.indent || ''}#${this.comment}`
        else str = addComment(str, ctx.indent, this.comment)
        if (onComment) onComment()
      } else if (chompKeep && !keyComment && onChompKeep) onChompKeep()
      return ctx.inFlow && !explicitKey ? str : `? ${str}`
    }

    str = explicitKey
      ? `? ${addComment(str, ctx.indent, keyComment)}\n${indent}:`
      : addComment(`${str}:`, ctx.indent, keyComment)
    if (this.comment) {
      if (keyComment && !explicitKey && !this.comment.includes('\n'))
        str += `\n${ctx.indent || ''}#${this.comment}`
      else str = addComment(str, ctx.indent, this.comment)
      if (onComment) onComment()
    }

    let vcb = ''
    let valueComment = null
    if (value instanceof Node) {
      if (value.spaceBefore) vcb = '\n'
      if (value.commentBefore) {
        const cs = value.commentBefore.replace(/^/gm, `${ctx.indent}#`)
        vcb += `\n${cs}`
      }
      valueComment = value.comment
    } else if (value && typeof value === 'object') {
      value = doc.createNode(value)
    }
    ctx.implicitKey = false
    if (!explicitKey && !keyComment && !this.comment && value instanceof Scalar)
      ctx.indentAtStart = str.length + 1
    chompKeep = false
    if (
      !indentSeq &&
      indentSize >= 2 &&
      !ctx.inFlow &&
      !explicitKey &&
      value instanceof YAMLSeq &&
      value.type !== Type.FLOW_SEQ &&
      !value.tag &&
      !doc.anchors.getName(value)
    ) {
      // If indentSeq === false, consider '- ' as part of indentation where possible
      ctx.indent = ctx.indent.substr(2)
    }
    const valueStr = stringify(
      value,
      ctx,
      () => (valueComment = null),
      () => (chompKeep = true)
    )
    let ws = ' '
    if (vcb || keyComment || this.comment) {
      ws = `${vcb}\n${ctx.indent}`
    } else if (!explicitKey && value instanceof Collection) {
      const flow = valueStr[0] === '[' || valueStr[0] === '{'
      if (!flow || valueStr.includes('\n')) ws = `\n${ctx.indent}`
    } else if (valueStr[0] === '\n') ws = ''
    if (chompKeep && !valueComment && onChompKeep) onChompKeep()
    return addComment(str + ws + valueStr, ctx.indent, valueComment)
  }
}
