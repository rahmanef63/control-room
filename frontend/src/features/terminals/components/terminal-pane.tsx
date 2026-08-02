'use client';

import '@xterm/xterm/css/xterm.css';

import { memo, useState } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';

import type { RuntimeResolvedAgentProfile, TerminalSession } from '@/shared/types/contracts';

import {
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  type ActivityState,
  type SoftKeyboardKey,
} from '@/features/terminals/lib/utils';
import { FileExplorerDialog } from '@/features/terminals/components/file-explorer-dialog';
import { PaneHeader } from '@/features/terminals/components/pane-header';
import { PaneScrollRail } from '@/features/terminals/components/pane-scroll-rail';
import { PaneSoftKeyboard } from '@/features/terminals/components/pane-soft-keyboard';
import { usePaneTerminal } from '@/features/terminals/hooks/use-pane-terminal';
import { useAlfaWatchers } from '@/features/terminals/hooks/use-alfa-watchers';
import { useSessionColors } from '@/features/terminals/hooks/use-session-colors';

function TerminalPaneComponent({
  session,
  active,
  onUpdate,
  onClose,
  fullscreen,
  onToggleFullscreen,
  fontSize,
  onFontSizeChange,
  onActivityChange,
  viewMode,
  onRequestFocus,
  agentProfiles,
  broadcast,
  isBroadcastTarget,
  onBroadcastInput,
  onDuplicate,
  softKeyVisible,
  keyboardVisible,
  workspaces,
  currentWorkspaceId,
  onMoveToWorkspace,
  heartbeatGlow,
  boundAgentProfileId,
  onBindAgent,
  onUnbindAgent,
}: {
  session: TerminalSession;
  active: boolean;
  onUpdate: (session: TerminalSession) => void;
  onClose: (id: string) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  fontSize: number;
  onFontSizeChange: (id: string, size: number) => void;
  onActivityChange: (id: string, state: ActivityState) => void;
  viewMode: 'single' | 'grid';
  onRequestFocus: (id: string) => void;
  agentProfiles: RuntimeResolvedAgentProfile[];
  broadcast: boolean;
  isBroadcastTarget: boolean;
  onBroadcastInput: (data: string, sourceId?: string) => void;
  onDuplicate: (session: TerminalSession) => void;
  softKeyVisible: Record<SoftKeyboardKey, boolean>;
  keyboardVisible: boolean;
  workspaces: Array<{ id: string; name: string; color?: string }>;
  currentWorkspaceId: string;
  onMoveToWorkspace: (sessionId: string, workspaceId: string) => void;
  heartbeatGlow: boolean;
  boundAgentProfileId?: string;
  onBindAgent: (sessionId: string, agentProfileId: string) => void;
  onUnbindAgent: (sessionId: string) => void;
}) {
  const { colorOf, setColor, clearColor, colors } = useSessionColors();
  const { watcherOf, watchersOfTarget } = useAlfaWatchers();
  const parentAlfa = watchersOfTarget(session.id)[0];
  const isTargetPane = !!parentAlfa;
  const selfWatcher = watcherOf(session.id);
  const selfIsAlfa = !!selfWatcher;
  const parentAlfaLabel = parentAlfa
    ? parentAlfa.label?.trim() || parentAlfa.id.slice(0, 8)
    : undefined;
  const paneColor = isTargetPane
    ? colorOf(parentAlfa.id) ?? colorOf(session.id)
    : colorOf(session.id);
  const colorPickerId = isTargetPane ? parentAlfa.id : session.id;
  const colorHasOverride = colorPickerId in colors;

  const [explorerOpen, setExplorerOpen] = useState(false);

  const term = usePaneTerminal({
    session,
    active,
    fullscreen,
    fontSize,
    boundAgentProfileId,
    broadcast,
    onUpdate,
    onActivityChange,
    onBroadcastInput,
    onFontSizeChange,
  });

  return (
    <>
      <article
        data-profile={session.profile}
        data-activity={term.showActivity ? term.activityState : undefined}
        data-view-mode={viewMode}
        data-keyboard-visible={keyboardVisible ? 'true' : 'false'}
        data-heartbeat-glow={heartbeatGlow ? 'on' : undefined}
        className="terminal-pane-mobile"
      >
        <PaneHeader
          session={session}
          renaming={term.renaming}
          renameValue={term.renameValue}
          renameBusy={term.renameBusy}
          onRenameValueChange={term.setRenameValue}
          onStartRename={term.startRename}
          onCancelRename={term.cancelRename}
          onSubmitRename={() => void term.submitRename()}
          showActivity={term.showActivity}
          activityState={term.activityState}
          activityLabel={term.activityLabel}
          selfIsAlfa={selfIsAlfa}
          selfWatcher={selfWatcher}
          isTargetPane={isTargetPane}
          parentAlfaLabel={parentAlfaLabel}
          paneColor={paneColor}
          connectionState={term.connectionState}
          rttMs={term.rttMs}
          menu={{
            colorProps: {
              sessionId: colorPickerId,
              color: paneColor,
              hasOverride: colorHasOverride,
              onPick: (next) => setColor(colorPickerId, next),
              onClear: () => clearColor(colorPickerId),
              disabled: isTargetPane,
              title: isTargetPane
                ? `Inherits color from alfa "${parentAlfa.label ?? parentAlfa.id.slice(0, 8)}"`
                : undefined,
            },
            aiProps: {
              agentProfiles,
              sessionId: session.id,
              cwd: session.cwd,
              canSendInput: term.canSendInput,
              boundAgentProfileId,
              onInjectAgent: (targetId, command, agentProfileId) => {
                term.sendInput(`${command}\r`);
                onBindAgent(targetId, agentProfileId);
              },
              onUnbindAgent,
            },
            actionsProps: {
              agentProfiles,
              disabled: !term.canSendInput,
              onInject: term.injectCommand,
              cwd: session.cwd,
              workspaces,
              currentWorkspaceId,
              zoomDisabledIn: term.resolvedFontSize >= MAX_FONT_SIZE,
              zoomDisabledOut: term.resolvedFontSize <= MIN_FONT_SIZE,
              fullscreen,
              viewMode,
              onBrowse: () => setExplorerOpen(true),
              onDuplicate: () => onDuplicate(session),
              onZoomIn: () => term.zoom(1),
              onZoomOut: () => term.zoom(-1),
              onZoomMin: () => term.zoomTo(MIN_FONT_SIZE),
              onZoomMax: () => term.zoomTo(MAX_FONT_SIZE),
              onMoveToWorkspace: (workspaceId) => onMoveToWorkspace(session.id, workspaceId),
              onToggleFullscreen,
              onFocus: () => onRequestFocus(session.id),
              onClose: () => onClose(session.id),
            },
          }}
        />

        {term.error ? (
          <div className="border-b border-destructive/20 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
            {term.error}
          </div>
        ) : null}

        {broadcast && isBroadcastTarget ? (
          <div className="pane-broadcast-banner">
            Broadcast target — this pane mirrors input from any sibling in the group.
          </div>
        ) : null}

        <FileExplorerDialog
          open={explorerOpen}
          onClose={() => setExplorerOpen(false)}
          onPick={(path) => term.changeDir(path)}
        />

        <div
          className="terminal-pane-screen"
          onClick={term.focusTerminal}
          onPaste={(event) => {
            // Image paste (Ctrl+V screenshot) uploads; text paste falls through
            // to xterm's own handler.
            if (term.handlePasteEvent(event.clipboardData)) event.preventDefault();
          }}
          onDragOver={(event) => {
            if (!term.canSendInput || !event.dataTransfer.types.includes('Files')) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            if (!term.dragOver) term.setDragOver(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) term.setDragOver(false);
          }}
          onDrop={(event) => {
            if (!event.dataTransfer.types.includes('Files')) return;
            event.preventDefault();
            term.setDragOver(false);
            term.handleDrop(event.dataTransfer);
          }}
        >
          <div
            ref={term.containerRef}
            className="relative z-10 h-full w-full overflow-hidden rounded-[calc(var(--radius)+0.25rem)] border border-border/60 bg-[#101418]"
          />
          {term.dragOver || term.uploading ? (
            <div className="pane-drop-overlay">
              {term.uploading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Uploading…</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-6 w-6" />
                  <span>Drop to upload — path drops at the prompt</span>
                </>
              )}
            </div>
          ) : null}
        </div>

        {keyboardVisible ? (
          <PaneSoftKeyboard
            canSendInput={term.canSendInput}
            softKeyVisible={softKeyVisible}
            onSendInput={term.sendInput}
            onSendControlKey={term.sendControlKey}
            onPaste={() => void term.pasteFromClipboard()}
            onCopy={() => void term.copyTerminalContent()}
            onSelectAllAndCopy={() => void term.selectAndCopyAll()}
            onClear={term.clearTerminal}
            onAttachFiles={(files) => void term.uploadDroppedFiles(files)}
          />
        ) : null}
      </article>
      <PaneScrollRail onScroll={term.railScroll} />
    </>
  );
}

// Memoized: with many panes open, an activity-state change in one pane (or any
// parent re-render) would otherwise re-render every pane. The props it receives
// are stable refs/values from the parent's useCallback'd handlers, so memo lets
// untouched panes skip the render — the core multi-pane perf win. Internal store
// subscriptions (colors, watchers, pty stream) still re-render their own pane.
export const TerminalPane = memo(TerminalPaneComponent);
