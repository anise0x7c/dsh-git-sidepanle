/**
 * Minimal structural contracts for the DSH client services the browser half
 * consumes.
 *
 * The bundle must not import DSH client packages, so these interfaces mirror
 * the installed service shapes the plugin touches (locale, slots, right-Sidebar
 * tab registry and navigation, shortcuts, context menus) without adding a
 * dependency. Only the members this plugin uses are declared; extra runtime
 * fields on the real services are allowed structurally.
 */

import type React from 'react'

/** Placeholder values the locale binder interpolates. */
export type LocaleParams = Readonly<Record<string, number | string>>

/** Locale binder injected as `ctx.locale.bind(namespace)`. */
export type LocaleBinder = (key: string, params?: LocaleParams) => string

/** Locale service members used by the plugin. */
export interface LocaleService {
  /**
   * Register one namespace's dictionaries.
   * @param namespace - locale namespace.
   * @param dictionaries - language dictionaries keyed by language id.
   * @returns unregister.
   */
  register(
    namespace: string,
    dictionaries: Readonly<Record<string, Readonly<Record<string, string>>>>,
  ): () => void

  /**
   * Bind the dictionary lookup for one namespace.
   * @param namespace - locale namespace.
   * @returns translator for that namespace.
   */
  bind(namespace: string): LocaleBinder
}

/** Options of one keyed Slot registration. */
export interface SlotRegisterOptions {
  /** Slot name. */
  readonly name: string
  /** Key within the slot domain. */
  readonly key: string
  /** Locale namespace the component reads. */
  readonly locale: string
  /** Extra props the Slot merges into the registered component's own props. */
  readonly inject?: () => Readonly<Record<string, unknown>>
}

/** Slot service members used by the plugin. */
export interface SlotsService {
  /**
   * Run one registration while the slice is injected.
   * @param name - slot name.
   * @param callback - performs the registration and returns its disposer.
   * @returns disposer of the injected registration.
   */
  inject<Result>(name: string, callback: () => Result): () => void

  /**
   * Register one component into a keyed slot.
   * @param options - slot name, key and locale namespace.
   * @param component - slot body component.
   * @returns unregister.
   */
  register<Props extends object>(
    options: SlotRegisterOptions,
    component: React.ComponentType<Props>,
  ): () => void
}

/** Icon shape a tab definition may carry. */
export interface TabIconProps {
  /** Icon edge length in pixels. */
  readonly size?: number
  /** Extra class name. */
  readonly className?: string
}

/** Priority band of a tab type registration. */
export type SidebarRightTabPriority = 'extension' | 'builtin' | 'fallback'

/** One guide-page entry offered by a tab type. */
export interface SidebarRightGuideEntry {
  /** Stable entry id within the provider. */
  readonly id: string
  /** Effective shortcut shown on the entry. */
  readonly commandId?: string
  /** Ascending position among every registered type's entries. */
  readonly order: number
  /** Guide-card title in the current language. */
  readonly title: () => string
  /** One line explaining what picking the card opens. */
  readonly description?: () => string
  /** Optional glyph drawn before the title. */
  readonly icon?: React.ComponentType<TabIconProps>
}

/** Static face of one registered right-Sidebar tab type. */
export interface SidebarRightTabDefinition {
  /** Implementation identity; also the key its body and title register under. */
  readonly id: string
  /** Type discriminator `openTab` names. */
  readonly kind: string
  /** Defaults to `extension`. */
  readonly priority?: SidebarRightTabPriority
  /**
   * Initial chip text captured when the tab opens.
   * @param address - page address being opened.
   * @returns title in the current language.
   */
  readonly title: (address: string) => string
  /** Guide-page entries. */
  readonly guide?: readonly SidebarRightGuideEntry[]
}

/** Right-Sidebar tab-type registry used by the plugin. */
export interface SidebarRightTabsService {
  /**
   * Register one tab type.
   * @param definition - static face of the type.
   * @returns unregister.
   */
  register(definition: SidebarRightTabDefinition): () => void
}

