/**
 * Plugin assembly for the browser half.
 *
 * Registers the two right-Sidebar tab types — the source-control panel and its
 * unified diff — the guide entry, the toggle shortcut and the context-menu
 * contribution. `apply` owns every registration and side effect (through
 * `ctx.effect`), so the bundle factory stays side-effect free. All repository
 * work travels over the bundle's guarded Host route; the modules under
 * src/client/ only render and ask for it.
 */

import type React from 'react'
import {
  DIFF_ID,
  DIFF_KIND,
  GIT_ID,
  GIT_KIND,
  GIT_SHORTCUT,
  MENU_CONTRIBUTION_ID,
  MENU_TARGET,
  NS,
} from './constants.ts'
import { DiffPanel } from './diff/DiffPanel.ts'
import { GitBranchIcon } from './icons.ts'
import { en } from './locale/en.ts'
import { zh } from './locale/zh.ts'
import { resolveMenuActions } from './menu/actions.ts'
import { GitPanel } from './panel/GitPanel.ts'
import { installStyles } from './styles.ts'
import { DiffTabTitle, GitTabTitle } from './titles.ts'
import { createToastStore, type Notify } from './toast/notify.ts'
import { hostToast, ToastHost } from './toast/ToastHost.ts'
import type {
  ClientContext,
  ClientServices,
  ContextMenusService,
  SidebarRightTabDefinition,
  SlotRegisterOptions,
} from './types/dsh.ts'

export const inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight']

/** The two keyed Slot seats the plugin registers bodies and titles into. */
type PaneSlotName = 'sidebar.right.pane.tab' | 'sidebar.right.pane.tab.title'

/**
 * Register one component into a keyed right-Sidebar pane Slot, scoped to the
 * plugin lifetime. Every pane body and title registration shares this shape.
 * @param ctx - client root context.
 * @param name - Slot name.
 * @param key - tab id the component renders for.
 * @param component - body or title component.
 * @param label - effect label for diagnostics.
 * @param inject - extra props this one registration receives from the Slot.
 */
function registerPaneSlot<Props extends object>(
  ctx: ClientContext,
  name: PaneSlotName,
  key: string,
  component: React.ComponentType<Props>,
  label: string,
  inject?: () => Readonly<Record<string, unknown>>,
): void {
  const options: SlotRegisterOptions =
    inject === undefined ? { name, key, locale: NS } : { name, key, locale: NS, inject }
  ctx.effect(() => ctx.slots.inject(name, () => ctx.slots.register(options, component)), label)
}

/** Labels for the two failure points of an optional-service binding. */
interface OptionalServiceLabels {
  /** Logged when the service is unavailable or the binding itself throws. */
  readonly bind: string
  /** Logged when a registration made inside the binding throws. */
  readonly register: string
}

/**
 * Bind one optional client service without letting its absence or a throwing
 * registration abort the rest of `apply`. The two failure points stay distinct
 * so the console still names the service that could not be bound.
 * @param ctx - client root context.
 * @param service - service to inject.
 * @param labels - messages for the binding and registration failure points.
 * @param register - registers one effect through the scoped context.
 */
function withOptionalService<Service extends keyof ClientServices>(
  ctx: ClientContext,
  service: Service,
  labels: OptionalServiceLabels,
  register: (scoped: ClientContext & Required<Pick<ClientServices, Service>>) => void,
): void {
  try {
    ctx.inject([service], (scoped) => {
      try {
        register(scoped)
      } catch (error) {
        console.warn(labels.register, error)
      }
    })
  } catch (error) {
    console.warn(labels.bind, error)
  }
}

