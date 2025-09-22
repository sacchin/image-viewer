import { Menu, MenuItemConstructorOptions, BrowserWindow, dialog, app } from 'electron';

export function createMainMenu(window: BrowserWindow): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Download',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            window.webContents.send('menu-action', 'new-download');
          }
        },
        {
          label: 'Import Folder',
          click: () => {
            window.webContents.send('menu-action', 'import-folder');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Grid View',
          type: 'radio',
          checked: true,
          click: () => {
            window.webContents.send('menu-action', 'view-grid');
          }
        },
        {
          label: 'List View',
          type: 'radio',
          click: () => {
            window.webContents.send('menu-action', 'view-list');
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            window.setFullScreen(!window.isFullScreen());
          }
        }
      ]
    },
    {
      label: 'Library',
      submenu: [
        {
          label: 'Manage Tags',
          click: () => {
            window.webContents.send('menu-action', 'manage-tags');
          }
        },
        {
          label: 'Search',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            window.webContents.send('menu-action', 'search');
          }
        },
        { type: 'separator' },
        {
          label: 'Refresh Library',
          accelerator: 'F5',
          click: () => {
            window.webContents.send('menu-action', 'refresh-library');
          }
        }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}