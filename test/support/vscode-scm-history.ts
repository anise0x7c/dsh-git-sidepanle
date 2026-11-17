/**
 * A literal, DOM-free transcription of VS Code's Source Control Graph model and
 * renderer, used only as an oracle by the equivalence tests.
 *
 * Source: microsoft/vscode `src/vs/workbench/contrib/scm/browser/scmHistory.ts`
 * (`toISCMHistoryItemViewModelArray`, `getLabelColorIdentifier`,
 * `renderSCMHistoryItemGraph`, `compareHistoryItemRefs`).
 * Copyright (c) Microsoft Corporation. Licensed under the MIT License.
 *
 * Kept deliberately close to the original statement by statement, including
 * the parentless-commit behavior the plugin's port intentionally changes, so a
 * divergence in the port shows up as a test failure instead of being copied.
 * SVG elements are replaced by `{ d, color }` records in the order VS Code
 * appends them; incoming/outgoing change rows are not modeled.
 */

/** VS Code `SWIMLANE_HEIGHT`. */
const SWIMLANE_HEIGHT = 22
/** VS Code `SWIMLANE_WIDTH`. */
const SWIMLANE_WIDTH = 11
/** VS Code `SWIMLANE_CURVE_RADIUS`. */
const SWIMLANE_CURVE_RADIUS = 5

/** VS Code `colorRegistry`, as the plugin's identifiers. */
const colorRegistry = ['lane1', 'lane2', 'lane3', 'lane4', 'lane5']
/** VS Code `historyItemRefColor`. */
const historyItemRefColor = 'ref'

/** VS Code `ISCMHistoryItemRef`, reduced. */
export interface OracleRef {
  id: string
  name: string
  /**
   * VS Code models this field as `string | undefined`. It stays optional so
   * inputs may omit it, while an explicit `undefined` survives the copy.
   */
  color?: string | undefined
}

/** VS Code `ISCMHistoryItem`, reduced. */
export interface OracleItem {
  id: string
  parentIds: string[]
  references?: OracleRef[]
}

/** VS Code `ISCMHistoryItemGraphNode`. */
export interface OracleNode {
  id: string
  color: string
}

/** VS Code `ISCMHistoryItemViewModel`, reduced. */
export interface OracleViewModel {
  historyItem: OracleItem
  kind: 'HEAD' | 'node'
  inputSwimlanes: OracleNode[]
  outputSwimlanes: OracleNode[]
}

/** One rendered SVG element. */
export interface OracleRender {
  paths: { d: string; color: string }[]
  circleIndex: number
  circleColor: string
  width: number
}

/**
 * VS Code `rot`.
 * @param index - index.
 * @param modulo - modulo.
 * @returns rotated index.
 */
function rot(index: number, modulo: number): number {
  return (modulo + (index % modulo)) % modulo
}

/**
 * VS Code `getLabelColorIdentifier`, without the incoming/outgoing branches.
 * @param historyItem - history item.
 * @param colorMap - color map.
 * @returns color, or undefined.
 */
function getLabelColorIdentifier(
  historyItem: OracleItem,
  colorMap: Map<string, string | undefined>,
): string | undefined {
  for (const ref of historyItem.references ?? []) {
    const colorIdentifier = colorMap.get(ref.id)
    if (colorIdentifier !== undefined) {
      return colorIdentifier
    }
  }
  return undefined
}

/**
 * VS Code `toISCMHistoryItemViewModelArray`, without incoming/outgoing rows.
 * @param historyItems - history items.
 * @param colorMap - color map.
 * @param currentHistoryItemRef - current reference.
 * @param currentHistoryItemRemoteRef - remote reference.
 * @param currentHistoryItemBaseRef - base reference.
 * @returns view models.
 */
