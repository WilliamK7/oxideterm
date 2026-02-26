/**
 * Shared keyboard shortcuts data for Help views and ShortcutsModal.
 *
 * Single source of truth — used by both SettingsView HelpAboutSection
 * and KeyboardShortcutsModal.
 */

import type { TFunction } from 'i18next';

export type ShortcutEntry = {
  label: string;
  mac: string;
  other: string;
};

export type ShortcutCategory = {
  id: string;
  title: string;
  shortcuts: ShortcutEntry[];
};

/**
 * Build the full shortcut categories list using the current t() function.
 * Both SettingsView and KeyboardShortcutsModal call this.
 */
export function getShortcutCategories(t: TFunction): ShortcutCategory[] {
  return [
    {
      id: 'app',
      title: t('settings_view.help.category_app'),
      shortcuts: [
        { label: t('settings_view.help.shortcut_new_tab'), mac: '⌘T', other: 'Ctrl+T' },
        { label: t('settings_view.help.shortcut_shell_launcher'), mac: '⌘⇧T', other: 'Ctrl+Shift+T' },
        { label: t('settings_view.help.shortcut_close_tab'), mac: '⌘W', other: 'Ctrl+W' },
        { label: t('settings_view.help.shortcut_next_tab'), mac: '⌘}', other: 'Ctrl+Tab' },
        { label: t('settings_view.help.shortcut_prev_tab'), mac: '⌘{', other: 'Ctrl+Shift+Tab' },
        { label: t('settings_view.help.shortcut_go_to_tab'), mac: '⌘1-9', other: 'Ctrl+1-9' },
        { label: t('settings_view.help.shortcut_new_connection'), mac: '⌘N', other: 'Ctrl+N' },
        { label: t('settings_view.help.shortcut_command_palette'), mac: '⌘K', other: 'Ctrl+K' },
        { label: t('settings_view.help.shortcut_toggle_sidebar'), mac: '⌘\\', other: 'Ctrl+\\' },
        { label: t('settings_view.help.shortcut_settings'), mac: '⌘,', other: 'Ctrl+,' },
        { label: t('settings_view.help.shortcut_zen_mode'), mac: '⌘⇧Z', other: 'Ctrl+Shift+Z' },
        { label: t('settings_view.help.shortcut_keyboard_shortcuts'), mac: '⌘/', other: 'Ctrl+/' },
      ],
    },
    {
      id: 'terminal',
      title: t('settings_view.help.category_terminal'),
      shortcuts: [
        { label: t('settings_view.help.shortcut_find'), mac: '⌘F', other: 'Ctrl+Shift+F' },
        { label: t('settings_view.help.shortcut_ai_panel'), mac: '⌘I', other: 'Ctrl+Shift+I' },
        { label: t('settings_view.help.shortcut_close_panel'), mac: 'Esc', other: 'Esc' },
      ],
    },
    {
      id: 'split',
      title: t('settings_view.help.category_split'),
      shortcuts: [
        { label: t('settings_view.help.shortcut_split_h'), mac: '⌘⇧E', other: 'Ctrl+Shift+E' },
        { label: t('settings_view.help.shortcut_split_v'), mac: '⌘⇧D', other: 'Ctrl+Shift+D' },
        { label: t('settings_view.help.shortcut_close_pane'), mac: '⌘⇧W', other: 'Ctrl+Shift+W' },
        { label: t('settings_view.help.shortcut_nav_pane'), mac: '⌘⌥Arrow', other: 'Ctrl+Alt+Arrow' },
      ],
    },
    {
      id: 'file_manager',
      title: t('settings_view.help.category_file_manager'),
      shortcuts: [
        { label: t('settings_view.help.shortcut_select_all'), mac: '⌘A', other: 'Ctrl+A' },
        { label: t('settings_view.help.shortcut_copy'), mac: '⌘C', other: 'Ctrl+C' },
        { label: t('settings_view.help.shortcut_cut'), mac: '⌘X', other: 'Ctrl+X' },
        { label: t('settings_view.help.shortcut_paste'), mac: '⌘V', other: 'Ctrl+V' },
        { label: t('settings_view.help.shortcut_rename'), mac: 'F2', other: 'F2' },
        { label: t('settings_view.help.shortcut_delete'), mac: 'Delete', other: 'Delete' },
        { label: t('settings_view.help.shortcut_quick_look'), mac: 'Space', other: 'Space' },
        { label: t('settings_view.help.shortcut_open'), mac: 'Enter', other: 'Enter' },
      ],
    },
    {
      id: 'sftp',
      title: t('settings_view.help.category_sftp'),
      shortcuts: [
        { label: t('settings_view.help.shortcut_select_all'), mac: '⌘A', other: 'Ctrl+A' },
        { label: t('settings_view.help.shortcut_quick_look'), mac: 'Space', other: 'Space' },
        { label: t('settings_view.help.shortcut_sftp_enter_dir'), mac: 'Enter', other: 'Enter' },
        { label: t('settings_view.help.shortcut_sftp_upload'), mac: '→', other: '→' },
        { label: t('settings_view.help.shortcut_sftp_download'), mac: '←', other: '←' },
        { label: t('settings_view.help.shortcut_rename'), mac: 'F2', other: 'F2' },
        { label: t('settings_view.help.shortcut_delete'), mac: 'Delete', other: 'Delete' },
      ],
    },
    {
      id: 'editor',
      title: t('settings_view.help.category_editor'),
      shortcuts: [
        { label: t('settings_view.help.shortcut_save'), mac: '⌘S', other: 'Ctrl+S' },
        { label: t('settings_view.help.shortcut_close'), mac: 'Esc', other: 'Esc' },
      ],
    },
  ];
}
