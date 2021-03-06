import { Alias, Merge, Scalar, YAMLMap, YAMLSeq } from '../ast/index.js'

export class Anchors {
  static validAnchorNode(node) {
    return (
      node instanceof Scalar ||
      node instanceof YAMLSeq ||
      node instanceof YAMLMap
    )
  }

  map = Object.create(null)

  constructor(prefix) {
    this.prefix = prefix
  }

  createAlias(node, name) {
    this.setAnchor(node, name)
    return new Alias(node)
  }

  createMergePair(...sources) {
    const merge = new Merge()
    merge.value.items = sources.map(s => {
      if (s instanceof Alias) {
        if (s.source instanceof YAMLMap) return s
      } else if (s instanceof YAMLMap) {
        return this.createAlias(s)
      }
      throw new Error('Merge sources must be Map nodes or their Aliases')
    })
    return merge
  }

  getName(node) {
    const { map } = this
    return Object.keys(map).find(a => map[a] === node)
  }

  getNames() {
    return Object.keys(this.map)
  }

  getNode(name) {
    return this.map[name]
  }

  newName(prefix) {
    if (!prefix) prefix = this.prefix
    const names = Object.keys(this.map)
    for (let i = 1; true; ++i) {
      const name = `${prefix}${i}`
      if (!names.includes(name)) return name
    }
  }

  setAnchor(node, name) {
    const { map } = this
    if (!node) {
      if (!name) return null
      delete map[name]
      return name
    }

    if (!Anchors.validAnchorNode(node))
      throw new Error('Anchors may only be set for Scalar, Seq and Map nodes')
    if (name) {
      if (/[\x00-\x19\s,[\]{}]/.test(name))
        throw new Error(
          'Anchor names must not contain whitespace or control characters'
        )
      const prevNode = map[name]
      if (prevNode && prevNode !== node) map[this.newName(name)] = prevNode
    }

    const prevName = Object.keys(map).find(a => map[a] === node)
    if (prevName) {
      if (!name || prevName === name) return prevName
      delete map[prevName]
    } else if (!name) name = this.newName()
    map[name] = node
    return name
  }
}
