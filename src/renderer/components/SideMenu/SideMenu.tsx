import React from 'react';
import './SideMenu.css';

export type PanelType = 'download' | 'explore' | 'log' | 'setting';

interface SideMenuProps {
  activeItem: PanelType;
  onItemClick: (item: PanelType) => void;
}

interface MenuItem {
  id: PanelType;
  label: string;
  icon: string;
}

export const SideMenu: React.FC<SideMenuProps> = ({ activeItem, onItemClick }) => {
  const menuItems: MenuItem[] = [
    { id: 'download', label: 'Download', icon: '⬇' },
    { id: 'explore', label: 'Explore', icon: '🔍' },
    { id: 'log', label: 'Log', icon: '📋' },
    { id: 'setting', label: 'Setting', icon: '⚙' },
  ];

  return (
    <div className="side-menu" role="navigation">
      <nav className="side-menu-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`side-menu-item ${activeItem === item.id ? 'active' : ''}`}
            onClick={() => onItemClick(item.id)}
            aria-current={activeItem === item.id ? 'page' : undefined}
            data-menu-item={item.id}
            role="button"
            tabIndex={0}
          >
            <span className="side-menu-icon menu-icon">{item.icon}</span>
            <span className="side-menu-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};