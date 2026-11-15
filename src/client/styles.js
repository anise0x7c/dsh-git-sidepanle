/**
 * Inline the stylesheet into the page once, keyed by plugin id.
 */

import CSS from './styles.css'
import { PACKAGE_ID } from './constants.js'

if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin=${JSON.stringify(PACKAGE_ID)}]`) === null) {
  const style = document.createElement('style')
  style.setAttribute('data-plugin', PACKAGE_ID)
  style.textContent = CSS
  document.head.appendChild(style)
}
