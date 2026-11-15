// @ts-check
/**
 * Pure folder-tree construction for the three change groups.
 *
 * `format.js` owns the row shape the file nodes carry; the node shapes below
 * describe the hierarchy `buildTree` produces for the panel renderer.
 */

/** @typedef {import('./format.js').ChangeEntry} ChangeEntry */

/**
 * A folder node: one directory level with its sorted children.
 * @typedef {object} TreeFolder
 * @property {'folder'} type - node discriminator.
 * @property {string} name - last path segment.
 * @property {string} path - full folder path.
 * @property {TreeNode[]} children - sorted child nodes.
 * @property {Map<string, TreeFolder>} folders - child folders by name.
 */

/**
 * A file node: one changed-file row at its tree position.
 * @typedef {object} TreeFile
 * @property {'file'} type - node discriminator.
 * @property {string} name - file name.
 * @property {string} path - full file path.
 * @property {ChangeEntry} entry - the row the panel renders.
 */

/** @typedef {TreeFolder | TreeFile} TreeNode */

/**
 * Internal container for the sort pass; never returned to callers.
 * @typedef {object} TreeRoot
 * @property {'root'} type - node discriminator.
 * @property {string} name
 * @property {string} path
 * @property {TreeNode[]} children
 * @property {Map<string, TreeFolder>} folders
 */

/**
 * Group change entries into the folder tree the panel renders.
 * Entries are sorted deterministically: folders before files, then by numeric-
 * aware case-insensitive name. Single-child folder chains stay nested.
 * @param {ChangeEntry[]} entries - changed-file rows.
 * @returns {TreeNode[]} sorted root-level nodes.
 */
export function buildTree(entries) {
  /** @type {TreeRoot} */
  const root = { type: 'root', name: '', path: '', children: [], folders: new Map() }
  for (const entry of entries) {
    const parts = entry.path.split('/')
    /** @type {TreeRoot | TreeFolder} */
    let node = root
    for (let index = 0; index < parts.length - 1; index += 1) {
      const name = parts[index]
      /** @type {TreeFolder | undefined} */
      let folder = node.folders.get(name)
      if (folder === undefined) {
        folder = {
          type: 'folder',
          name,
          path: parts.slice(0, index + 1).join('/'),
          children: [],
          folders: new Map(),
        }
        node.folders.set(name, folder)
        node.children.push(folder)
      }
      node = folder
    }
    node.children.push({ type: 'file', name: parts[parts.length - 1], path: entry.path, entry })
  }
  /**
   * Sort one level and recurse into its folders.
   * @param {TreeNode[]} nodes - nodes to sort in place.
   */
  const sort = (nodes) => {
    nodes.sort((left, right) => {
      const leftFolder = left.type === 'folder' ? 0 : 1
      const rightFolder = right.type === 'folder' ? 0 : 1
      if (leftFolder !== rightFolder) return leftFolder - rightFolder
      return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })
    })
    for (const node of nodes) if (node.type === 'folder') sort(node.children)
  }
  sort(root.children)
  return root.children
}

/**
 * List the file paths below a tree node.
 * @param {TreeNode} node - file or folder node.
 * @returns {string[]} the file's path, or every descendant file path for a folder in display order.
 */
export function collectTreePaths(node) {
  if (node.type !== 'folder') return [node.path]
  const paths = []
  for (const child of node.children) paths.push(...collectTreePaths(child))
  return paths
}
