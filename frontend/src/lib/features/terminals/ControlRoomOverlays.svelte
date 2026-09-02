<script lang="ts">
  import DevicesDrawer from '$lib/components/devices-drawer.svelte';
  import SettingsDrawer from '$lib/components/settings-drawer.svelte';
  import { templatesState } from '$lib/features/templates/templates.svelte';
  import type { TerminalTemplate } from '$lib/features/templates/templates';
  import { terminalSessions } from '$lib/state/terminal-sessions.svelte';
  import HistoryDrawer from './HistoryDrawer.svelte';
  import type { LauncherTab } from './launcher';
  import { terminalHistory } from './terminal-history.svelte';
  import type { TerminalHistoryEntry } from './history';
  import type { TerminalProfile, SoftKeyboardKey } from './types';
  import type { Workspace } from './use-workspaces.svelte';
  import type { NotificationSettings, SoftKeyboardSettings } from './use-app-settings.svelte';

  interface Props {
    launcherOpen: boolean;
    launcherTab: LauncherTab;
    launcherCreatingKey: string | null;
    overviewOpen: boolean;
    templatesOpen: boolean;
    historyOpen: boolean;
    devicesOpen: boolean;
    settingsOpen: boolean;
    historyRestoring: boolean;
    workspaces: Workspace[];
    activeWorkspaceId: string;
    liveIds: Set<string>;
    notifications: NotificationSettings;
    softKeyboard: SoftKeyboardSettings;
    onLauncherOpenChange: (open: boolean) => void;
    onLauncherTabChange: (tab: LauncherTab) => void;
    onLaunchProfile: (profile: TerminalProfile) => Promise<boolean>;
    onLaunchEnvironment: (environmentId: string) => Promise<boolean>;
    onLaunchAgent: (agentId: string, options: { dangerouslyAllow?: boolean; useActiveDir?: boolean }) => Promise<boolean>;
    onLaunchTemplate: (template: TerminalTemplate) => Promise<boolean>;
    onManageTemplates: () => void;
    onOverviewClose: () => void;
    onTemplatesClose: () => void;
    onHistoryOpenChange: (open: boolean) => void;
    onOpenHistoryEntry: (entry: TerminalHistoryEntry) => void | Promise<void>;
    onSettingsOpenChange: (open: boolean) => void;
    onDevicesOpenChange: (open: boolean) => void;
    onUpdateNotifications: (patch: Partial<NotificationSettings>) => void;
    onUpdateSoftKeyboard: (patch: Partial<SoftKeyboardSettings>) => void;
    onSetSoftKeyVisible: (key: SoftKeyboardKey, visible: boolean) => void;
    onOpenDevices: () => void;
    onExportBackup: () => void;
    onImportBackup: () => void | Promise<void>;
    onResetDefaults: () => void;
  }

  let {
    launcherOpen,
    launcherTab,
    launcherCreatingKey,
    overviewOpen,
    templatesOpen,
    historyOpen,
    devicesOpen,
    settingsOpen,
    historyRestoring,
    workspaces,
    activeWorkspaceId,
    liveIds,
    notifications,
    softKeyboard,
    onLauncherOpenChange,
    onLauncherTabChange,
    onLaunchProfile,
    onLaunchEnvironment,
    onLaunchAgent,
    onLaunchTemplate,
    onManageTemplates,
    onOverviewClose,
    onTemplatesClose,
    onHistoryOpenChange,
    onOpenHistoryEntry,
    onSettingsOpenChange,
    onDevicesOpenChange,
    onUpdateNotifications,
    onUpdateSoftKeyboard,
    onSetSoftKeyVisible,
    onOpenDevices,
    onExportBackup,
    onImportBackup,
    onResetDefaults
  }: Props = $props();
</script>

{#if launcherOpen}
  {#await import('./LauncherDrawer.svelte') then launcherModule}
    {@const LauncherDrawer = launcherModule.default}
    <LauncherDrawer
      open={launcherOpen}
      tab={launcherTab}
      profiles={terminalSessions.profiles}
      environments={terminalSessions.environments}
      agentProfiles={terminalSessions.agentProfiles}
      templates={templatesState.templates}
      creatingKey={launcherCreatingKey}
      onOpenChange={onLauncherOpenChange}
      onTabChange={onLauncherTabChange}
      onLaunchProfile={onLaunchProfile}
      onLaunchEnvironment={onLaunchEnvironment}
      onLaunchAgent={onLaunchAgent}
      onLaunchTemplate={onLaunchTemplate}
      onManageTemplates={onManageTemplates}
    />
  {/await}
{/if}

{#if overviewOpen}
  {#await import('./OverviewDrawer.svelte') then overviewModule}
    {@const OverviewDrawer = overviewModule.default}
    <OverviewDrawer onClose={onOverviewClose} />
  {/await}
{/if}



{#if templatesOpen}
  {#await import('$lib/features/templates/TemplatesDrawer.svelte') then templatesModule}
    {@const TemplatesDrawer = templatesModule.default}
    <TemplatesDrawer
      templates={templatesState.templates}
      profiles={terminalSessions.profiles}
      agentProfiles={terminalSessions.agentProfiles}
      environments={terminalSessions.environments}
      {workspaces}
      activeSession={terminalSessions.active}
      {activeWorkspaceId}
      onClose={onTemplatesClose}
      onCreate={templatesState.create.bind(templatesState)}
      onUpdate={templatesState.update.bind(templatesState)}
      onDelete={templatesState.delete.bind(templatesState)}
      onDuplicate={templatesState.duplicate.bind(templatesState)}
      onLaunch={onLaunchTemplate}
    />
  {/await}
{/if}


<HistoryDrawer
  open={historyOpen}
  history={terminalHistory.entries}
  liveIds={liveIds}
  restoring={historyRestoring}
  onOpenChange={onHistoryOpenChange}
  onOpenEntry={(entry) => void onOpenHistoryEntry(entry)}
  onRemoveEntry={terminalHistory.remove.bind(terminalHistory)}
  onClearHistory={() => terminalHistory.clear()}
/>

<SettingsDrawer
  open={settingsOpen}
  {notifications}
  {softKeyboard}
  onOpenChange={onSettingsOpenChange}
  {onUpdateNotifications}
  {onUpdateSoftKeyboard}
  {onSetSoftKeyVisible}
  {onOpenDevices}
  {onExportBackup}
  onImportBackup={() => void onImportBackup()}
  {onResetDefaults}
/>
<DevicesDrawer open={devicesOpen} onOpenChange={onDevicesOpenChange} />
