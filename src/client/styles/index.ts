/**
 * Sidebar stylesheet assembly.
 *
 * The browser bundle inlines CSS as text, so every visual area owns one source
 * file here while this module is the single place that fixes cascade order.
 * Sections are concatenated exactly as they were laid out in the former single
 * `styles.css`; later files still override earlier ones. Add new areas as their
 * own file and place them in the array where their cascade belongs.
 *
 * `test/unit/floating-panel-style.test.ts` reads this module to confirm every
 * section file participates, so splitting the sheet keeps its structural
 * regressions meaningful.
 */

import base from './base.css'
import branchMenu from './branch-menu.css'
import buttons from './buttons.css'
import commitBox from './commit-box.css'
import commitDetail from './commit-detail.css'
import confirm from './confirm.css'
import diff from './diff.css'
import feedback from './feedback.css'
import graph from './graph.css'
import graphDialogs from './graph-dialogs.css'
import motion from './motion.css'
import rows from './rows.css'
import scroll from './scroll.css'
import section from './section.css'
import split from './split.css'
import titles from './titles.css'
import toolbar from './toolbar.css'

/** Concatenated stylesheet, byte-identical to the former single-file sheet. */
export const CSS = [
  base,
  buttons,
  toolbar,
  commitBox,
  feedback,
  scroll,
  split,
  section,
  rows,
  graph,
  commitDetail,
  confirm,
  graphDialogs,
  branchMenu,
  titles,
  diff,
  motion,
].join('\n')