/**
 * Client plugin body: register the tab types, their keyed bodies and titles,
 * dictionaries, the toggle shortcut and the context-menu contribution.
 * @param ctx - client root context carrying the registries and navigation service.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  // One single-notice store backs every success and failure notice. The
  // guarded native Toast host renders it; when the host provides no Toast
  // component the same callback falls back to the shared notification service.
  const toasts = createToastStore()
  // The shared notification service is optional and can be rebound over the
  // plugin lifetime. This stable delegate is what the Git and diff panes
  // receive through their Slot registrations; it contains a failing delivery
  // so Git actions and refreshes still finish.
  let sharedToast: ContextMenusService | undefined
  const notify: Notify = (text, success = false, action) => {
    if (hostToast !== undefined) {
      toasts.push({ text, success, ...(action === undefined ? {} : { action }) })
      return
    }
    try {
      sharedToast?.notify(text, success)
    } catch (error) {
      console.warn('[git-graph] shared toast failed', error)
    }
  }
  ctx.effect(() => installStyles(), 'git-graph: styles')
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'git-graph: dictionaries')
  if (hostToast !== undefined) {
    ctx.effect(
      () =>
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'git-graph.toast',
              locale: NS,
              inject: () => ({ store: toasts }),
            },
            ToastHost,
          ),
        ),
      'git-graph: native toast host',
    )
  }

  const gitTab: SidebarRightTabDefinition = {
    id: GIT_ID,
    kind: GIT_KIND,
    priority: 'extension',
    title: () => t('title'),
    guide: [
      {
        id: 'source-control',
        commandId: GIT_SHORTCUT,
        order: 20,
        title: () => t('guideTitle'),
        description: () => t('guideDescription'),
        icon: GitBranchIcon,
      },
    ],
  }
  ctx.effect(() => ctx.sidebarRightTabs.register(gitTab), 'git-graph: git tab type')

  ctx.effect(
    () =>
      ctx.sidebarRightTabs.register({
        id: DIFF_ID,
        kind: DIFF_KIND,
        title: () => t('diff.title'),
      }),
    'git-graph: diff tab type',
  )

  registerPaneSlot(
    ctx,
    'sidebar.right.pane.tab',
    GIT_ID,
    GitPanel,
    'git-graph: git tab body',
    () => ({ notify }),
  )
  registerPaneSlot(
    ctx,
    'sidebar.right.pane.tab.title',
    GIT_ID,
    GitTabTitle,
    'git-graph: git tab title',
  )
  registerPaneSlot(
    ctx,
    'sidebar.right.pane.tab',
    DIFF_ID,
    DiffPanel,
    'git-graph: diff tab body',
    () => ({
      notify,
    }),
  )
  registerPaneSlot(
    ctx,
    'sidebar.right.pane.tab.title',
    DIFF_ID,
    DiffTabTitle,
    'git-graph: diff tab title',
  )

  withOptionalService(
    ctx,
    'shortcuts',
    {
      bind: '[git-graph] shortcut registration failed',
      register: '[git-graph] shortcut registration failed',
    },
    (shortcutCtx) => {
      shortcutCtx.effect(
        () =>
          shortcutCtx.shortcuts.register({
            id: GIT_SHORTCUT,
            label: () => t('title'),
            aliases: ['git', 'source control', 'source-control'],
            defaults: {
              'desktop:macos': { code: 'KeyG', modifiers: ['primary', 'shift'] },
              'desktop:windows': { code: 'KeyG', modifiers: ['primary', 'shift'] },
              'desktop:linux': { code: 'KeyG', modifiers: ['primary', 'shift'] },
              'web:macos': { code: 'KeyG', modifiers: ['primary', 'shift'] },
              'web:windows': { code: 'KeyG', modifiers: ['primary', 'shift'] },
            },
            regions: ['page', 'editable', 'terminal'],
            modals: [],
            resolve: ({ target }) => {
              const resolved = ctx.sidebarRight.commandTarget(target)
              if (resolved === undefined)
                return { status: 'blocked', reason: t('shortcut.noSession') }
              return {
                status: 'handled',
                run: () => {
                  ctx.sidebarRight.openTabFromTarget(GIT_KIND, resolved)
                },
              }
            },
          }),
        'git-graph: toggle shortcut',
      )
    },
  )

  withOptionalService(
    ctx,
    'contextMenus',
    {
      bind: '[git-graph] context menu binding failed',
      register: '[git-graph] context menu registration failed',
    },
    (menuCtx) => {
      // Bind the current shared notification service for the fallback
      // delegate and unbind that exact service when this scope is disposed.
      menuCtx.effect(() => {
        const service = menuCtx.contextMenus
        sharedToast = service
        return () => {
          if (sharedToast === service) sharedToast = undefined
        }
      }, 'git-graph: shared toast')
      // The shared registry calls a contribution with the value captured
      // by the trigger, not with the { kind, value } target the trigger
      // received. Unwrapping again here leaves every menu empty.
      menuCtx.effect(
        () =>
          menuCtx.contextMenus.register({
            id: MENU_CONTRIBUTION_ID,
            target: MENU_TARGET,
            order: 10,
            resolve: (value) => resolveMenuActions(value, t, notify),
          }),
        'git-graph: context menu actions',
      )
    },
  )
}
