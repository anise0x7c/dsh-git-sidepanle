/**
 * Browser half of the Git graph bundle.
 *
 * Registers two right-Sidebar tab types — the source-control panel and its
 * unified diff — plus the guide entry and toggle shortcut. All repository work
 * travels over the bundle's guarded Host route; this file only renders and
 * asks for it.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-git-graph',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const PACKAGE_ID = '@local/dsh-git-graph'
    const NS = 'gitGraph'
    const GIT_ID = '@local/dsh-git-graph/git'
    const GIT_KIND = 'git'
    const GIT_SHORTCUT = 'workspace.git'
    const DIFF_ID = '@local/dsh-git-graph/diff'
    const DIFF_KIND = 'git-diff'
    const RPC_PATH = 'api/dsh-git-graph/rpc'
    const POLL_INTERVAL_MS = 5000
    const MAX_RENDERED_DIFF_LINES = 4000
    const MENU_TARGET = 'gitGraphItem'
    const MENU_CONTRIBUTION_ID = 'git-graph.actions'
    let panelSequence = 0

    // ------------------------------------------------------------------
    // Copy
    // ------------------------------------------------------------------

    const en = {
      title: 'Source control',
      guideTitle: 'Source control',
      guideDescription: 'Review changes, stage files, commit, and follow history',
      refresh: 'Refresh',
      loading: 'Loading source control…',
      retry: 'Retry',
      'shortcut.noSession': 'Open a session to use source control',
      'noRepo.title': 'No Git repository',
      'noRepo.desc': 'The workspace directory {path} is not inside a Git repository.',
      'gitUnavailable.title': 'Git is not available',
      'gitUnavailable.desc': 'The Host could not run Git. Install Git or add it to the Host PATH, then retry.',
      'branch.detached': 'Detached HEAD',
      'branch.unborn': 'No commits yet',
      'branch.ahead': '{n} ahead',
      'branch.behind': '{n} behind',
      'branch.upstream': 'Tracking {name}',
      'branch.menu': 'Switch branch',
      'branch.loading': 'Loading branches…',
      'branch.empty': 'No local branches',
      'commit.placeholder': 'Message (Ctrl+Enter to commit on {branch})',
      'commit.action': 'Commit',
      'commit.committing': 'Committing…',
      'commit.hint': 'Commits staged changes only',
      'commit.hintNone': 'Nothing staged: commit stages every change first',
      'commit.emptyConfirm': 'No staged changes. Stage all changes and commit them?',
      'commit.nothing': 'There are no changes to commit.',
      'commit.stageAll': 'Stage all and commit',
      'commit.done': 'Committed {hash}',
      'sections.merge': 'Merge changes',
      'sections.staged': 'Staged changes',
      'sections.changes': 'Changes',
      'sections.graph': 'Graph',
      'actions.stage': 'Stage change',
      'actions.unstage': 'Unstage change',
      'actions.discard': 'Discard changes',
      'actions.stageAll': 'Stage all changes',
      'actions.unstageAll': 'Unstage all changes',
      'actions.discardAll': 'Discard all changes',
      'menu.openDiff': 'Open changes',
      'menu.copyRelativePath': 'Copy relative path',
      'menu.copyPath': 'Copy path',
      'menu.copyCommitId': 'Copy commit ID',
      'menu.copyCommitSubject': 'Copy commit subject',
      'menu.refreshHistory': 'Refresh history',
      'menu.hint': 'Right-click for actions',
      'menu.stale': 'That change is no longer available.',
      'menu.busy': 'Wait for the current Git operation to finish.',
      'menu.copiedRelativePath': 'Relative path copied',
      'menu.copiedPath': 'Path copied',
      'menu.copiedCommitId': 'Commit ID copied',
      'menu.copiedCommitSubject': 'Commit subject copied',
      'menu.copyFailed': 'Could not copy to the clipboard.',
      'confirm.discardTitle': 'Discard changes to {name}?',
      'confirm.discardDesc': 'The file is restored to its committed version. This cannot be undone.',
      'confirm.deleteUntrackedDesc': 'The untracked file is deleted. This cannot be undone.',
      'confirm.discardAllTitle': 'Discard all {n} changes?',
      'confirm.discardAllDesc': 'Tracked files are restored to their committed versions and untracked files are deleted. This cannot be undone.',
      'confirm.discard': 'Discard',
      'confirm.discardAll': 'Discard all',
      'action.cancel': 'Cancel',
      'action.dismiss': 'Dismiss',
      'error.discardUnborn': 'Changes cannot be discarded before the first commit.',
      'status.modified': 'Modified',
      'status.added': 'Added',
      'status.deleted': 'Deleted',
      'status.renamed': 'Renamed',
      'status.copied': 'Copied',
      'status.untracked': 'Untracked',
      'status.conflict': 'Conflicted',
      'status.typeChanged': 'Type changed',
      'clean.title': 'No changes',
      'clean.desc': 'The working tree is clean.',
      'error.title': 'Git failed',
      'error.network': 'Could not reach the Host.',
      'error.forbidden': 'The Host refused the request.',
      'error.unknown': 'The source-control request failed.',
      'graph.loading': 'Loading commits…',
      'graph.empty': 'No commits yet',
      'graph.noSubject': '(no message)',
      'diff.title': 'Diff',
      'diff.loading': 'Loading diff…',
      'diff.empty': 'No changes to show.',
      'diff.binary': 'This file cannot be shown as text.',
      'diff.truncated': 'The diff is too large and was truncated.',
      'diff.staged': 'Staged',
      'diff.unstaged': 'Unstaged',
      'diff.untracked': 'Untracked',
      'diff.from': 'from {path}',
      'diff.pick': 'Pick a changed file in Source control to see its diff.',
      'diff.sourceControl': 'Open source control',
      'diff.error': 'Could not load this diff.',
      'diff.refresh': 'Reload diff',
      'time.now': 'just now',
      'time.seconds': '{n}s ago',
      'time.minutes': '{n} min ago',
      'time.hours': '{n} h ago',
      'time.days': '{n} d ago',
      'time.weeks': '{n} w ago',
      'time.months': '{n} mo ago',
      'time.years': '{n} y ago',
    }

    const zh = {
      title: '源代码管理',
      guideTitle: '源代码管理',
      guideDescription: '查看更改、暂存文件、提交并浏览提交历史',
      refresh: '刷新',
      loading: '正在加载源代码管理…',
      retry: '重试',
      'shortcut.noSession': '请先打开一个会话再使用源代码管理',
      'noRepo.title': '没有 Git 仓库',
      'noRepo.desc': '工作目录 {path} 不在任何 Git 仓库内。',
      'gitUnavailable.title': 'Git 不可用',
      'gitUnavailable.desc': 'Host 无法运行 Git。请安装 Git 或将其加入 Host 的 PATH，然后重试。',
      'branch.detached': '分离头指针',
      'branch.unborn': '尚无提交',
      'branch.ahead': '领先 {n} 个提交',
      'branch.behind': '落后 {n} 个提交',
      'branch.upstream': '跟踪 {name}',
      'branch.menu': '切换分支',
      'branch.loading': '正在加载分支…',
      'branch.empty': '没有本地分支',
      'commit.placeholder': '提交信息（Ctrl+Enter 提交到 {branch}）',
      'commit.action': '提交',
      'commit.committing': '正在提交…',
      'commit.hint': '只提交已暂存的更改',
      'commit.hintNone': '尚未暂存：提交前会先暂存全部更改',
      'commit.emptyConfirm': '没有已暂存的更改。要暂存全部更改并提交吗？',
      'commit.nothing': '没有可提交的更改。',
      'commit.stageAll': '全部暂存并提交',
      'commit.done': '已提交 {hash}',
      'sections.merge': '合并更改',
      'sections.staged': '已暂存的更改',
      'sections.changes': '更改',
      'sections.graph': '提交图',
      'actions.stage': '暂存更改',
      'actions.unstage': '取消暂存',
      'actions.discard': '放弃更改',
      'actions.stageAll': '暂存全部更改',
      'actions.unstageAll': '取消暂存全部更改',
      'actions.discardAll': '放弃全部更改',
      'menu.openDiff': '查看更改',
      'menu.copyRelativePath': '复制相对路径',
      'menu.copyPath': '复制路径',
      'menu.copyCommitId': '复制提交 ID',
      'menu.copyCommitSubject': '复制提交主题',
      'menu.refreshHistory': '刷新提交历史',
      'menu.hint': '右键查看更多操作',
      'menu.stale': '该更改已不存在。',
      'menu.busy': '请等待当前 Git 操作完成。',
      'menu.copiedRelativePath': '已复制相对路径',
      'menu.copiedPath': '已复制路径',
      'menu.copiedCommitId': '已复制提交 ID',
      'menu.copiedCommitSubject': '已复制提交主题',
      'menu.copyFailed': '无法复制到剪贴板。',
      'confirm.discardTitle': '要放弃对 {name} 的更改吗？',
      'confirm.discardDesc': '文件将恢复为已提交的版本，此操作无法撤销。',
      'confirm.deleteUntrackedDesc': '未跟踪的文件将被删除，此操作无法撤销。',
      'confirm.discardAllTitle': '要放弃全部 {n} 项更改吗？',
      'confirm.discardAllDesc': '已跟踪文件将恢复为已提交的版本，未跟踪文件将被删除。此操作无法撤销。',
      'confirm.discard': '放弃',
      'confirm.discardAll': '全部放弃',
      'action.cancel': '取消',
      'action.dismiss': '关闭',
      'error.discardUnborn': '首次提交前无法放弃更改。',
      'status.modified': '已修改',
      'status.added': '已添加',
      'status.deleted': '已删除',
      'status.renamed': '已重命名',
      'status.copied': '已复制',
      'status.untracked': '未跟踪',
      'status.conflict': '有冲突',
      'status.typeChanged': '类型已更改',
      'clean.title': '没有更改',
      'clean.desc': '工作区是干净的。',
      'error.title': 'Git 操作失败',
      'error.network': '无法连接 Host。',
      'error.forbidden': 'Host 拒绝了该请求。',
      'error.unknown': '源代码管理请求失败。',
      'graph.loading': '正在加载提交…',
      'graph.empty': '尚无提交',
      'graph.noSubject': '（无提交信息）',
      'diff.title': '差异',
      'diff.loading': '正在加载差异…',
      'diff.empty': '没有可显示的更改。',
      'diff.binary': '该文件无法以文本方式显示。',
      'diff.truncated': '差异过大，已截断显示。',
      'diff.staged': '已暂存',
      'diff.unstaged': '未暂存',
      'diff.untracked': '未跟踪',
      'diff.from': '来自 {path}',
      'diff.pick': '请在源代码管理中点击一个更改文件以查看差异。',
      'diff.sourceControl': '打开源代码管理',
      'diff.error': '无法加载该差异。',
      'diff.refresh': '重新加载差异',
      'time.now': '刚刚',
      'time.seconds': '{n} 秒前',
      'time.minutes': '{n} 分钟前',
      'time.hours': '{n} 小时前',
      'time.days': '{n} 天前',
      'time.weeks': '{n} 周前',
      'time.months': '{n} 个月前',
      'time.years': '{n} 年前',
    }

    // ------------------------------------------------------------------
    // Styles
    // ------------------------------------------------------------------

    const CSS = `
.dshgg-root{display:flex;flex-direction:column;flex:1 1 auto;height:100%;min-height:0;color:var(--dsw-alias-label-primary);font-size:12.5px;line-height:1.45;background:transparent}
.dshgg-toolbar{display:flex;align-items:center;gap:6px;padding:6px 8px;min-height:36px;flex:none;border-bottom:1px solid var(--dsw-alias-border-l1)}
.dshgg-spacer{flex:1}
.dshgg-branchWrap{position:relative;display:flex;min-width:0}
.dshgg-branchChip{display:flex;align-items:center;gap:5px;min-width:0;max-width:100%;height:24px;padding:0 6px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
.dshgg-branchChip:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l1)}
.dshgg-branchChip:disabled{cursor:default;color:var(--dsw-alias-label-secondary)}
.dshgg-branchName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.dshgg-upstream{display:inline-flex;align-items:center;gap:2px;color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums}
.dshgg-sync{display:inline-flex;align-items:center;gap:1px;color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums}
.dshgg-chevron{flex:none;transition:transform .12s ease}
.dshgg-chevron[data-open="true"]{transform:rotate(90deg)}
.dshgg-iconBtn{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:none;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none}
.dshgg-iconBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dshgg-iconBtn:disabled{opacity:.4;cursor:default}
.dshgg-iconBtn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}
.dshgg-iconBtn[data-spinning="true"] svg{animation:dshgg-spin 1s linear infinite}
@keyframes dshgg-spin{to{transform:rotate(360deg)}}
.dshgg-commitBox{display:flex;flex-direction:column;gap:6px;padding:8px 8px 9px;flex:none;border-bottom:1px solid var(--dsw-alias-border-l1)}
.dshgg-commitMessage{width:100%;box-sizing:border-box;min-height:54px;max-height:40vh;padding:6px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;line-height:1.5;resize:vertical;outline:none}
.dshgg-commitMessage::placeholder{color:var(--dsw-alias-label-tertiary)}
.dshgg-commitMessage:focus{border-color:var(--dsw-alias-state-business-primary)}
.dshgg-commitMessage:disabled{opacity:.6}
.dshgg-commitRow{display:flex;align-items:center;gap:8px}
.dshgg-commitHint{flex:1;min-width:0;color:var(--dsw-alias-label-tertiary);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgg-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:25px;padding:0 11px;border:1px solid transparent;border-radius:5px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;flex:none}
.dshgg-btn:disabled{opacity:.45;cursor:default}
.dshgg-btn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.dshgg-btnPrimary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.dshgg-btnPrimary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.dshgg-btnGhost{background:transparent;border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font-weight:500}
.dshgg-btnGhost:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dshgg-banner{display:flex;align-items:flex-start;gap:8px;margin:6px 8px 0;padding:7px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;font-size:12px}
.dshgg-banner[data-kind="error"]{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.dshgg-bannerText{flex:1;min-width:0;overflow-wrap:anywhere;white-space:pre-wrap}
.dshgg-bannerDetail{margin-top:3px;color:var(--dsw-alias-label-secondary);font-family:var(--ds-font-family-code);font-size:11px;max-height:96px;overflow:auto;white-space:pre-wrap}
.dshgg-bannerActions{display:flex;align-items:center;gap:4px;flex:none}
.dshgg-linkBtn{padding:0;border:none;background:none;color:var(--dsw-alias-state-business-primary);font:inherit;font-size:12px;cursor:pointer}
.dshgg-linkBtn:hover{text-decoration:underline}
.dshgg-notice{margin:6px 8px 0;padding:6px 9px;border:1px solid var(--dsw-alias-state-success-primary);border-radius:6px;color:var(--dsw-alias-state-success-primary);font-size:12px}
.dshgg-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;padding-bottom:8px}
.dshgg-state{display:flex;flex-direction:column;align-items:center;gap:6px;padding:34px 18px;text-align:center}
.dshgg-stateIcon{color:var(--dsw-alias-label-tertiary);display:flex}
.dshgg-stateTitle{margin:2px 0 0;font-size:13px;font-weight:600}
.dshgg-stateDesc{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;max-width:320px;overflow-wrap:anywhere}
.dshgg-stateAction{margin-top:8px}
.dshgg-section{display:flex;flex-direction:column;flex:none}
.dshgg-sectionHeader{display:flex;align-items:center;gap:2px;height:24px;padding:0 6px 0 2px;position:relative}
.dshgg-sectionToggle{display:flex;align-items:center;gap:5px;min-width:0;flex:1;height:100%;padding:0 4px;border:none;border-radius:4px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;font-weight:700;letter-spacing:.02em;cursor:pointer}
.dshgg-sectionToggle:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dshgg-sectionToggle:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}
.dshgg-sectionTitle{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgg-sectionCount{color:var(--dsw-alias-label-secondary);font-weight:500;font-variant-numeric:tabular-nums}
.dshgg-sectionActions{display:flex;align-items:center;gap:1px;flex:none}
.dshgg-sectionBody{display:flex;flex-direction:column}
.dshgg-row{display:flex;align-items:center;gap:6px;height:23px;padding-right:4px;flex:none;min-width:0}
.dshgg-fileRow{cursor:pointer;user-select:none}
.dshgg-fileRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dshgg-fileRow:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}
.dshgg-status{flex:none;width:14px;text-align:center;font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}
.dshgg-status[data-status="M"]{color:var(--dsw-alias-state-warn-primary)}
.dshgg-status[data-status="A"],.dshgg-status[data-status="U"]{color:var(--dsw-alias-state-success-primary)}
.dshgg-status[data-status="D"]{color:var(--dsw-alias-state-error-primary)}
.dshgg-status[data-status="R"],.dshgg-status[data-status="C"]{color:var(--dsw-alias-state-business-primary)}
.dshgg-status[data-status="T"]{color:var(--dsw-alias-state-warn-primary)}
.dshgg-status[data-status="!"]{color:var(--dsw-alias-state-error-primary);font-size:12px}
.dshgg-fileName{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px}
.dshgg-fileName[data-obsolete="true"]{color:var(--dsw-alias-label-secondary);text-decoration:line-through}
.dshgg-fileArrow{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;max-width:38%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgg-fileActions{display:flex;align-items:center;gap:0;flex:none;opacity:0}
.dshgg-fileRow:hover .dshgg-fileActions,.dshgg-fileRow:focus-within .dshgg-fileActions{opacity:1}
.dshgg-fileActions .dshgg-iconBtn{width:20px;height:20px}
.dshgg-folderRow{cursor:pointer;user-select:none;color:var(--dsw-alias-label-primary)}
.dshgg-folderRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dshgg-folderRow:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}
.dshgg-folderName{font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgg-clean{display:flex;flex-direction:column;align-items:center;gap:5px;padding:26px 16px 20px;text-align:center;color:var(--dsw-alias-label-secondary)}
.dshgg-cleanIcon{color:var(--dsw-alias-state-success-primary);display:flex}
.dshgg-cleanTitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dshgg-cleanDesc{font-size:12px}
.dshgg-graphRow{display:flex;gap:6px;padding:2px 8px 2px 4px;min-width:0;align-items:flex-start;border-radius:0}
.dshgg-graphRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dshgg-graphRow:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}
.dshgg-graphPrefix{margin:0;flex:none;font-family:var(--ds-font-family-code);font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);white-space:pre;user-select:none}
.dshgg-graphBody{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.dshgg-graphSubject{font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}
.dshgg-graphMeta{display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-secondary);min-width:0}
.dshgg-graphHash{font-family:var(--ds-font-family-code);color:var(--dsw-alias-label-tertiary)}
.dshgg-dot{color:var(--dsw-alias-label-tertiary)}
.dshgg-refs{display:inline-flex;gap:3px;flex-wrap:wrap}
.dshgg-ref{display:inline-flex;align-items:center;gap:3px;padding:0 5px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;font-size:10px;line-height:15px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgg-ref[data-kind="head"]{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);font-weight:600}
.dshgg-ref[data-kind="branch"]{color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}
.dshgg-ref[data-kind="tag"]{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}
.dshgg-confirm{display:flex;align-items:center;gap:10px;margin:0;padding:8px 10px;flex:none;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.dshgg-confirmText{flex:1;min-width:0}
.dshgg-confirmTitle{font-size:12.5px;font-weight:600;overflow-wrap:anywhere}
.dshgg-confirmDesc{margin-top:2px;font-size:11.5px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.dshgg-confirmActions{display:flex;align-items:center;gap:6px;flex:none}
.dshgg-menu{position:absolute;top:calc(100% + 4px);left:0;z-index:20;min-width:200px;max-width:min(320px,70vw);max-height:320px;overflow-y:auto;padding:4px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-overlay);box-shadow:0 8px 24px rgba(0,0,0,.18)}
.dshgg-menuItem{display:flex;align-items:center;gap:6px;width:100%;height:26px;padding:0 7px;border:none;border-radius:4px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;text-align:left;cursor:pointer}
.dshgg-menuItem:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dshgg-menuItem:disabled{cursor:default;font-weight:600}
.dshgg-menuItem:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}
.dshgg-menuCheck{display:inline-flex;width:12px;flex:none;color:var(--dsw-alias-state-business-primary)}
.dshgg-menuLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgg-menuNote{padding:7px 8px;color:var(--dsw-alias-label-secondary);font-size:12px}
.dshgg-title{display:inline-flex;align-items:center;gap:5px;min-width:0}
.dshgg-titleText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgg-diffRoot{display:flex;flex-direction:column;flex:1 1 auto;height:100%;min-height:0;color:var(--dsw-alias-label-primary);font-size:12.5px}
.dshgg-diffHeader{display:flex;align-items:center;gap:6px;padding:5px 8px;flex:none;border-bottom:1px solid var(--dsw-alias-border-l1);min-width:0}
.dshgg-diffPath{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}
.dshgg-diffName{font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgg-diffFrom{font-size:11px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgg-diffStats{flex:none;display:inline-flex;gap:4px;font-family:var(--ds-font-family-code);font-size:11px;font-variant-numeric:tabular-nums}
.dshgg-diffAdd{color:var(--dsw-alias-code-diff-added)}
.dshgg-diffDel{color:var(--dsw-alias-code-diff-deleted)}
.dshgg-diffBadge{flex:none;padding:0 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-secondary)}
.dshgg-diffBadge[data-kind="staged"]{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.dshgg-diffBadge[data-kind="untracked"]{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.dshgg-diffBody{flex:1;min-height:0;overflow:auto;font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;padding-bottom:10px}
.dshgg-hunkHeader{padding:2px 10px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);font-size:11.5px;white-space:pre;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1);margin-top:2px}
.dshgg-diffLine{display:grid;grid-template-columns:44px 44px 16px minmax(0,1fr);min-width:max-content}
.dshgg-gutter{padding-right:6px;text-align:right;color:var(--dsw-alias-label-tertiary);user-select:none;font-variant-numeric:tabular-nums;font-size:11px;border-right:1px solid var(--dsw-alias-border-l1)}
.dshgg-marker{text-align:center;user-select:none;color:var(--dsw-alias-label-tertiary);font-weight:700}
.dshgg-code{padding:0 10px;white-space:pre;min-width:0}
.dshgg-diffLine[data-type="+"]{background:var(--dsw-alias-file-diff-added-bg)}
.dshgg-diffLine[data-type="+"] .dshgg-gutter{background:var(--dsw-alias-file-diff-added-gutter)}
.dshgg-diffLine[data-type="+"] .dshgg-marker{color:var(--dsw-alias-file-diff-added-marker)}
.dshgg-diffLine[data-type="-"]{background:var(--dsw-alias-file-diff-deleted-bg)}
.dshgg-diffLine[data-type="-"] .dshgg-gutter{background:var(--dsw-alias-file-diff-deleted-gutter)}
.dshgg-diffLine[data-type="-"] .dshgg-marker{color:var(--dsw-alias-file-diff-deleted-marker)}
.dshgg-diffNote{padding:16px;color:var(--dsw-alias-label-secondary);font-family:var(--dsw-font-family);font-size:12.5px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.dshgg-emptyLine{min-height:18px}
`

    if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin=${JSON.stringify(PACKAGE_ID)}]`) === null) {
      const style = document.createElement('style')
      style.setAttribute('data-plugin', PACKAGE_ID)
      style.textContent = CSS
      document.head.appendChild(style)
    }

    // ------------------------------------------------------------------
    // Icons
    // ------------------------------------------------------------------

    function svgIcon(size, path, options = {}) {
      return h('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        width: size,
        height: size,
        viewBox: '0 0 16 16',
        fill: options.fill ?? 'none',
        stroke: options.fill === 'currentColor' ? 'none' : 'currentColor',
        strokeWidth: options.strokeWidth ?? 1.3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: false,
        className: options.className,
      }, path)
    }

    function GitBranchIcon(props) {
      const size = props?.size ?? 16
      return svgIcon(size, [
        h('circle', { key: 'a', cx: 4.5, cy: 3.5, r: 1.6 }),
        h('circle', { key: 'b', cx: 4.5, cy: 12.5, r: 1.6 }),
        h('circle', { key: 'c', cx: 11.5, cy: 6.5, r: 1.6 }),
        h('path', { key: 'd', d: 'M4.5 5.1v5.8' }),
        h('path', { key: 'e', d: 'M11.5 8.1c0 2.1-2.4 3-7 3.4' }),
      ])
    }

    function ChevronRightIcon(props) {
      const size = props?.size ?? 12
      return svgIcon(size, h('path', { d: 'M6 3.5 10.5 8 6 12.5' }), { className: props?.className })
    }

    function ChevronDownIcon(props) {
      const size = props?.size ?? 12
      return svgIcon(size, h('path', { d: 'M3.5 6 8 10.5 12.5 6' }), { className: props?.className })
    }

    function RefreshIcon(props) {
      const size = props?.size ?? 14
      return svgIcon(size, [
        h('path', { key: 'a', d: 'M13 8a5 5 0 1 1-1.7-3.75' }),
        h('path', { key: 'b', d: 'M13 2.5v3.2H9.8' }),
      ])
    }

    function PlusIcon(props) {
      const size = props?.size ?? 14
      return svgIcon(size, [h('path', { key: 'a', d: 'M8 3v10' }), h('path', { key: 'b', d: 'M3 8h10' })])
    }

    function MinusIcon(props) {
      const size = props?.size ?? 14
      return svgIcon(size, h('path', { d: 'M3 8h10' }))
    }

    function UndoIcon(props) {
      const size = props?.size ?? 14
      return svgIcon(size, [
        h('path', { key: 'a', d: 'M5.5 4.5 2.5 7.5l3 3' }),
        h('path', { key: 'b', d: 'M2.5 7.5H9a4 4 0 0 1 0 8H7' }),
      ])
    }

    function CheckIcon(props) {
      const size = props?.size ?? 14
      return svgIcon(size, h('path', { d: 'M3 8.5 6.2 11.5 13 4.5' }))
    }

    function CloseIcon(props) {
      const size = props?.size ?? 12
      return svgIcon(size, [h('path', { key: 'a', d: 'M4 4l8 8' }), h('path', { key: 'b', d: 'M12 4l-8 8' })])
    }

    function FileIcon(props) {
      const size = props?.size ?? 14
      return svgIcon(size, [
        h('path', { key: 'a', d: 'M4 1.8h5l3 3v9.4H4z' }),
        h('path', { key: 'b', d: 'M9 1.8v3h3' }),
      ])
    }

    function AlertIcon(props) {
      const size = props?.size ?? 16
      return svgIcon(size, [
        h('circle', { key: 'a', cx: 8, cy: 8, r: 6.4 }),
        h('path', { key: 'b', d: 'M8 4.8v4.2' }),
        h('path', { key: 'c', d: 'M8 11.6h.01' }),
      ])
    }

    function CheckCircleIcon(props) {
      const size = props?.size ?? 28
      return svgIcon(size, [
        h('circle', { key: 'a', cx: 8, cy: 8, r: 6.4 }),
        h('path', { key: 'b', d: 'M5 8.2 7.2 10.4 11.2 6' }),
      ])
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    function makeFailure(code, message, status) {
      const failure = new Error(message || code)
      failure.code = code
      failure.detail = message || ''
      failure.status = status
      return failure
    }

    function createCaller(sessionId) {
      return async function call(op, payload = {}) {
        let response
        try {
          response = await fetch(RPC_PATH, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json', 'x-dsh-git-graph': '1' },
            body: JSON.stringify({ sessionId, op, ...payload }),
          })
        } catch (cause) {
          throw makeFailure('network', cause instanceof Error ? cause.message : String(cause))
        }
        let data
        try {
          data = await response.json()
        } catch {
          throw makeFailure('bad-response', `The Host answered HTTP ${response.status}.`, response.status)
        }
        if (data === null || typeof data !== 'object') throw makeFailure('bad-response', `The Host answered HTTP ${response.status}.`, response.status)
        if (data.ok !== true) {
          const error = data.error ?? {}
          throw makeFailure(typeof error.code === 'string' ? error.code : 'internal', typeof error.message === 'string' ? error.message : '', response.status)
        }
        return data.value
      }
    }

    const STATUS_LETTERS = {
      '.': '',
      M: 'M',
      A: 'A',
      D: 'D',
      R: 'R',
      C: 'C',
      U: 'U',
      T: 'T',
      '?': 'U',
    }

    function statusLetter(character) {
      return STATUS_LETTERS[character] ?? ''
    }

    function statusKey(letter) {
      if (letter === 'M') return 'status.modified'
      if (letter === 'A') return 'status.added'
      if (letter === 'D') return 'status.deleted'
      if (letter === 'R') return 'status.renamed'
      if (letter === 'C') return 'status.copied'
      if (letter === 'U') return 'status.untracked'
      if (letter === '!') return 'status.conflict'
      if (letter === 'T') return 'status.typeChanged'
      return 'status.modified'
    }

    function isStaged(entry) {
      return entry.conflict !== true && entry.x !== '.' && entry.x !== '?' && entry.x !== '!'
    }

    function isUnstaged(entry) {
      return entry.conflict !== true && (entry.y !== '.' || entry.x === '?')
    }

    function baseName(path) {
      const index = path.lastIndexOf('/')
      return index < 0 ? path : path.slice(index + 1)
    }

    function formatAgo(t, authoredAt) {
      const seconds = Math.max(0, Math.floor(Date.now() / 1000) - authoredAt)
      if (seconds < 45) return t('time.now')
      if (seconds < 3600) return t('time.minutes', { n: Math.max(1, Math.round(seconds / 60)) })
      if (seconds < 86400) return t('time.hours', { n: Math.round(seconds / 3600) })
      if (seconds < 604800) return t('time.days', { n: Math.round(seconds / 86400) })
      if (seconds < 2592000) return t('time.weeks', { n: Math.round(seconds / 604800) })
      if (seconds < 31536000) return t('time.months', { n: Math.round(seconds / 2592000) })
      return t('time.years', { n: Math.round(seconds / 31536000) })
    }

    function parseRefs(refs) {
      if (typeof refs !== 'string' || refs === '') return []
      return refs.split(', ').filter((label) => label !== '').map((label) => {
        if (label.startsWith('HEAD -> ')) return { label: label.slice('HEAD -> '.length), kind: 'head' }
        if (label === 'HEAD') return { label: 'HEAD', kind: 'head' }
        if (label.startsWith('tag: ')) return { label: label.slice('tag: '.length), kind: 'tag' }
        if (label.includes('/')) return { label, kind: 'remote' }
        return { label, kind: 'branch' }
      })
    }

    function buildTree(entries) {
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

    function errorText(t, failure) {
      if (failure === null || failure === undefined) return t('error.unknown')
      const code = failure.code
      if (code === 'git-unavailable') return t('gitUnavailable.desc')
      if (code === 'network') return t('error.network')
      if (code === 'forbidden') return t('error.forbidden')
      if (code === 'not-a-repository') return t('noRepo.title')
      if (code === 'discard-unborn') return t('error.discardUnborn')
      return failure.message || t('error.unknown')
    }

    // ------------------------------------------------------------------
    // Context menus
    // ------------------------------------------------------------------

    /**
     * Menu commands are emitted by the host's shared context-menu overlay,
     * outside this React tree, so actions only describe what to do. The mounted
     * panel executes them through its own confirmation, busy, failure, and
     * refresh paths, which keeps the two entry points identical.
     */
    function createCommandBus() {
      const listeners = new Set()
      return {
        emit(command) {
          for (const listener of [...listeners]) {
            try {
              listener(command)
            } catch (error) {
              console.warn('[git-graph] context menu command failed', error)
            }
          }
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
      }
    }

    const panelCommands = createCommandBus()

    /** Wrap the slot-provided hook into a plain factory, or null without host menus. */
    function bindMenuTrigger(useContextMenu) {
      if (typeof useContextMenu !== 'function') return null
      let bindings
      try {
        bindings = useContextMenu()
      } catch (error) {
        console.warn('[git-graph] context menus are unavailable', error)
        return null
      }
      if (bindings === null || bindings === undefined || typeof bindings.getTriggerProps !== 'function') return null
      return (target, handlers) => bindings.getTriggerProps(target, handlers)
    }

    function menuTarget(sessionId, kind, detail) {
      return { kind: MENU_TARGET, value: { sessionId, kind, ...detail } }
    }

    function collectTreePaths(node) {
      if (node.type !== 'folder') return [node.path]
      const paths = []
      for (const child of node.children) paths.push(...collectTreePaths(child))
      return paths
    }

    function absolutePath(cwd, path) {
      if (typeof cwd !== 'string' || cwd === '') return path
      const base = cwd.replace(/[\\/]+$/, '')
      if (base === '') return path
      const windows = base.includes('\\') && !base.includes('/')
      return windows ? `${base}\\${path.replaceAll('/', '\\')}` : `${base}/${path}`
    }

    async function copyToClipboard(text) {
      const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
      if (clipboard !== undefined && clipboard !== null && typeof clipboard.writeText === 'function') {
        try {
          await clipboard.writeText(text)
          return true
        } catch (error) {
          // Fall through to the selection based copy used by older WebViews.
        }
      }
      try {
        if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.top = '-1000px'
        document.body.appendChild(area)
        area.select()
        const copied = document.execCommand('copy') !== false
        document.body.removeChild(area)
        return copied
      } catch (error) {
        return false
      }
    }

    async function copyAndReport(t, notify, text, successKey) {
      const copied = await copyToClipboard(String(text))
      if (typeof notify !== 'function') return
      try {
        notify(copied ? t(successKey) : t('menu.copyFailed'), copied)
      } catch (error) {
        console.warn('[git-graph] copy feedback failed', error)
      }
    }

    function menuAction(id, label, run, extra = {}) {
      return { id, label, run, ...extra }
    }

    /**
     * Resolve the actions for one captured context-menu target.
     * @param value - the captured target value: the row data the trigger was
     *   bound with, as the shared registry hands it to a contribution.
     * @param t - locale binder.
     * @param notify - host toast for clipboard feedback.
     * @returns ordered actions for the shared overlay.
     */
    function resolveMenuActions(value, t, notify) {
      if (value === null || value === undefined || typeof value !== 'object') return []
      const sessionId = value.sessionId
      if (typeof sessionId !== 'string' || sessionId === '') return []
      const command = (payload) => () => panelCommands.emit({ sessionId, panelId: value.panelId, ...payload })
      const copy = (text, successKey) => () => copyAndReport(t, notify, text, successKey)
      const blocked = value.busy === true ? { disabled: true } : {}

      if (value.kind === 'file') {
        const path = value.path
        if (typeof path !== 'string' || path === '') return []
        const section = value.section === 'staged' || value.section === 'merge' ? value.section : 'changes'
        const actions = [menuAction('open', t('menu.openDiff'), command({ type: 'open', section, path }), blocked)]
        if (section === 'staged') {
          actions.push(menuAction('unstage', t('actions.unstage'), command({ type: 'unstage', paths: [path] }), { separatorBefore: true, ...blocked }))
        } else {
          actions.push(menuAction('stage', t('actions.stage'), command({ type: 'stage', paths: [path] }), { separatorBefore: true, ...blocked }))
          if (section !== 'merge') actions.push(menuAction('discard', t('actions.discard'), command({ type: 'discard', paths: [path], single: true }), { danger: true, ...blocked }))
        }
        actions.push(menuAction('copy-relative', t('menu.copyRelativePath'), copy(path, 'menu.copiedRelativePath'), { separatorBefore: true }))
        if (typeof value.cwd === 'string' && value.cwd !== '') {
          actions.push(menuAction('copy-path', t('menu.copyPath'), copy(absolutePath(value.cwd, path), 'menu.copiedPath')))
        }
        return actions
      }

      if (value.kind === 'folder') {
        const folder = value.path
        const paths = Array.isArray(value.paths) ? value.paths.filter((entry) => typeof entry === 'string' && entry !== '') : []
        if (typeof folder !== 'string' || folder === '' || paths.length === 0) return []
        const section = value.section === 'staged' || value.section === 'merge' ? value.section : 'changes'
        const actions = []
        if (section === 'staged') {
          actions.push(menuAction('unstage-all', t('actions.unstage'), command({ type: 'unstage', paths }), blocked))
        } else {
          actions.push(menuAction('stage-all', t('actions.stage'), command({ type: 'stage', paths }), blocked))
          if (section !== 'merge') actions.push(menuAction('discard-all', t('actions.discard'), command({ type: 'discard', paths }), { danger: true, ...blocked }))
        }
        actions.push(menuAction('copy-relative', t('menu.copyRelativePath'), copy(folder, 'menu.copiedRelativePath'), { separatorBefore: true }))
        if (typeof value.cwd === 'string' && value.cwd !== '') {
          actions.push(menuAction('copy-path', t('menu.copyPath'), copy(absolutePath(value.cwd, folder), 'menu.copiedPath')))
        }
        return actions
      }

      if (value.kind === 'section') {
        const section = value.section
        if (section === 'changes') {
          return [
            menuAction('stage-all', t('actions.stageAll'), command({ type: 'stageSection', section }), blocked),
            menuAction('discard-all', t('actions.discardAll'), command({ type: 'discardSection', section }), { danger: true, ...blocked }),
            menuAction('refresh', t('refresh'), command({ type: 'refresh' }), { separatorBefore: true, ...blocked }),
          ]
        }
        if (section === 'staged') {
          return [
            menuAction('unstage-all', t('actions.unstageAll'), command({ type: 'unstageSection', section }), blocked),
            menuAction('refresh', t('refresh'), command({ type: 'refresh' }), { separatorBefore: true, ...blocked }),
          ]
        }
        if (section === 'merge') {
          return [menuAction('stage-all', t('actions.stageAll'), command({ type: 'stageSection', section }), blocked)]
        }
        if (section === 'graph') {
          return [menuAction('refresh', t('menu.refreshHistory'), command({ type: 'refresh' }), blocked)]
        }
        return []
      }

      if (value.kind === 'commit') {
        const actions = []
        if (typeof value.oid === 'string' && value.oid !== '') {
          actions.push(menuAction('copy-id', t('menu.copyCommitId'), copy(value.oid, 'menu.copiedCommitId')))
        }
        if (typeof value.subject === 'string' && value.subject !== '') {
          actions.push(menuAction('copy-message', t('menu.copyCommitSubject'), copy(value.subject, 'menu.copiedCommitSubject')))
        }
        return actions
      }

      if (value.kind === 'diff') {
        const path = value.path
        if (typeof path !== 'string' || path === '') return []
        const actions = [menuAction('copy-relative', t('menu.copyRelativePath'), copy(path, 'menu.copiedRelativePath'))]
        if (typeof value.cwd === 'string' && value.cwd !== '') {
          actions.push(menuAction('copy-path', t('menu.copyPath'), copy(absolutePath(value.cwd, path), 'menu.copiedPath')))
        }
        return actions
      }

      return []
    }

    // ------------------------------------------------------------------
    // Small building blocks
    // ------------------------------------------------------------------

    function IconButton(props) {
      return h('button', {
        type: 'button',
        className: 'dshgg-iconBtn',
        'aria-label': props.label,
        title: props.title ?? props.label,
        disabled: props.disabled === true,
        onClick: props.onClick,
        'data-spinning': props.spinning === true ? 'true' : undefined,
      }, props.children)
    }

    function Section(props) {
      const actions = props.actions === undefined || props.actions === null ? null : props.actions
      const menuTrigger = typeof props.menuTrigger === 'function' ? props.menuTrigger : null
      const menuProps = menuTrigger === null || props.menuTarget === undefined
        ? null
        : menuTrigger(props.menuTarget, { tabIndex: -1, 'aria-haspopup': 'menu', title: props.menuHint })
      return h('section', { className: 'dshgg-section', 'data-section': props.id, 'aria-label': props.title },
        h('div', { className: 'dshgg-sectionHeader', ...(menuProps ?? {}) },
          h('button', {
            type: 'button',
            className: 'dshgg-sectionToggle',
            'aria-expanded': props.open,
            onClick: props.onToggle,
          },
          h('span', { className: 'dshgg-chevron', 'data-open': props.open === true ? 'true' : 'false' },
            h(ChevronRightIcon, { size: 12 })),
          h('span', { className: 'dshgg-sectionTitle' }, props.title),
          props.count === undefined || props.count === null ? null : h('span', { className: 'dshgg-sectionCount' }, String(props.count))),
          actions === null ? null : h('div', { className: 'dshgg-sectionActions' }, actions)),
        props.open === true ? h('div', { className: 'dshgg-sectionBody' }, props.children) : null)
    }

    function FolderRow(props) {
      const keyboard = {
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            props.onToggle()
          }
        },
      }
      const menuTrigger = typeof props.menuTrigger === 'function' ? props.menuTrigger : null
      const rowProps = menuTrigger === null || props.menuTarget === undefined
        ? keyboard
        : menuTrigger(props.menuTarget, { ...keyboard, 'aria-haspopup': 'menu', title: props.menuHint })
      return h('div', {
        className: 'dshgg-row dshgg-folderRow',
        style: { paddingLeft: `${4 + props.depth * 10}px` },
        role: 'button',
        tabIndex: 0,
        'aria-expanded': props.open,
        onClick: props.onToggle,
        ...rowProps,
      },
      h('span', { className: 'dshgg-chevron', 'data-open': props.open === true ? 'true' : 'false' },
        h(ChevronRightIcon, { size: 12 })),
      h('span', { className: 'dshgg-folderName' }, props.node.name))
    }

    function FileRow(props) {
      const entry = props.entry
      const letter = props.letter
      const name = baseName(entry.path)
      const actionButtons = []
      if (props.mode === 'staged') {
        actionButtons.push(h(IconButton, {
          key: 'unstage',
          label: props.t('actions.unstage'),
          title: props.t('actions.unstage'),
          disabled: props.busy === true,
          onClick: (event) => { event.stopPropagation(); props.onUnstage(entry) },
        }, h(MinusIcon, { size: 14 })))
      } else {
        actionButtons.push(h(IconButton, {
          key: 'stage',
          label: props.t('actions.stage'),
          title: props.t('actions.stage'),
          disabled: props.busy === true,
          onClick: (event) => { event.stopPropagation(); props.onStage(entry) },
        }, h(PlusIcon, { size: 14 })))
        if (props.mode !== 'merge' && typeof props.onDiscard === 'function') {
          actionButtons.push(h(IconButton, {
            key: 'discard',
            label: props.t('actions.discard'),
            title: props.t('actions.discard'),
            disabled: props.busy === true,
            onClick: (event) => { event.stopPropagation(); props.onDiscard(entry) },
          }, h(UndoIcon, { size: 14 })))
        }
      }
      const title = entry.origPath === undefined ? entry.path : `${entry.origPath} → ${entry.path}`
      const keyboard = {
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            props.onOpen(entry)
          }
        },
      }
      const menuTrigger = typeof props.menuTrigger === 'function' ? props.menuTrigger : null
      const rowProps = menuTrigger === null || props.menuTarget === undefined
        ? keyboard
        : menuTrigger(props.menuTarget, { ...keyboard, 'aria-haspopup': 'menu' })
      return h('div', {
        className: 'dshgg-row dshgg-fileRow',
        style: { paddingLeft: `${4 + props.depth * 10}px` },
        role: 'button',
        tabIndex: 0,
        'aria-label': `${props.t(statusKey(letter))} ${entry.path}`,
        title,
        onClick: () => props.onOpen(entry),
        ...rowProps,
      },
      h('span', { className: 'dshgg-status', 'data-status': letter }, letter),
      h('span', { className: 'dshgg-fileName' }, name),
      entry.origPath === undefined ? null : h('span', { className: 'dshgg-fileArrow', title: entry.origPath }, `\u2190 ${baseName(entry.origPath)}`),
      h('span', { className: 'dshgg-fileActions' }, actionButtons))
    }

    function renderTree(nodes, depth, context) {
      const rows = []
      const target = (kind, detail) => (context.menuTarget === undefined ? undefined : context.menuTarget(kind, detail))
      for (const node of nodes) {
        if (node.type === 'folder') {
          const open = context.collapsed[node.path] !== true
          rows.push(h(FolderRow, {
            key: `folder:${node.path}`,
            node,
            depth,
            open,
            onToggle: () => context.onToggleFolder(node.path),
            menuTrigger: context.menuTrigger,
            menuHint: context.menuHint,
            menuTarget: target('folder', { section: context.mode, path: node.path, paths: collectTreePaths(node) }),
          }))
          if (open) rows.push(...renderTree(node.children, depth + 1, context))
          continue
        }
        rows.push(h(FileRow, {
          key: `file:${node.entry.kind}:${node.entry.path}:${node.entry.x}:${node.entry.y}`,
          entry: node.entry,
          letter: node.entry.letter ?? '',
          depth,
          t: context.t,
          busy: context.busy,
          mode: context.mode,
          onOpen: context.onOpen,
          onStage: context.onStage,
          onUnstage: context.onUnstage,
          onDiscard: context.onDiscard,
          menuTrigger: context.menuTrigger,
          menuTarget: target('file', { section: context.mode, path: node.entry.path }),
        }))
      }
      return rows
    }

    function Banner(props) {
      return h('div', { className: 'dshgg-banner', 'data-kind': props.kind ?? 'error', role: props.kind === 'error' ? 'alert' : 'status' },
        h('span', { className: 'dshgg-bannerText' },
          h('span', null, props.title),
          props.detail === undefined || props.detail === '' ? null
            : h('div', { className: 'dshgg-bannerDetail' }, props.detail)),
        h('span', { className: 'dshgg-bannerActions' },
          props.onRetry === undefined ? null : h('button', { type: 'button', className: 'dshgg-linkBtn', onClick: props.onRetry }, props.retryLabel),
          props.onDismiss === undefined ? null : h(IconButton, { label: props.dismissLabel ?? 'Dismiss', onClick: props.onDismiss }, h(CloseIcon, { size: 12 }))))
    }

    function EmptyState(props) {
      return h('div', { className: 'dshgg-state' },
        h('span', { className: 'dshgg-stateIcon' }, props.icon),
        h('p', { className: 'dshgg-stateTitle' }, props.title),
        props.desc === undefined ? null : h('p', { className: 'dshgg-stateDesc' }, props.desc),
        props.action === undefined ? null : h('div', { className: 'dshgg-stateAction' }, props.action))
    }

    // ------------------------------------------------------------------
    // Source-control panel
    // ------------------------------------------------------------------

    function GitPanel(props) {
      const sessionId = props.sessionId
      const t = props.t
      const useTabInfo = props.useTabInfo
      const tabInfo = useTabInfo()
      const tab = tabInfo.tab
      const visible = tab.visible !== false
      const call = useMemo(() => createCaller(sessionId), [sessionId])
      const menuTrigger = useMemo(
        () => (typeof sessionId === 'string' && sessionId !== '' ? bindMenuTrigger(props.useContextMenu) : null),
        [props.useContextMenu, sessionId],
      )
      const panelId = useMemo(() => `git-panel-${++panelSequence}`, [])

      const [status, setStatus] = useState(null)
      const [loading, setLoading] = useState(true)
      const [loadFailure, setLoadFailure] = useState(null)
      const [actionFailure, setActionFailure] = useState(null)
      const [busy, setBusy] = useState(null)
      const [message, setMessage] = useState('')
      const [notice, setNotice] = useState(null)
      const [confirm, setConfirm] = useState(null)
      const [openSections, setOpenSections] = useState({ merge: true, staged: true, changes: true, graph: true })
      const [collapsed, setCollapsed] = useState({})
      const [graph, setGraph] = useState(null)
      const [graphLoading, setGraphLoading] = useState(false)
      const [graphFailure, setGraphFailure] = useState(null)
      const [branchMenu, setBranchMenu] = useState(false)
      const [branches, setBranches] = useState(null)
      const [branchLoading, setBranchLoading] = useState(false)
      const [branchFailure, setBranchFailure] = useState(null)

      const inFlight = useRef(false)
      const busyRef = useRef(null)
      const confirmRef = useRef(null)
      const mounted = useRef(true)
      const wrapRef = useRef(null)
      const commandRef = useRef(null)
      busyRef.current = busy
      confirmRef.current = confirm

      useEffect(() => () => { mounted.current = false }, [])

      useEffect(() => panelCommands.subscribe((command) => {
        const handler = commandRef.current
        if (typeof handler === 'function') handler(command)
      }), [])

      const loadStatus = useCallback(async (options = {}) => {
        if (inFlight.current) return
        inFlight.current = true
        if (options.silent !== true) setLoading(true)
        try {
          const value = await call('status')
          if (!mounted.current) return
          setStatus(value)
          setLoadFailure(null)
        } catch (error) {
          if (!mounted.current) return
          setLoadFailure(error)
        } finally {
          inFlight.current = false
          if (mounted.current) setLoading(false)
        }
      }, [call])

      const loadGraph = useCallback(async () => {
        if (mounted.current) setGraphLoading(true)
        try {
          const value = await call('history')
          if (!mounted.current) return
          setGraph(Array.isArray(value?.commits) ? value.commits : [])
          setGraphFailure(null)
        } catch (error) {
          if (!mounted.current) return
          if (error.code === 'not-a-repository') setGraph([])
          else setGraphFailure(error)
        } finally {
          if (mounted.current) setGraphLoading(false)
        }
      }, [call])

      const loadBranches = useCallback(async () => {
        if (mounted.current) setBranchLoading(true)
        try {
          const value = await call('branches')
          if (!mounted.current) return
          setBranches(Array.isArray(value?.branches) ? value.branches : [])
          setBranchFailure(null)
        } catch (error) {
          if (!mounted.current) return
          setBranchFailure(error)
        } finally {
          if (mounted.current) setBranchLoading(false)
        }
      }, [call])

      useEffect(() => {
        void loadStatus()
        void loadGraph()
      }, [loadStatus, loadGraph])

      useEffect(() => {
        if (!visible) return undefined
        const timer = setInterval(() => {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
          if (inFlight.current || busyRef.current !== null || confirmRef.current !== null) return
          void loadStatus({ silent: true })
        }, POLL_INTERVAL_MS)
        return () => clearInterval(timer)
      }, [visible, loadStatus])

      useEffect(() => {
        if (notice === null) return undefined
        const timer = setTimeout(() => { if (mounted.current) setNotice(null) }, 4000)
        return () => clearTimeout(timer)
      }, [notice])

      useEffect(() => {
        if (!branchMenu) return undefined
        const onPointerDown = (event) => {
          const wrap = wrapRef.current
          if (wrap !== null && wrap.contains(event.target)) return
          setBranchMenu(false)
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setBranchMenu(false)
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
        }
      }, [branchMenu])

      const perform = useCallback(async (name, operation, options = {}) => {
        if (busyRef.current !== null) return undefined
        busyRef.current = name
        setBusy(name)
        setActionFailure(null)
        try {
          const result = await operation()
          if (!mounted.current) return result
          if (options.notice !== undefined) setNotice(options.notice)
          if (options.after !== undefined) await options.after(result)
          await loadStatus({ silent: true })
          if (options.graph === true) await loadGraph()
          return result
        } catch (error) {
          if (mounted.current) setActionFailure(error)
          return undefined
        } finally {
          busyRef.current = null
          if (mounted.current) setBusy(null)
        }
      }, [loadStatus, loadGraph])

      const repo = status?.repo ?? null
      // The change list uses repository-relative paths, so the directory that
      // makes them absolute is the repository root, not the Session directory.
      // A no-repository status carries only the Session directory.
      const sessionDirectory = status?.cwd ?? status?.repo?.cwd
      const repoRoot = repo?.root ?? sessionDirectory
      const files = status?.files ?? []
      const mergeFiles = useMemo(() => files.filter((entry) => entry.conflict === true), [files])
      const stagedFiles = useMemo(() => files.filter((entry) => isStaged(entry)), [files])
      const changedFiles = useMemo(() => files.filter((entry) => isUnstaged(entry)), [files])
      const treeCache = useMemo(() => ({
        merge: buildTree(mergeFiles.map((entry) => ({ ...entry, letter: '!' }))),
        staged: buildTree(stagedFiles.map((entry) => ({ ...entry, letter: statusLetter(entry.x) }))),
        changes: buildTree(changedFiles.map((entry) => ({ ...entry, letter: entry.untracked === true ? 'U' : statusLetter(entry.y) }))),
      }), [mergeFiles, stagedFiles, changedFiles])
      const clean = repo !== null && mergeFiles.length === 0 && stagedFiles.length === 0 && changedFiles.length === 0

      const toggleSection = (id) => setOpenSections((current) => ({ ...current, [id]: current[id] !== true }))
      const toggleFolder = (path) => setCollapsed((current) => ({ ...current, [path]: current[path] !== true }))

      const stage = (entries) => perform('stage', () => call('stage', { paths: entries.map((entry) => entry.path) }))
      const unstage = (entries) => perform('unstage', () => call('unstage', { paths: entries.map((entry) => entry.path) }))
      const openDiff = useCallback((entry, mode) => {
        tab.actions.openTab(DIFF_KIND, {
          params: {
            path: entry.path,
            staged: mode === 'staged',
            untracked: entry.untracked === true,
            status: mode === 'staged' ? statusLetter(entry.x) : entry.untracked === true ? 'U' : statusLetter(entry.y),
            origPath: entry.origPath,
            cwd: repoRoot ?? undefined,
          },
        })
      }, [tab.actions, repoRoot])

      const requestCommit = () => {
        if (message.trim() === '' || busyRef.current !== null) return
        if (stagedFiles.length === 0) {
          if (files.length === 0) {
            setActionFailure(makeFailure('nothing-staged', t('commit.nothing')))
            return
          }
          setConfirm({ kind: 'commitAll' })
          return
        }
        void perform('commit', () => call('commit', { message }), {
          graph: true,
          after: (result) => {
            setMessage('')
            setNotice(t('commit.done', { hash: result?.commit ?? '' }))
          },
        })
      }

      const confirmAction = () => {
        const current = confirmRef.current
        if (current === null) return
        setConfirm(null)
        if (current.kind === 'commitAll') {
          void perform('commit', () => call('commit', { message, stageAll: true }), {
            graph: true,
            after: (result) => {
              setMessage('')
              setNotice(t('commit.done', { hash: result?.commit ?? '' }))
            },
          })
          return
        }
        if (current.kind === 'discard') {
          void perform('discard', () => call('discard', { path: current.entry.path, untracked: current.entry.untracked === true }))
          return
        }
        if (current.kind === 'discardAll') {
          const entries = current.entries
          void perform('discard', async () => {
            for (const entry of entries) await call('discard', { path: entry.path, untracked: entry.untracked === true })
          })
        }
      }

      const toggleBranchMenu = () => {
        const next = !branchMenu
        setBranchMenu(next)
        if (next && branches === null && branchFailure === null) void loadBranches()
      }

      const checkout = (branch) => {
        setBranchMenu(false)
        void perform('checkout', () => call('checkout', { branch }), {
          graph: true,
          after: () => {
            setBranches(null)
            setBranchFailure(null)
          },
        })
      }

      const refreshAll = () => {
        setActionFailure(null)
        void loadStatus({ silent: true })
        void loadGraph()
      }

      // Menu actions run in the host overlay, outside this tree. Executing their
      // commands here keeps confirmation, busy state, errors, and refresh shared
      // with the equivalent inline controls.
      const reportStale = () => setNotice(t('menu.stale'))
      commandRef.current = (command) => {
        if (command === null || typeof command !== 'object') return
        if (typeof command.sessionId === 'string' && command.sessionId !== sessionId) return
        if (typeof command.panelId === 'string' && command.panelId !== panelId) return
        if (repo === null) return
        const paths = Array.isArray(command.paths) ? command.paths.filter((path) => typeof path === 'string') : []
        const matches = (entry) => paths.includes(entry.path)
        if (command.type === 'refresh') {
          refreshAll()
          return
        }
        if (busyRef.current !== null) {
          setNotice(t('menu.busy'))
          return
        }
        if (command.type === 'open') {
          const pools = { staged: stagedFiles, merge: mergeFiles, changes: changedFiles }
          const preferred = pools[command.section] ?? changedFiles
          let section = command.section === 'staged' ? 'staged' : 'changes'
          let entry = preferred.find((candidate) => candidate.path === command.path)
          if (entry === undefined) {
            for (const [candidateSection, pool] of Object.entries(pools)) {
              entry = pool.find((candidate) => candidate.path === command.path)
              if (entry !== undefined) {
                section = candidateSection === 'staged' ? 'staged' : 'changes'
                break
              }
            }
          }
          if (entry === undefined) {
            reportStale()
            return
          }
          openDiff(entry, section)
          return
        }
        if (command.type === 'stage' || command.type === 'stageSection') {
          const entries = command.type === 'stageSection'
            ? command.section === 'merge' ? mergeFiles : changedFiles
            : files.filter((entry) => matches(entry) && entry.conflict === true)
              .concat(files.filter((entry) => matches(entry) && isUnstaged(entry)))
          if (entries.length === 0) {
            reportStale()
            return
          }
          void stage(entries)
          return
        }
        if (command.type === 'unstage' || command.type === 'unstageSection') {
          const entries = command.type === 'unstageSection'
            ? stagedFiles
            : files.filter((entry) => matches(entry) && isStaged(entry))
          if (entries.length === 0) {
            reportStale()
            return
          }
          void unstage(entries)
          return
        }
        if (command.type === 'discard') {
          const entries = changedFiles.filter(matches)
          if (entries.length === 0) {
            reportStale()
            return
          }
          setConfirm(command.single === true && entries.length === 1
            ? { kind: 'discard', entry: entries[0] }
            : { kind: 'discardAll', entries })
          return
        }
        if (command.type === 'discardSection') {
          if (changedFiles.length === 0) {
            reportStale()
            return
          }
          setConfirm({ kind: 'discardAll', entries: changedFiles })
        }
      }

      const menuSection = (section) => menuTarget(sessionId, 'section', { section, busy: busy !== null, panelId })
      const menuCommit = (commit) => menuTarget(sessionId, 'commit', {
        oid: commit.oid,
        shortOid: commit.shortOid,
        subject: commit.subject,
      })
      const menuTreeTarget = (kind, detail) => menuTarget(sessionId, kind, { ...detail, cwd: repoRoot, busy: busy !== null, panelId })
      const menu = { trigger: menuTrigger, sectionTarget: menuSection, commitTarget: menuCommit }

      const branchLabel = repo === null
        ? null
        : repo.detached === true
          ? t('branch.detached')
          : repo.unborn === true
            ? t('branch.unborn')
            : repo.branch
      const ahead = repo?.ahead ?? 0
      const behind = repo?.behind ?? 0
      const canAct = repo !== null && busy === null

      const sectionActions = {
        merge: null,
        staged: stagedFiles.length === 0 ? null : h(IconButton, {
          label: t('actions.unstageAll'),
          title: t('actions.unstageAll'),
          disabled: !canAct,
          onClick: () => { void unstage(stagedFiles) },
        }, h(MinusIcon, { size: 14 })),
        changes: changedFiles.length === 0 ? null : [
          h(IconButton, {
            key: 'stage-all',
            label: t('actions.stageAll'),
            title: t('actions.stageAll'),
            disabled: !canAct,
            onClick: () => { void stage(changedFiles) },
          }, h(PlusIcon, { size: 14 })),
          h(IconButton, {
            key: 'discard-all',
            label: t('actions.discardAll'),
            title: t('actions.discardAll'),
            disabled: !canAct,
            onClick: () => setConfirm({ kind: 'discardAll', entries: changedFiles }),
          }, h(UndoIcon, { size: 14 })),
        ],
      }

      const treeContext = {
        collapsed,
        t,
        busy: busy !== null,
        onToggleFolder: toggleFolder,
        onOpen: (entry) => openDiff(entry, 'changes'),
        onStage: (entry) => { void stage([entry]) },
        onUnstage: (entry) => { void unstage([entry]) },
        onDiscard: (entry) => setConfirm({ kind: 'discard', entry }),
        menuTrigger,
        menuTarget: menuTreeTarget,
        menuHint: t('menu.hint'),
        mode: 'changes',
      }

      const renderState = () => {
        if (loading && status === null) {
          return h(EmptyState, {
            icon: h(GitBranchIcon, { size: 26 }),
            title: t('loading'),
          })
        }
        if (loadFailure !== null && status === null) {
          if (loadFailure.code === 'git-unavailable') {
            return h(EmptyState, {
              icon: h(AlertIcon, { size: 26 }),
              title: t('gitUnavailable.title'),
              desc: t('gitUnavailable.desc'),
              action: h('button', { type: 'button', className: 'dshgg-btn dshgg-btnGhost', onClick: () => { void loadStatus() } }, t('retry')),
            })
          }
          return h(EmptyState, {
            icon: h(AlertIcon, { size: 26 }),
            title: t('error.title'),
            desc: errorText(t, loadFailure),
            action: h('button', { type: 'button', className: 'dshgg-btn dshgg-btnGhost', onClick: () => { void loadStatus() } }, t('retry')),
          })
        }
        if (status !== null && repo === null) {
          return h(EmptyState, {
            icon: h(GitBranchIcon, { size: 26 }),
            title: t('noRepo.title'),
            desc: t('noRepo.desc', { path: sessionDirectory ?? '' }),
            action: h('button', { type: 'button', className: 'dshgg-btn dshgg-btnGhost', onClick: refreshAll }, t('refresh')),
          })
        }
        return null
      }

      const stateView = renderState()
      const body = stateView !== null ? stateView : h(React.Fragment, null,
        mergeFiles.length === 0 ? null : h(Section, {
          id: 'merge', title: t('sections.merge'), count: mergeFiles.length,
          open: openSections.merge === true, onToggle: () => toggleSection('merge'), actions: sectionActions.merge,
          menuTrigger, menuHint: t('menu.hint'), menuTarget: menuSection('merge'),
        }, renderTree(treeCache.merge, 0, { ...treeContext, mode: 'merge', onOpen: (entry) => openDiff(entry, 'changes') })),
        stagedFiles.length === 0 ? null : h(Section, {
          id: 'staged', title: t('sections.staged'), count: stagedFiles.length,
          open: openSections.staged === true, onToggle: () => toggleSection('staged'), actions: sectionActions.staged,
          menuTrigger, menuHint: t('menu.hint'), menuTarget: menuSection('staged'),
        }, renderTree(treeCache.staged, 0, {
          ...treeContext,
          mode: 'staged',
          onOpen: (entry) => openDiff(entry, 'staged'),
          onStage: (entry) => { void stage([entry]) },
          onUnstage: (entry) => { void unstage([entry]) },
        })),
        changedFiles.length === 0 ? null : h(Section, {
          id: 'changes', title: t('sections.changes'), count: changedFiles.length,
          open: openSections.changes === true, onToggle: () => toggleSection('changes'), actions: sectionActions.changes,
          menuTrigger, menuHint: t('menu.hint'), menuTarget: menuSection('changes'),
        }, renderTree(treeCache.changes, 0, { ...treeContext, onOpen: (entry) => openDiff(entry, 'changes') })),
        clean ? h('div', { className: 'dshgg-clean' },
          h('span', { className: 'dshgg-cleanIcon' }, h(CheckCircleIcon, { size: 26 })),
          h('span', { className: 'dshgg-cleanTitle' }, t('clean.title')),
          h('span', { className: 'dshgg-cleanDesc' }, t('clean.desc'))) : null,
        graphRows(t, graph, graphLoading, graphFailure, openSections.graph === true, () => toggleSection('graph'), () => { void loadGraph() }, menu),
      )

      const commitHint = stagedFiles.length > 0 ? t('commit.hint') : t('commit.hintNone')
      const placeholder = repo === null ? t('commit.placeholder', { branch: '' }) : t('commit.placeholder', { branch: branchLabel ?? '' })

      return h('div', { className: 'dshgg-root', 'data-dsh-git-graph': '' },
        h('div', { className: 'dshgg-toolbar' },
          h('div', { className: 'dshgg-branchWrap', ref: wrapRef },
            h('button', {
              type: 'button',
              className: 'dshgg-branchChip',
              onClick: toggleBranchMenu,
              disabled: repo === null || busy !== null,
              'aria-haspopup': 'menu',
              'aria-expanded': branchMenu,
              title: repo === null ? t('noRepo.title') : t('branch.menu'),
            },
            h(GitBranchIcon, { size: 14 }),
            h('span', { className: 'dshgg-branchName' }, branchLabel ?? t('loading')),
            ahead > 0 ? h('span', { className: 'dshgg-sync', title: t('branch.ahead', { n: ahead }) }, h('span', null, '\u2191'), String(ahead)) : null,
            behind > 0 ? h('span', { className: 'dshgg-sync', title: t('branch.behind', { n: behind }) }, h('span', null, '\u2193'), String(behind)) : null,
            repo?.upstream !== undefined && repo?.upstream !== null
              ? h('span', { className: 'dshgg-upstream', title: t('branch.upstream', { name: repo.upstream }) }, repo.upstream)
              : null,
            h(ChevronDownIcon, { size: 12 })),
            branchMenu ? h(BranchMenu, {
              t,
              branches,
              loading: branchLoading,
              failure: branchFailure,
              onPick: checkout,
              onRetry: () => { void loadBranches() },
            }) : null),
          h('span', { className: 'dshgg-spacer' }),
          h(IconButton, {
            label: t('refresh'),
            title: t('refresh'),
            disabled: busy !== null,
            spinning: busy === 'refresh',
            onClick: refreshAll,
          }, h(RefreshIcon, { size: 14 }))),
        repo === null ? null : h('div', { className: 'dshgg-commitBox' },
          h('textarea', {
            className: 'dshgg-commitMessage',
            value: message,
            rows: 3,
            spellCheck: false,
            placeholder,
            'aria-label': t('commit.action'),
            disabled: busy !== null,
            onChange: (event) => setMessage(event.target.value),
            onKeyDown: (event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault()
                requestCommit()
              }
            },
          }),
          h('div', { className: 'dshgg-commitRow' },
            h('span', { className: 'dshgg-commitHint', title: commitHint }, commitHint),
            h('button', {
              type: 'button',
              className: 'dshgg-btn dshgg-btnPrimary',
              disabled: message.trim() === '' || busy !== null,
              onClick: requestCommit,
            }, busy === 'commit' ? t('commit.committing') : t('commit.action')))),
        loadFailure !== null && status !== null ? h(Banner, {
          title: t('error.title'),
          detail: errorText(t, loadFailure),
          retryLabel: t('retry'),
          onRetry: () => { void loadStatus() },
          dismissLabel: t('action.dismiss'),
          onDismiss: () => setLoadFailure(null),
        }) : null,
        actionFailure !== null ? h(Banner, {
          title: t('error.title'),
          detail: errorText(t, actionFailure),
          dismissLabel: t('action.dismiss'),
          onDismiss: () => setActionFailure(null),
        }) : null,
        notice !== null ? h('div', { className: 'dshgg-notice', role: 'status' }, notice) : null,
        h('div', { className: 'dshgg-scroll' }, body),
        confirm !== null ? h('div', { className: 'dshgg-confirm', role: 'alertdialog', 'aria-label': confirmTitle(t, confirm) },
          h('div', { className: 'dshgg-confirmText' },
            h('div', { className: 'dshgg-confirmTitle' }, confirmTitle(t, confirm)),
            confirmDescription(t, confirm) === '' ? null : h('div', { className: 'dshgg-confirmDesc' }, confirmDescription(t, confirm))),
          h('div', { className: 'dshgg-confirmActions' },
            h('button', { type: 'button', className: 'dshgg-btn dshgg-btnGhost', disabled: busy !== null, onClick: () => setConfirm(null) }, t('action.cancel')),
            h('button', { type: 'button', className: 'dshgg-btn dshgg-btnPrimary', disabled: busy !== null, onClick: confirmAction }, confirmActionLabel(t, confirm)))) : null,
      )
    }

    function confirmTitle(t, confirm) {
      if (confirm.kind === 'commitAll') return t('commit.emptyConfirm')
      if (confirm.kind === 'discardAll') return t('confirm.discardAllTitle', { n: confirm.entries.length })
      return t('confirm.discardTitle', { name: baseName(confirm.entry.path) })
    }

    function confirmDescription(t, confirm) {
      if (confirm.kind === 'commitAll') return ''
      if (confirm.kind === 'discardAll') return t('confirm.discardAllDesc')
      return confirm.entry.untracked === true ? t('confirm.deleteUntrackedDesc') : t('confirm.discardDesc')
    }

    function confirmActionLabel(t, confirm) {
      if (confirm.kind === 'commitAll') return t('commit.stageAll')
      return confirm.kind === 'discardAll' ? t('confirm.discardAll') : t('confirm.discard')
    }

    function BranchMenu(props) {
      const t = props.t
      let content
      if (props.loading === true && props.branches === null) {
        content = h('div', { className: 'dshgg-menuNote' }, t('branch.loading'))
      } else if (props.failure !== null) {
        content = h('div', { className: 'dshgg-menuNote' },
          errorText(t, props.failure), ' ',
          h('button', { type: 'button', className: 'dshgg-linkBtn', onClick: props.onRetry }, t('retry')))
      } else if (props.branches === null || props.branches.length === 0) {
        content = h('div', { className: 'dshgg-menuNote' }, t('branch.empty'))
      } else {
        content = props.branches.map((branch) => h('button', {
          key: branch.name,
          type: 'button',
          className: 'dshgg-menuItem',
          role: 'menuitemradio',
          'aria-checked': branch.current === true,
          disabled: branch.current === true,
          onClick: () => props.onPick(branch.name),
        },
        h('span', { className: 'dshgg-menuCheck' }, branch.current === true ? h(CheckIcon, { size: 12 }) : null),
        h('span', { className: 'dshgg-menuLabel' }, branch.name)))
      }
      return h('div', { className: 'dshgg-menu', role: 'menu', 'aria-label': t('branch.menu') }, content)
    }

    function graphRows(t, commits, loading, failure, open, onToggle, onRetry, menu) {
      const rows = []
      const trigger = menu === undefined ? null : menu.trigger
      if (loading === true && commits === null) {
        rows.push(h('div', { key: 'loading', className: 'dshgg-menuNote' }, t('graph.loading')))
      } else if (failure !== null) {
        rows.push(h(Banner, {
          key: 'error',
          title: t('error.title'),
          detail: errorText(t, failure),
          retryLabel: t('retry'),
          onRetry,
        }))
      } else if (commits === null || commits.length === 0) {
        rows.push(h('div', { key: 'empty', className: 'dshgg-menuNote' }, t('graph.empty')))
      } else {
        for (const commit of commits) {
          rows.push(h(GraphRow, {
            key: commit.oid,
            commit,
            t,
            menuTrigger: trigger,
            menuTarget: menu === undefined || trigger === null ? undefined : menu.commitTarget(commit),
          }))
        }
      }
      return h(Section, {
        id: 'graph',
        title: t('sections.graph'),
        count: commits === null ? undefined : commits.length,
        open: open,
        onToggle,
        menuTrigger: trigger,
        menuHint: t('menu.hint'),
        menuTarget: menu === undefined || trigger === null ? undefined : menu.sectionTarget('graph'),
      }, rows)
    }

    function GraphRow(props) {
      const commit = props.commit
      const t = props.t
      const refs = parseRefs(commit.refs)
      const visibleRefs = refs.slice(0, 3)
      const hidden = refs.length - visibleRefs.length
      const menuTrigger = typeof props.menuTrigger === 'function' ? props.menuTrigger : null
      const menuProps = menuTrigger === null || props.menuTarget === undefined
        ? null
        : menuTrigger(props.menuTarget, { tabIndex: 0, 'aria-haspopup': 'menu' })
      return h('div', {
        className: 'dshgg-graphRow',
        title: `${commit.shortOid} ${commit.subject} \u00b7 ${t('menu.hint')}`,
        ...(menuProps ?? {}),
      },
        h('pre', { className: 'dshgg-graphPrefix' }, commit.graph === '' ? '*' : commit.graph),
        h('div', { className: 'dshgg-graphBody' },
          h('div', { className: 'dshgg-graphSubject' }, commit.subject === '' ? t('graph.noSubject') : commit.subject),
          h('div', { className: 'dshgg-graphMeta' },
            h('span', { className: 'dshgg-graphHash' }, commit.shortOid),
            h('span', { className: 'dshgg-dot' }, '\u00b7'),
            h('span', null, commit.author),
            h('span', { className: 'dshgg-dot' }, '\u00b7'),
            h('span', null, formatAgo(t, commit.authoredAt)),
            visibleRefs.length === 0 ? null : h('span', { className: 'dshgg-refs' },
              visibleRefs.map((ref, index) => h('span', { key: `${ref.label}:${index}`, className: 'dshgg-ref', 'data-kind': ref.kind, title: ref.label }, ref.label)),
              hidden > 0 ? h('span', { key: 'more', className: 'dshgg-ref', title: refs.slice(3).map((ref) => ref.label).join(', ') }, `+${hidden}`) : null))))
    }

    // ------------------------------------------------------------------
    // Diff tab
    // ------------------------------------------------------------------

    function DiffPanel(props) {
      const sessionId = props.sessionId
      const t = props.t
      const tabInfo = props.useTabInfo()
      const tab = tabInfo.tab
      const params = tab.navigation?.params ?? {}
      const revision = tab.navigation?.revision ?? 0
      const call = useMemo(() => createCaller(sessionId), [sessionId])
      const menuTrigger = useMemo(
        () => (typeof sessionId === 'string' && sessionId !== '' ? bindMenuTrigger(props.useContextMenu) : null),
        [props.useContextMenu, sessionId],
      )
      const [state, setState] = useState({ phase: 'loading', diff: null, failure: null })
      const [reload, setReload] = useState(0)

      const hasTarget = typeof params.path === 'string' && params.path !== ''

      useEffect(() => {
        if (!hasTarget) {
          setState({ phase: 'empty', diff: null, failure: null })
          return undefined
        }
        let cancelled = false
        setState({ phase: 'loading', diff: null, failure: null })
        call('diff', {
          path: params.path,
          staged: params.staged === true,
          untracked: params.untracked === true,
        }).then((diff) => {
          if (!cancelled) setState({ phase: 'ready', diff, failure: null })
        }).catch((failure) => {
          if (!cancelled) setState({ phase: 'error', diff: null, failure })
        })
        return () => { cancelled = true }
      }, [call, hasTarget, params.path, params.staged, params.untracked, revision, reload])

      const badgeKind = params.untracked === true ? 'untracked' : params.staged === true ? 'staged' : 'unstaged'
      const badgeLabel = badgeKind === 'untracked' ? t('diff.untracked') : badgeKind === 'staged' ? t('diff.staged') : t('diff.unstaged')
      const headerMenu = menuTrigger === null || !hasTarget
        ? null
        : menuTrigger(menuTarget(sessionId, 'diff', { path: params.path, cwd: params.cwd }), { tabIndex: -1, 'aria-haspopup': 'menu', title: t('menu.hint') })
      const header = hasTarget
        ? h('div', { className: 'dshgg-diffHeader', ...(headerMenu ?? {}) },
          h('span', { className: 'dshgg-diffPath' },
            h('span', { className: 'dshgg-diffName' }, baseName(params.path)),
            params.origPath === undefined || params.origPath === null || params.origPath === ''
              ? null
              : h('span', { className: 'dshgg-diffFrom' }, t('diff.from', { path: params.origPath }))),
          h('span', { className: 'dshgg-diffBadge', 'data-kind': badgeKind }, badgeLabel),
          state.phase === 'ready' && state.diff !== null && state.diff.binary !== true
            ? h('span', { className: 'dshgg-diffStats' },
              h('span', { className: 'dshgg-diffAdd' }, `+${state.diff.additions}`),
              h('span', { className: 'dshgg-diffDel' }, `\u2212${state.diff.deletions}`))
            : null,
          h(IconButton, {
            label: t('diff.refresh'),
            title: t('diff.refresh'),
            onClick: () => setReload((value) => value + 1),
          }, h(RefreshIcon, { size: 14 })))
        : null

      let content
      if (!hasTarget) {
        content = h(EmptyState, {
          icon: h(FileIcon, { size: 26 }),
          title: t('diff.title'),
          desc: t('diff.pick'),
        })
      } else if (state.phase === 'loading') {
        content = h('div', { className: 'dshgg-diffNote' }, t('diff.loading'))
      } else if (state.phase === 'error') {
        content = h(Banner, {
          title: t('diff.error'),
          detail: errorText(t, state.failure),
          retryLabel: t('retry'),
          onRetry: () => setReload((value) => value + 1),
        })
      } else {
        content = renderDiff(t, state.diff)
      }

      return h('div', { className: 'dshgg-diffRoot', 'data-dsh-git-graph-diff': '' },
        header,
        h('div', { className: 'dshgg-diffBody' }, content))
    }

    function renderDiff(t, diff) {
      if (diff === null || diff === undefined) return h('div', { className: 'dshgg-diffNote' }, t('diff.empty'))
      if (diff.binary === true) return h('div', { className: 'dshgg-diffNote' }, t('diff.binary'))
      const hunks = Array.isArray(diff.hunks) ? diff.hunks : []
      if (hunks.length === 0) return h('div', { className: 'dshgg-diffNote' }, t('diff.empty'))
      const rows = []
      let rendered = 0
      let clipped = false
      if (diff.truncated === true) rows.push(h('div', { key: 'truncated', className: 'dshgg-diffNote' }, t('diff.truncated')))
      for (let index = 0; index < hunks.length; index += 1) {
        const hunk = hunks[index]
        rows.push(h('div', { key: `hunk:${index}`, className: 'dshgg-hunkHeader' }, hunk.header ?? ''))
        let oldLine = hunk.oldStart ?? 0
        let newLine = hunk.newStart ?? 0
        for (let lineIndex = 0; lineIndex < hunk.lines.length; lineIndex += 1) {
          if (rendered >= MAX_RENDERED_DIFF_LINES) { clipped = true; break }
          const line = hunk.lines[lineIndex]
          let oldNumber = ''
          let newNumber = ''
          if (line.t === ' ') {
            oldNumber = String(oldLine)
            newNumber = String(newLine)
            oldLine += 1
            newLine += 1
          } else if (line.t === '-') {
            oldNumber = String(oldLine)
            oldLine += 1
          } else {
            newNumber = String(newLine)
            newLine += 1
          }
          rows.push(h('div', { key: `line:${index}:${lineIndex}`, className: 'dshgg-diffLine', 'data-type': line.t },
            h('span', { className: 'dshgg-gutter' }, oldNumber),
            h('span', { className: 'dshgg-gutter' }, newNumber),
            h('span', { className: 'dshgg-marker' }, line.t === ' ' ? '' : line.t),
            h('span', { className: 'dshgg-code' }, line.text === '' ? ' ' : line.text)))
          rendered += 1
        }
        if (clipped) break
      }
      if (clipped) rows.push(h('div', { key: 'clipped', className: 'dshgg-diffNote' }, t('diff.truncated')))
      return rows
    }

    // ------------------------------------------------------------------
    // Tab titles
    // ------------------------------------------------------------------

    function GitTabTitle(props) {
      const tabInfo = props.useTabInfo()
      const title = typeof props.t === 'function' ? props.t('title') : tabInfo.tab.title
      return h('span', { className: 'dshgg-title' }, h(GitBranchIcon, { size: 14 }), h('span', { className: 'dshgg-titleText' }, title))
    }

    function DiffTabTitle(props) {
      const tabInfo = props.useTabInfo()
      const params = tabInfo.tab.navigation?.params ?? {}
      const name = typeof params.path === 'string' && params.path !== '' ? baseName(params.path) : tabInfo.tab.title
      return h('span', { className: 'dshgg-title' }, h(FileIcon, { size: 14 }), h('span', { className: 'dshgg-titleText' }, name))
    }

    // ------------------------------------------------------------------
    // Plugin
    // ------------------------------------------------------------------

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

    return { inject, apply }
  },
})