/** Navigation options accepted by `tab.actions.openTab`. */
export interface SidebarRightOpenTabOptions {
  /** Land the tab in this pane. */
  readonly paneId?: string
  /** Prefer a new pane for new content. */
  readonly preferNewPane?: boolean
  /** Reveal existing content of the same address instead of duplicating it. */
  readonly revealIfOpened?: boolean
  /** Navigation parameters the body reads from `useTabInfo().tab.navigation.params`. */
  readonly params?: Readonly<Record<string, unknown>>
}

/** Actions one tab may take on itself. */
export interface SidebarRightTabActions {
  /**
   * Open a page type from this tab.
   * @param kind - the page type's kind.
   * @param options - placement and navigation parameters.
   */
  openTab(kind: string, options?: SidebarRightOpenTabOptions): void
  /** Close this tab. */
  close(): void
}

/** Where a tab was last navigated to. */
export interface SidebarRightTabNavigation {
  /** Address opened. */
  readonly address: string
  /** Opener's navigation parameters, undefined when it gave none. */
  readonly params?: Readonly<Record<string, unknown>>
  /** Incremented on every navigation to this tab. */
  readonly revision: number
}

/** Record identity of the tab a body draws. */
export interface SidebarRightTabRecord {
  /** Chip text captured when the tab opened. */
  readonly title: string
}

/** Live information shared by a tab's body and title. */
export interface SidebarRightTabInfo {
  readonly tab: SidebarRightTabRecord & {
    /** Whether this tab is currently visible. */
    readonly visible: boolean
    /** Current navigation record. */
    readonly navigation: SidebarRightTabNavigation
    /** Actions this tab may take. */
    readonly actions: SidebarRightTabActions
  }
}

/** Read current tab information through the slot framework. */
export type TabInfoHook = () => SidebarRightTabInfo

/** A page captured by the right Sidebar's navigation controller. */
export interface SidebarRightTarget {
  /** Session the page belongs to. */
  readonly sessionId: string
  /** Pane holding the page. */
  readonly paneId: string
  /** Whether the pane is docked or floating. */
  readonly host: 'dock' | 'float'
  /** Active tab when the target names one. */
  readonly tabId?: string
}

/** Right-Sidebar navigation commands used by the plugin. */
export interface SidebarRightService {
  /**
   * Read the page currently under a DOM element.
   * @param element - focused or pointer-activated element.
   * @returns captured page, or undefined when none is live.
   */
  commandTarget(element: Element | null): SidebarRightTarget | undefined

  /**
   * Open a page type for a captured target.
   * @param kind - the page type's kind.
   * @param target - captured target.
   */
  openTabFromTarget(kind: string, target: SidebarRightTarget): void
}

/** Physical binding of one shortcut profile. */
export interface ShortcutBinding {
  /** Physical key code. */
  readonly code: string
  /** Modifier names such as `primary` and `shift`. */
  readonly modifiers: readonly string[]
}

/** Synchronous DOM context handed to a command resolver. */
export interface ShortcutContext {
  /** Original input element, or null when no document target is available. */
  readonly target: Element | null
}

/** Outcome of resolving one shortcut. */
export type ShortcutResolution =
  | { readonly status: 'handled'; readonly run: () => void }
  | { readonly status: 'blocked'; readonly reason: string }
  | { readonly status: 'pass' }

/** One application keyboard command. */
export interface ShortcutCommand {
  /** Stable command id. */
  readonly id: string
  /** Command label in the current language. */
  readonly label: () => string
  /** Search aliases. */
  readonly aliases: readonly string[]
  /** Default bindings per profile. */
  readonly defaults: Readonly<Partial<Record<string, ShortcutBinding>>>
  /** Input owners the command accepts. */
  readonly regions: readonly string[]
  /** Modal identifiers the command accepts. */
  readonly modals: readonly string[]
  /**
   * Resolve the command against its DOM context.
   * @param context - captured target and input ownership.
   * @returns handled, blocked or passed.
   */
  resolve(context: ShortcutContext): ShortcutResolution
}

/** Shortcut registry members used by the plugin. */
export interface ShortcutsService {
  /**
   * Register one command.
   * @param command - command definition.
   * @returns unregister.
   */
  register(command: ShortcutCommand): () => void
}

