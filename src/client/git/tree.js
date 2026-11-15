/**
 * Pure folder-tree construction for the three change groups.
 */

export function buildTree(entries) {
  const root = { type: 'root', name: '', path: '', children: [], folders: new Map() }
  for (const entry of entries) {
    const parts = entry.path.split('/')
    let node = root
    for (let index = 0; index < parts.length - 1; index += 1) {
      const name = parts[index]
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

export function collectTreePaths(node) {
  if (node.type !== 'folder') return [node.path]
  const paths = []
  for (const child of node.children) paths.push(...collectTreePaths(child))
  return paths
}
