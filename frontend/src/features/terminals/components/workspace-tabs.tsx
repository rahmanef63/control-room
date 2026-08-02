'use client';

import { memo, useEffect, useRef, useState } from 'react';

import { Plus, X } from 'lucide-react';

import type { Workspace } from '@/features/terminals/hooks/use-workspaces';

interface WorkspaceTabsProps {
  workspaces: Workspace[];
  activeId: string;
  sessionCounts: Record<string, number>;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function WorkspaceTabsComponent({
  workspaces,
  activeId,
  sessionCounts,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: WorkspaceTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  function startEdit(workspace: Workspace) {
    setEditingId(workspace.id);
    setEditValue(workspace.name);
  }

  function commitEdit() {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  }

  return (
    <div className="workspace-tabs" role="tablist" aria-label="Workspaces">
      {workspaces.map((workspace) => {
        const count = sessionCounts[workspace.id] ?? 0;
        const isActive = workspace.id === activeId;
        const isEditing = editingId === workspace.id;
        return (
          <div
            key={workspace.id}
            className="workspace-tab"
            role="tab"
            aria-selected={isActive}
            data-active={isActive || undefined}
          >
            <button
              type="button"
              onClick={() => (isActive ? startEdit(workspace) : onSelect(workspace.id))}
              onDoubleClick={() => startEdit(workspace)}
              className="workspace-tab-main"
              title={isActive ? 'Double-click to rename' : `Switch to ${workspace.name}`}
            >
              <span
                className="workspace-tab-dot"
                style={workspace.color ? { backgroundColor: workspace.color } : undefined}
              />
              {isEditing ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') {
                      setEditingId(null);
                      setEditValue('');
                    }
                  }}
                  className="workspace-tab-input"
                />
              ) : (
                <span className="workspace-tab-name">{workspace.name}</span>
              )}
              {count > 0 ? <span className="workspace-tab-count">{count}</span> : null}
            </button>
            {workspaces.length > 1 && !isEditing ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete workspace "${workspace.name}"? Sessions stay live but lose their group.`)) {
                    onDelete(workspace.id);
                  }
                }}
                className="workspace-tab-close"
                aria-label={`Delete workspace ${workspace.name}`}
                title="Delete workspace"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onCreate}
        className="workspace-tab-add"
        title="New workspace"
        aria-label="New workspace"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// Memoized for the same reason as TerminalsTopbar — skip per-activity-tick
// re-renders; props only change on real workspace/session-count changes.
export const WorkspaceTabs = memo(WorkspaceTabsComponent);
