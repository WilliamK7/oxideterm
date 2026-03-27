// src/components/ide/IdeEditorTabs.tsx
import { useCallback, useState, useRef, useMemo } from 'react';
import { X, Circle, Loader2, Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useIdeTabs, useIdeStore, IdeTab } from '../../store/ideStore';
import { cn } from '../../lib/utils';
import { FileIcon } from '../../lib/fileIcons';
import { IdeSaveConfirmDialog } from './dialogs/IdeSaveConfirmDialog';

interface TabItemProps {
  tab: IdeTab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  onTogglePin: () => void;
}

function TabItem({ tab, isActive, onActivate, onClose, onTogglePin }: TabItemProps) {
  const { t } = useTranslation();
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : undefined,
  };
  
  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  }, [onClose]);
  
  // 中键点击关闭
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      onClose();
    }
  }, [onClose]);
  
  // 双击切换 pin 状态
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onTogglePin();
  }, [onTogglePin]);
  
  // 右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  }, []);
  
  const closeContextMenu = useCallback(() => {
    setContextMenuPos(null);
  }, []);
  
  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={cn(
          'group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer',
          'border-r border-theme-border/50 transition-colors',
          'hover:bg-theme-bg-hover/30',
          isActive 
            ? 'bg-theme-bg-hover border-b-2 border-b-theme-accent' 
            : 'bg-theme-bg/50',
          isDragging && 'shadow-lg rounded',
        )}
        onClick={onActivate}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Pin 指示器 */}
        {tab.isPinned && (
          <Pin className="w-3 h-3 text-theme-accent flex-shrink-0 rotate-45" />
        )}
      
        {/* 文件图标 */}
        <span className="flex-shrink-0">
          <FileIcon filename={tab.name} size={14} />
        </span>
      
        {/* 文件名 */}
        <span className={cn(
          'text-xs truncate max-w-[120px]',
          isActive ? 'text-theme-text' : 'text-theme-text-muted',
          tab.isDirty && 'italic'
        )}>
          {tab.name}
        </span>
      
        {/* 状态指示器 / 关闭按钮 */}
        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 ml-1">
          {tab.isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-theme-text-muted" />
          ) : tab.isDirty ? (
            // 未保存指示器（hover 时显示关闭按钮）
            <>
              <Circle 
                className={cn(
                  'w-2 h-2 fill-theme-accent text-theme-accent',
                  'group-hover:hidden'
                )} 
              />
              <button
                className="hidden group-hover:flex items-center justify-center w-4 h-4 rounded hover:bg-theme-bg-hover/50"
                onClick={handleClose}
              >
                <X className="w-3 h-3 text-theme-text-muted" />
              </button>
            </>
          ) : (
            // 关闭按钮
            <button
              className={cn(
                'flex items-center justify-center w-4 h-4 rounded',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                'hover:bg-theme-bg-hover/50'
              )}
              onClick={handleClose}
            >
              <X className="w-3 h-3 text-theme-text-muted" />
            </button>
          )}
        </div>
      </div>
      
      {/* 右键菜单 */}
      {contextMenuPos && (
        <>
          <div className="fixed inset-0 z-50" onClick={closeContextMenu} />
          <div
            className="fixed z-50 bg-theme-bg-elevated border border-theme-border rounded-md shadow-xl py-1 min-w-[140px]"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          >
            <button
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-theme-bg-hover flex items-center gap-2"
              onClick={() => { onTogglePin(); closeContextMenu(); }}
            >
              <Pin className="w-3 h-3" />
              {tab.isPinned ? t('ide.unpin_tab', 'Unpin') : t('ide.pin_tab', 'Pin')}
            </button>
            <button
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-theme-bg-hover flex items-center gap-2"
              onClick={() => { onClose(); closeContextMenu(); }}
            >
              <X className="w-3 h-3" />
              {t('tabbar.close_tab', 'Close')}
            </button>
          </div>
        </>
      )}
    </>
  );
}

export function IdeEditorTabs() {
  const tabs = useIdeTabs();
  const { activeTabId, setActiveTab, closeTab, saveFile, togglePinTab, reorderTabs } = useIdeStore();
  
  // 保存确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    tabId: string;
    fileName: string;
    saveError?: string;
  }>({ open: false, tabId: '', fileName: '' });
  
  // 滚动容器 ref
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // dnd-kit sensors — distance constraint prevents clicks from triggering drag
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  
  // Stable sorted ID list for SortableContext
  const tabIds = useMemo(() => tabs.map(t => t.id), [tabs]);
  
  // Handle drag end — reorder tabs
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tabs.findIndex(t => t.id === active.id);
    const newIndex = tabs.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(tabs.map(t => t.id), oldIndex, newIndex);
    reorderTabs(reordered);
  }, [tabs, reorderTabs]);
  
  // 处理标签关闭
  const handleCloseTab = useCallback(async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    const closed = await closeTab(tabId);
    if (!closed) {
      // 需要确认
      setConfirmDialog({
        open: true,
        tabId,
        fileName: tab.name,
      });
    }
  }, [tabs, closeTab]);
  
  // 保存确认对话框的操作
  const handleSaveAndClose = useCallback(async () => {
    const { tabId } = confirmDialog;
    try {
      await saveFile(tabId);
      await closeTab(tabId);
      setConfirmDialog({ open: false, tabId: '', fileName: '' });
    } catch (e) {
      console.error('[IdeEditorTabs] Save failed:', e);
      // Keep dialog open and show error instead of silently closing
      setConfirmDialog(prev => ({
        ...prev,
        saveError: e instanceof Error ? e.message : String(e),
      }));
    }
  }, [confirmDialog, saveFile, closeTab]);
  
  const handleDiscardAndClose = useCallback(async () => {
    const { tabId } = confirmDialog;
    // 强制关闭（不保存）
    useIdeStore.setState(state => ({
      tabs: state.tabs.filter(t => t.id !== tabId),
      activeTabId: state.activeTabId === tabId 
        ? (state.tabs.length > 1 ? state.tabs.find(t => t.id !== tabId)?.id || null : null)
        : state.activeTabId,
    }));
    setConfirmDialog({ open: false, tabId: '', fileName: '' });
  }, [confirmDialog]);
  
  const handleCancelClose = useCallback(() => {
    setConfirmDialog({ open: false, tabId: '', fileName: '' });
  }, []);
  
  // 横向滚动
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);
  
  if (tabs.length === 0) {
    return null;
  }
  
  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
          <div
            ref={scrollRef}
            className="flex items-stretch border-b border-theme-border/50 bg-theme-bg/60 overflow-x-auto scrollbar-none"
            onWheel={handleWheel}
          >
            {tabs.map(tab => (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onActivate={() => setActiveTab(tab.id)}
                onClose={() => handleCloseTab(tab.id)}
                onTogglePin={() => togglePinTab(tab.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      
      {/* 保存确认对话框 */}
      <IdeSaveConfirmDialog
        open={confirmDialog.open}
        fileName={confirmDialog.fileName}
        onSave={handleSaveAndClose}
        onDiscard={handleDiscardAndClose}
        onCancel={handleCancelClose}
      />
    </>
  );
}
