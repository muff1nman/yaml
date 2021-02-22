import type { Node, Scalar, YAMLMap, YAMLSeq } from '../ast/index.js'
import type { CreateNodeContext } from '../doc/createNode.js'
import type { Schema } from '../doc/Schema.js'
import type { StringifyContext } from '../stringify/stringify.js'

export type SchemaId = 'core' | 'failsafe' | 'json' | 'yaml11'

export type TagId =
  | 'binary'
  | 'bool'
  | 'float'
  | 'floatExp'
  | 'floatNaN'
  | 'floatTime'
  | 'int'
  | 'intHex'
  | 'intOct'
  | 'intTime'
  | 'null'
  | 'omap'
  | 'pairs'
  | 'set'
  | 'timestamp'

export interface Tag {
  /**
   * An optional factory function, used e.g. by collections when wrapping JS objects as AST nodes.
   */
  createNode?: <T = unknown>(
    schema: Schema,
    value: T,
    ctx: CreateNodeContext
  ) => YAMLMap | YAMLSeq | Scalar<T>

  /**
   * If `true`, together with `test` allows for values to be stringified without
   * an explicit tag. For most cases, it's unlikely that you'll actually want to
   * use this, even if you first think you do.
   */
  default: boolean

  /**
   * If a tag has multiple forms that should be parsed and/or stringified differently, use `format` to identify them.
   */
  format?: string

  /**
   * Used by `YAML.createNode` to detect your data type, e.g. using `typeof` or
   * `instanceof`.
   */
  identify(value: any): boolean

  /**
   * The `Node` child class that implements this tag. Required for collections and tags that have overlapping JS representations.
   */
  nodeClass?: new () => any

  /**
   * Used by some tags to configure their stringification, where applicable.
   */
  options?: object

  /**
   * Turns a value into an AST node.
   * If returning a non-`Node` value, the output will be wrapped as a `Scalar`.
   */
  resolve(
    value: string | YAMLMap | YAMLSeq,
    onError: (message: string) => void
  ): Node | any

  /**
   * Optional function stringifying the AST node in the current context. If your
   * data includes a suitable `.toString()` method, you can probably leave this
   * undefined and use the default stringifier.
   *
   * @param item The node being stringified.
   * @param ctx Contains the stringifying context variables.
   * @param onComment Callback to signal that the stringifier includes the
   *   item's comment in its output.
   * @param onChompKeep Callback to signal that the output uses a block scalar
   *   type with the `+` chomping indicator.
   */
  stringify?: (
    item: Node,
    ctx: StringifyContext,
    onComment?: () => void,
    onChompKeep?: () => void
  ) => string

  /**
   * The identifier for your data type, with which its stringified form will be
   * prefixed. Should either be a !-prefixed local `!tag`, or a fully qualified
   * `tag:domain,date:foo`.
   */
  tag: string

  /**
   * Together with `default` allows for values to be stringified without an
   * explicit tag and detected using a regular expression. For most cases, it's
   * unlikely that you'll actually want to use these, even if you first think
   * you do.
   */
  test?: RegExp
}