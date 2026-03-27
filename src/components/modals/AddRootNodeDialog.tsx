/**
 * Add Root Node Dialog
 * 
 * 添加根节点到 Session Tree
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Loader2, Plus, Server } from 'lucide-react';
import { api } from '../../lib/api';

interface AddRootNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (nodeId: string) => void;
}

export const AddRootNodeDialog: React.FC<AddRootNodeDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { t } = useTranslation();
  // 表单状态
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authType, setAuthType] = useState<'password' | 'key' | 'agent'>('agent');
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  
  // 加载状态
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuthTypeChange = (value: string) => {
    if (value === 'password' || value === 'key' || value === 'agent') {
      setAuthType(value);
    }
  };

  const resetForm = () => {
    setHost('');
    setPort('22');
    setUsername('');
    setDisplayName('');
    setAuthType('agent');
    setPassword('');
    setKeyPath('');
    setPassphrase('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleBrowseKey = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        directory: false,
        title: t('modals.root_node.key_path'),
        defaultPath: '~/.ssh',
      });
      if (selected) {
        setKeyPath(selected);
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
    }
  };

  const handleAdd = async () => {
    if (!host || !username) return;

    setIsAdding(true);
    setError(null);

    try {
      // 添加根节点到树
      const nodeId = await api.addRootNode({
        host,
        port: parseInt(port) || 22,
        username,
        authType,
        password: authType === 'password' ? password : undefined,
        keyPath: authType === 'key' ? keyPath : undefined,
        passphrase: authType === 'key' && passphrase ? passphrase : undefined,
        displayName: displayName || undefined,
      });

      onSuccess?.(nodeId);
      handleClose();
    } catch (err) {
      console.error('Failed to add root node:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-green-400" />
            {t('modals.root_node.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Target server information */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label htmlFor="host">{t('modals.root_node.host')}</Label>
              <Input
                id="host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder={t('modals.root_node.host_placeholder')}
              />
            </div>
            <div>
              <Label htmlFor="port">{t('modals.root_node.port')}</Label>
              <Input
                id="port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="22"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="username">{t('modals.root_node.username')}</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('modals.root_node.username_placeholder')}
              />
            </div>
            <div>
              <Label htmlFor="displayName">{t('modals.root_node.display_name')}</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('modals.root_node.display_name_placeholder')}
              />
            </div>
          </div>

          {/* Authentication method */}
          <div>
            <Label>{t('modals.root_node.auth_method')}</Label>
            <Tabs value={authType} onValueChange={handleAuthTypeChange} className="mt-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="agent">{t('modals.root_node.auth_agent')}</TabsTrigger>
                <TabsTrigger value="key">{t('modals.root_node.auth_key')}</TabsTrigger>
                <TabsTrigger value="password">{t('modals.root_node.auth_password')}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="agent" className="mt-3">
                <p className="text-sm text-theme-text-muted">
                  {t('modals.root_node.agent_desc')}
                </p>
              </TabsContent>
              
              <TabsContent value="key" className="mt-3 space-y-3">
                <div>
                  <Label htmlFor="keyPath">{t('modals.root_node.key_path')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="keyPath"
                      value={keyPath}
                      onChange={(e) => setKeyPath(e.target.value)}
                      placeholder={t('modals.root_node.key_path_placeholder')}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" onClick={handleBrowseKey}>
                      {t('modals.root_node.browse')}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="passphrase">{t('modals.root_node.passphrase')}</Label>
                  <Input
                    id="passphrase"
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder={t('modals.root_node.passphrase_placeholder')}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="password" className="mt-3">
                <div>
                  <Label htmlFor="password">{t('modals.root_node.password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('modals.root_node.password_placeholder')}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('modals.root_node.cancel')}
          </Button>
          <Button 
            onClick={handleAdd} 
            disabled={isAdding || !host || !username}
          >
            {isAdding ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('modals.root_node.adding')}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                {t('modals.root_node.add_node')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddRootNodeDialog;
