import { YAMLReferenceError } from '../errors'

export const binary = {
  tag: 'tag:yaml.org,2002:binary',
  /**
   * Returns a Buffer in node and an Uint8Array in browsers
   *
   * To use the resulting buffer as an image, you'll want to do something like:
   *
   *   const blob = new Blob([buffer], { type: 'image/jpeg' })
   *   document.querySelector('#photo').src = URL.createObjectURL(blob)
   */
  resolve: (doc, node) => {
    if (typeof Buffer === 'function') {
      return Buffer.from(node.strValue, 'base64')
    } else if (typeof atob === 'function') {
      const str = atob(node.strValue)
      const buffer = new Uint8Array(str.length)
      for (let i = 0; i < str.length; ++i) buffer[i] = str.charCodeAt(i)
      return buffer
    } else {
      doc.errors.push(new YAMLReferenceError(node,
        'This environment does not support reading binary tags; either Buffer or atob is required'))
      return null
    }
  },
  class: Uint8Array,  // Buffer inherits from Uint8Array
  stringify: (value) => {
    let str
    if (typeof Buffer === 'function') {
      str = value instanceof Buffer ? (
        value.toString('base64')
      ) : (
        Buffer.from(value.buffer).toString('base64')
      )
    } else if (typeof btoa === 'function') {
      let s = ''
      for (let i = 0; i < value.length; ++i) s += String.fromCharCode(buf[i])
      str = btoa(s)
    } else {
      throw new Error('This environment does not support writing binary tags; either Buffer or btoa is required')
    }
    const lineLength = 76
    const n = Math.ceil(str.length / lineLength)
    const lines = new Array(n)
    for (let i = 0, o = 0; i < n; ++i, o += lineLength) {
      lines[i] = str.substr(o, lineLength)
    }
    return lines.join('\n')
  }
}

export default [
  binary
]
