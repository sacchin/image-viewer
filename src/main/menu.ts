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
          label: 'Open Folder',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            window.webContents.send('menu-action', 'open-folder');
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
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { type: 'separator' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
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
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            window.webContents.send('menu-action', 'zoom-in');
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            window.webContents.send('menu-action', 'zoom-out');
          }
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            window.webContents.send('menu-action', 'zoom-reset');
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            window.setFullScreen(!window.isFullScreen());
          }
        },
        ...(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' ? [
          { type: 'separator' as const },
          {
            label: 'Toggle Developer Tools',
            accelerator: 'CmdOrCtrl+Shift+I',
            click: () => {
              window.webContents.toggleDevTools();
            }
          }
        ] : [])
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
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Image Viewer',
          click: () => {
            dialog.showMessageBox(window, {
              type: 'info',
              title: 'About Image Viewer',
              message: 'Image Viewer',
              detail: 'A simple and powerful image viewer application.\nVersion: 1.0.0',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}