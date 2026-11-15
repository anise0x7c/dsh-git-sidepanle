/**
 * Stand-in for the host's shared context-menu trigger bindings.
 *
 * Mirrors the shipped binding (`@deepseek-ai/dsh-client-ui-context-menu`):
 * existing handlers run first, a prevented event keeps its owner, pointer
 * positions come from the event, and keyboard gestures use the row's lower edge.
 */

/**
 * Build the trigger stand-in handed to slots as `props.useContextMenu`.
 * @returns {{opens: object[], useContextMenu: () => object}} recorder and hook.
 */
export function createMenuMock() {
  const opens = []
  return {
    opens,
    useContextMenu: () => ({
      getTriggerProps(target, handlers = {}) {
        const show = (event, x, y) => {
          if (event.defaultPrevented) return
          event.preventDefault()
          event.stopPropagation()
          opens.push({ target, point: { x, y } })
        }
        return {
          ...handlers,
          tabIndex: handlers.tabIndex ?? 0,
          onContextMenu(event) {
            handlers.onContextMenu?.(event)
            const rect = event.clientX === 0 && event.clientY === 0
              ? event.currentTarget.getBoundingClientRect()
              : undefined
            show(event, rect?.left ?? event.clientX, rect?.bottom ?? event.clientY)
          },
          onKeyDown(event) {
            handlers.onKeyDown?.(event)
            if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return
            if (!(event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey)) return
            const rect = event.currentTarget.getBoundingClientRect()
            show(event, rect.left, rect.bottom)
          },
        }
      },
    }),
  }
}