export function toViewModels(
  historyItems: OracleItem[],
  colorMap = new Map<string, string | undefined>(),
  currentHistoryItemRef?: { id: string; revision?: string },
  currentHistoryItemRemoteRef?: { id: string },
  currentHistoryItemBaseRef?: { id: string },
): OracleViewModel[] {
  let colorIndex = -1
  const viewModels: OracleViewModel[] = []

  for (let index = 0; index < historyItems.length; index++) {
    const historyItem = historyItems[index] as OracleItem

    const kind = historyItem.id === currentHistoryItemRef?.revision ? 'HEAD' : 'node'
    const outputSwimlanesFromPreviousItem = viewModels.at(-1)?.outputSwimlanes ?? []
    const inputSwimlanes = outputSwimlanesFromPreviousItem.map((i) => ({ ...i }))
    const outputSwimlanes: OracleNode[] = []

    let firstParentAdded = false

    // Add first parent to the output
    if (historyItem.parentIds.length > 0) {
      for (const node of inputSwimlanes) {
        if (node.id === historyItem.id) {
          if (!firstParentAdded) {
            outputSwimlanes.push({
              id: historyItem.parentIds[0] as string,
              color: getLabelColorIdentifier(historyItem, colorMap) ?? node.color,
            })
            firstParentAdded = true
          }

          continue
        }

        outputSwimlanes.push({ ...node })
      }
    }

    // Add unprocessed parent(s) to the output
    for (let i = firstParentAdded ? 1 : 0; i < historyItem.parentIds.length; i++) {
      // Color index (label -> next color)
      let colorIdentifier: string | undefined

      if (i === 0) {
        colorIdentifier = getLabelColorIdentifier(historyItem, colorMap)
      } else {
        const historyItemParent = historyItems.find((h) => h.id === historyItem.parentIds[i])
        colorIdentifier = historyItemParent
          ? getLabelColorIdentifier(historyItemParent, colorMap)
          : undefined
      }

      if (!colorIdentifier) {
        colorIndex = rot(colorIndex + 1, colorRegistry.length)
        colorIdentifier = colorRegistry[colorIndex]
      }

      outputSwimlanes.push({
        id: historyItem.parentIds[i] as string,
        color: colorIdentifier as string,
      })
    }

    // Add colors to references
    const references = (historyItem.references ?? []).map((ref) => {
      let color = colorMap.get(ref.id)
      if (colorMap.has(ref.id) && color === undefined) {
        // Find the history item in the input swimlanes
        const inputIndex = inputSwimlanes.findIndex((node) => node.id === historyItem.id)

        // Circle index - use the input swimlane index if present, otherwise add it to the end
        const circleIndex = inputIndex !== -1 ? inputIndex : inputSwimlanes.length

        // Circle color - use the output swimlane color if present, otherwise the input swimlane color
        color =
          circleIndex < outputSwimlanes.length
            ? outputSwimlanes[circleIndex]?.color
            : circleIndex < inputSwimlanes.length
              ? inputSwimlanes[circleIndex]?.color
              : historyItemRefColor
      }

      return { ...ref, color }
    })

    // Sort references
    references.sort((ref1, ref2) =>
      compareHistoryItemRefs(
        ref1,
        ref2,
        currentHistoryItemRef,
        currentHistoryItemRemoteRef,
        currentHistoryItemBaseRef,
      ),
    )

    viewModels.push({
      historyItem: { ...historyItem, references },
      kind,
      inputSwimlanes,
      outputSwimlanes,
    })
  }

  return viewModels
}

/**
 * VS Code `compareHistoryItemRefs`.
 * @param ref1 - left.
 * @param ref2 - right.
 * @param currentHistoryItemRef - current.
 * @param currentHistoryItemRemoteRef - remote.
 * @param currentHistoryItemBaseRef - base.
 * @returns order.
 */
function compareHistoryItemRefs(
  ref1: OracleRef,
  ref2: OracleRef,
  currentHistoryItemRef?: { id: string },
  currentHistoryItemRemoteRef?: { id: string },
  currentHistoryItemBaseRef?: { id: string },
): number {
  const getHistoryItemRefOrder = (ref: OracleRef) => {
    if (ref.id === currentHistoryItemRef?.id) {
      return 1
    } else if (ref.id === currentHistoryItemRemoteRef?.id) {
      return 2
    } else if (ref.id === currentHistoryItemBaseRef?.id) {
      return 3
    } else if (ref.color !== undefined) {
      return 4
    }

    return 99
  }

  // Assign order (current > remote > base > color)
  const ref1Order = getHistoryItemRefOrder(ref1)
  const ref2Order = getHistoryItemRefOrder(ref2)

  return ref1Order - ref2Order
}

/**
 * VS Code `findLastIndex`.
 * @param nodes - nodes.
 * @param id - id.
 * @returns index.
 */
function findLastIndex(nodes: OracleNode[], id: string): number {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (nodes[i]?.id === id) {
      return i
    }
  }

  return -1
}

/**
 * VS Code `renderSCMHistoryItemGraph`, recording paths instead of SVG nodes.
 * @param historyItemViewModel - view model.
 * @returns rendered paths and node data.
 */
