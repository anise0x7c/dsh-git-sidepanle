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
import { DIFF_ID, DIFF_KIND, GIT_ID, GIT_KIND, GIT_SHORTCUT, MENU_CONTRIBUTION_ID, MENU_TARGET, NS } from './constants.js'
import { DiffPanel } from './diff/DiffPanel.js'
import { GitBranchIcon } from './icons.js'
import { resolveMenuActions } from './menu/actions.js'
import { GitPanel } from './panel/GitPanel.js'
import { DiffTabTitle, GitTabTitle } from './titles.js'
import { en } from './locale/en.js'
import { zh } from './locale/zh.js'
import './styles.js'

const inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight']

function apply(ctx) {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'git-graph: dictionaries')

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: GIT_ID,
    kind: GIT_KIND,
    priority: 'extension',
    title: () => t('title'),
    guide: [{
      id: 'source-control',
      commandId: GIT_SHORTCUT,
      order: 20,
      title: () => t('guideTitle'),
      description: () => t('guideDescription'),
      icon: GitBranchIcon,
    }],
  }), 'git-graph: git tab type')

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: DIFF_ID,
    kind: DIFF_KIND,
    title: () => t('diff.title'),
  }), 'git-graph: diff tab type')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: GIT_ID,
    locale: NS,
  }, GitPanel)), 'git-graph: git tab body')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title',
    key: GIT_ID,
    locale: NS,
  }, GitTabTitle)), 'git-graph: git tab title')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: DIFF_ID,
    locale: NS,
  }, DiffPanel)), 'git-graph: diff tab body')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title',
    key: DIFF_ID,
    locale: NS,
  }, DiffTabTitle)), 'git-graph: diff tab title')

  try {
    ctx.inject(['shortcuts'], (shortcutCtx) => {
      try {
        shortcutCtx.effect(() => shortcutCtx.shortcuts.register({
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
          if (resolved === undefined) return { status: 'blocked', reason: t('shortcut.noSession') }
          return {
            status: 'handled',
            run: () => { ctx.sidebarRight.openTabFromTarget(GIT_KIND, resolved) },
          }
        },
        }), 'git-graph: toggle shortcut')
      } catch (error) {
        console.warn('[git-graph] shortcut registration failed', error)
      }
    })
  } catch (error) {
    console.warn('[git-graph] shortcut registration failed', error)
  }

  try {
    ctx.inject(['contextMenus'], (menuCtx) => {
      try {
        // The shared registry calls a contribution with the value captured
        // by the trigger, not with the { kind, value } target the trigger
        // received. Unwrapping again here leaves every menu empty.
        menuCtx.effect(() => menuCtx.contextMenus.register({
          id: MENU_CONTRIBUTION_ID,
          target: MENU_TARGET,
          order: 10,
          resolve: (value) => resolveMenuActions(
            value,
            t,
            (text, success) => menuCtx.contextMenus.notify(text, success),
          ),
        }), 'git-graph: context menu actions')
      } catch (error) {
        console.warn('[git-graph] context menu registration failed', error)
      }
    })
  } catch (error) {
    console.warn('[git-graph] context menu binding failed', error)
  }
}

export { inject, apply }