/** Presentation fields shared by overlay views and contributions. */
export interface MenuActionView {
  /** Stable action id, published under the contribution id. */
  readonly id: string
  /** Localized label. */
  readonly label: string
  /** Show but do not select. */
  readonly disabled?: boolean
  /** Destructive styling. */
  readonly danger?: boolean
  /** Draw a divider above the action. */
  readonly separatorBefore?: boolean
  /** Nested native menu entries. A parent opens these instead of executing. */
  readonly children?: readonly MenuActionView[]
}

/** One contribution action with its execution callback. */
export interface ContextMenuAction extends Omit<MenuActionView, 'children'> {
  /** Nested native menu entries with their own callbacks. */
  readonly children?: readonly ContextMenuAction[]
  /** Execute against the captured target. */
  readonly run?: () => void | Promise<void>
  /** Localized feedback when execution rejects. */
  readonly failureLabel?: string
}

/** One namespaced context-menu contribution. */
export interface ContextMenuContribution {
  /** Stable contribution id. */
  readonly id: string
  /** Registered target family. */
  readonly target: string
  /** Order within the target family. */
  readonly order: number
  /**
   * Resolve actions for the captured target value.
   * @param value - captured target's value, never the trigger wrapper.
   * @param signal - aborted on dismissal or unload.
   * @returns actions for the shared overlay.
   */
  resolve(
    value: unknown,
    signal: AbortSignal,
  ): readonly ContextMenuAction[] | Promise<readonly ContextMenuAction[]>
}

/** Context-menu registry members used by the plugin. */
export interface ContextMenusService {
  /**
   * Register one contribution.
   * @param contribution - target provider.
   * @returns unregister.
   */
  register(contribution: ContextMenuContribution): () => void

  /**
   * Show feedback outside the originating surface.
   * @param text - localized message.
   * @param success - whether the operation succeeded.
   */
  notify(text: string, success?: boolean): void
}

/** An object a context-menu trigger captures. */
export interface ContextMenuTriggerTarget {
  /** Registered target family. */
  readonly kind: string
  /** Captured row data. */
  readonly value: unknown
}

/** Existing element props a trigger preserves and augments. */
export type MenuTriggerHandlers = React.HTMLAttributes<HTMLElement> &
  Readonly<Record<string, unknown>>

/** Props the trigger binding adds to an element. */
export type MenuTriggerProps = Readonly<Record<string, unknown>>

/** Bindings supplied by the globally injected context-menu hook. */
export interface ContextMenuBindings {
  /**
   * Bind one element to the shared menu gesture.
   * @param target - object captured when the gesture runs.
   * @param handlers - existing handlers the trigger preserves.
   * @returns combined pointer and keyboard handlers plus a focus stop.
   */
  getTriggerProps(
    target: ContextMenuTriggerTarget | (() => ContextMenuTriggerTarget) | undefined,
    handlers?: MenuTriggerHandlers,
  ): MenuTriggerProps
}

/** Read menu gesture bindings owned by the current menu plugin lifetime. */
export type UseContextMenu = () => ContextMenuBindings

/**
 * Cleanup an effect callback may return.
 *
 * `void` is part of the contract because a callback that only subscribes may
 * return nothing; the host treats a returned function as the disposer.
 */
// biome-ignore lint/suspicious/noConfusingVoidType: models the host's void-or-disposer contract
export type EffectCleanup = void | (() => void)

/** Client services the plugin injects or optionally injects. */
export interface ClientServices {
  readonly locale: LocaleService
  readonly slots: SlotsService
  readonly sidebarRightTabs: SidebarRightTabsService
  readonly sidebarRight: SidebarRightService
  readonly shortcuts?: ShortcutsService
  readonly contextMenus?: ContextMenusService
}

/** Client root context the bundle's `apply` receives. */
export interface ClientContext extends ClientServices {
  /**
   * Run a side effect and register its disposer with the plugin lifetime.
   * @param callback - effect body; may return a cleanup.
   * @param label - diagnostic label.
   * @returns disposer.
   */
  effect(callback: () => EffectCleanup, label?: string): () => void

  /**
   * Run a callback only when the named service is available.
   * @param services - required service names.
   * @param callback - receives a context with those services present.
   */
  inject<Service extends keyof ClientServices>(
    services: readonly Service[],
    callback: (scoped: ClientContext & Required<Pick<ClientServices, Service>>) => void,
  ): void
}