export function renderGraph(historyItemViewModel: OracleViewModel): OracleRender {
  const paths: { d: string; color: string }[] = []
  const historyItem = historyItemViewModel.historyItem
  const inputSwimlanes = historyItemViewModel.inputSwimlanes
  const outputSwimlanes = historyItemViewModel.outputSwimlanes

  // Find the history item in the input swimlanes
  const inputIndex = inputSwimlanes.findIndex((node) => node.id === historyItem.id)

  // Circle index - use the input swimlane index if present, otherwise add it to the end
  const circleIndex = inputIndex !== -1 ? inputIndex : inputSwimlanes.length

  // Circle color - use the output swimlane color if present, otherwise the input swimlane color
  const circleColor =
    circleIndex < outputSwimlanes.length
      ? (outputSwimlanes[circleIndex] as OracleNode).color
      : circleIndex < inputSwimlanes.length
        ? (inputSwimlanes[circleIndex] as OracleNode).color
        : historyItemRefColor

  let outputSwimlaneIndex = 0
  for (let index = 0; index < inputSwimlanes.length; index++) {
    const color = (inputSwimlanes[index] as OracleNode).color

    // Current commit
    if (inputSwimlanes[index]?.id === historyItem.id) {
      // Base commit
      if (index !== circleIndex) {
        const d: string[] = []

        // Draw /
        d.push(`M ${SWIMLANE_WIDTH * (index + 1)} 0`)
        d.push(
          `A ${SWIMLANE_WIDTH} ${SWIMLANE_WIDTH} 0 0 1 ${SWIMLANE_WIDTH * index} ${SWIMLANE_WIDTH}`,
        )

        // Draw -
        d.push(`H ${SWIMLANE_WIDTH * (circleIndex + 1)}`)

        paths.push({ d: d.join(' '), color })
      } else {
        outputSwimlaneIndex++
      }
    } else {
      // Not the current commit
      if (
        outputSwimlaneIndex < outputSwimlanes.length &&
        inputSwimlanes[index]?.id === outputSwimlanes[outputSwimlaneIndex]?.id
      ) {
        if (index === outputSwimlaneIndex) {
          // Draw |
          paths.push({
            d: `M ${SWIMLANE_WIDTH * (index + 1)} 0 V ${SWIMLANE_HEIGHT}`,
            color,
          })
        } else {
          const d: string[] = []

          // Draw |
          d.push(`M ${SWIMLANE_WIDTH * (index + 1)} 0`)
          d.push('V 6')

          // Draw /
          d.push(
            `A ${SWIMLANE_CURVE_RADIUS} ${SWIMLANE_CURVE_RADIUS} 0 0 1 ${SWIMLANE_WIDTH * (index + 1) - SWIMLANE_CURVE_RADIUS} ${SWIMLANE_HEIGHT / 2}`,
          )

          // Draw -
          d.push(`H ${SWIMLANE_WIDTH * (outputSwimlaneIndex + 1) + SWIMLANE_CURVE_RADIUS}`)

          // Draw /
          d.push(
            `A ${SWIMLANE_CURVE_RADIUS} ${SWIMLANE_CURVE_RADIUS} 0 0 0 ${SWIMLANE_WIDTH * (outputSwimlaneIndex + 1)} ${SWIMLANE_HEIGHT / 2 + SWIMLANE_CURVE_RADIUS}`,
          )

          // Draw |
          d.push(`V ${SWIMLANE_HEIGHT}`)

          paths.push({ d: d.join(' '), color })
        }

        outputSwimlaneIndex++
      }
    }
  }

  // Add remaining parent(s)
  for (let i = 1; i < historyItem.parentIds.length; i++) {
    const parentOutputIndex = findLastIndex(outputSwimlanes, historyItem.parentIds[i] as string)
    if (parentOutputIndex === -1) {
      continue
    }

    // Draw -\
    const d: string[] = []

    // Draw \
    d.push(`M ${SWIMLANE_WIDTH * parentOutputIndex} ${SWIMLANE_HEIGHT / 2}`)
    d.push(
      `A ${SWIMLANE_WIDTH} ${SWIMLANE_WIDTH} 0 0 1 ${SWIMLANE_WIDTH * (parentOutputIndex + 1)} ${SWIMLANE_HEIGHT}`,
    )

    // Draw -
    d.push(`M ${SWIMLANE_WIDTH * parentOutputIndex} ${SWIMLANE_HEIGHT / 2}`)
    d.push(`H ${SWIMLANE_WIDTH * (circleIndex + 1)} `)

    paths.push({ d: d.join(' '), color: (outputSwimlanes[parentOutputIndex] as OracleNode).color })
  }

  // Draw | to *
  if (inputIndex !== -1) {
    paths.push({
      d: `M ${SWIMLANE_WIDTH * (circleIndex + 1)} 0 V ${SWIMLANE_HEIGHT / 2}`,
      color: (inputSwimlanes[inputIndex] as OracleNode).color,
    })
  }

  // Draw | from *
  if (historyItem.parentIds.length > 0) {
    paths.push({
      d: `M ${SWIMLANE_WIDTH * (circleIndex + 1)} ${SWIMLANE_HEIGHT / 2} V ${SWIMLANE_HEIGHT}`,
      color: circleColor,
    })
  }

  return {
    paths,
    circleIndex,
    circleColor,
    width: SWIMLANE_WIDTH * (Math.max(inputSwimlanes.length, outputSwimlanes.length, 1) + 1),
  }
}
