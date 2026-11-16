/**
 * Stand-in for the host's shared context-menu trigger bindings.
 *
 * Mirrors the shipped binding (`@deepseek-ai/dsh-client-ui-context-menu`):
 * existing handlers run first, a prevented event keeps its owner, pointer
 * positions come from the event, and keyboard gestures use the row's lower edge.
 */
import type {
  CapturedTarget,
  MenuMock,
  MenuTriggerBindings,
  MenuTriggerHandlers,
  MenuTriggerProps,
  TestEvent,
} from './types.ts'

/**
 * Build the trigger stand-in handed to slots as `props.useContextMenu`.
 * @returns recorder and hook.
 */
export function createMenuMock(): MenuMock {
  const opens: MenuMock['opens'] = []
  const useContextMenu = (): MenuTriggerBindings => ({
    getTriggerProps(target: CapturedTarget, handlers: MenuTriggerHandlers = {}): MenuTriggerProps {
      const show = (event: TestEvent, x: number, y: number) => {
        if (event.defaultPrevented === true) return
        event.preventDefault()
        event.stopPropagation()
        opens.push({ target, point: { x, y } })
      }
      return {
        ...handlers,
        tabIndex: handlers.tabIndex ?? 0,
        onContextMenu(event: TestEvent) {
          handlers.onContextMenu?.(event)
          const rect =
            event.clientX === 0 && event.clientY === 0
              ? event.currentTarget?.getBoundingClientRect()
              : undefined
          show(event, rect?.left ?? event.clientX ?? 0, rect?.bottom ?? event.clientY ?? 0)
        },
        onKeyDown(event: TestEvent) {
          handlers.onKeyDown?.(event)
          if (
            event.defaultPrevented === true ||
            event.repeat === true ||
            event.ctrlKey === true ||
            event.altKey === true ||
            event.metaKey === true
          )
            return
          if (!(event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey === true)))
            return
          const rect = event.currentTarget?.getBoundingClientRect() ?? { left: 0, bottom: 0 }
          show(event, rect.left, rect.bottom)
        },
      }
    },
  })
  return { opens, useContextMenu }
}
