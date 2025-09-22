import React from 'react';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

interface SubComponentProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> & {
  Header: React.FC<SubComponentProps>;
  Main: React.FC<SubComponentProps>;
  Sidebar: React.FC<SubComponentProps>;
  Content: React.FC<SubComponentProps>;
  Footer: React.FC<SubComponentProps>;
} = ({ children }) => {
  return <div className="layout">{children}</div>;
};

Layout.Header = ({ children }) => (
  <header className="layout-header">{children}</header>
);

Layout.Main = ({ children }) => (
  <main className="layout-main">{children}</main>
);

Layout.Sidebar = ({ children }) => (
  <aside className="layout-sidebar">{children}</aside>
);

Layout.Content = ({ children }) => (
  <section className="layout-content">{children}</section>
);

Layout.Footer = ({ children }) => (
  <footer className="layout-footer">{children}</footer>
);

export default Layout;