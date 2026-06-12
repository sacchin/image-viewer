import React, { useState, useEffect, useRef } from 'react';
import './FolderTree.css';

interface FolderNode {
  name: string;
  path: string;
  type: string;
  // null until the node's subfolders have been fetched (loaded === false)
  children?: FolderNode[] | null;
  loaded?: boolean;
}

interface FolderTreeProps {
  rootPath?: string;
  onFolderSelect?: (folder: string) => void;
  works?: any[];
  selectedWork?: string | null;
  onSelect?: (workId: string) => void;
}

const FolderTreeNode: React.FC<{
  node: FolderNode;
  level: number;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}> = ({ node, level, selectedPath, expandedPaths, onToggle, onSelect }) => {
  const isExpanded = expandedPaths.has(node.path);
  // Until a node is loaded we don't know whether it has subfolders,
  // so keep the expand arrow visible and resolve it on first expand
  const hasChildren = node.loaded ? !!node.children && node.children.length > 0 : true;
  const isSelected = selectedPath === node.path;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggle(node.path);
    }
  };

  const handleSelect = () => {
    onSelect(node.path);
    if (!isExpanded && hasChildren) {
      onToggle(node.path);
    }
  };

  return (
    <div className="folder-node">
      <div
        className={`folder-node-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleSelect}
      >
        <span
          className={`folder-arrow ${isExpanded ? 'expanded' : ''} ${!hasChildren ? 'hidden' : ''}`}
          onClick={handleToggle}
        >
          ▶
        </span>
        <span className="folder-icon">📁</span>
        <span className="folder-name">{node.name}</span>
      </div>
      {isExpanded && !node.loaded && (
        <div
          className="folder-children-loading"
          style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
        >
          Loading...
        </div>
      )}
      {isExpanded && node.loaded && hasChildren && (
        <div className="folder-children">
          {node.children!.map((child) => (
            <FolderTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FolderTree: React.FC<FolderTreeProps> = ({
  rootPath,
  onFolderSelect,
  works = [],
  selectedWork,
  onSelect
}) => {
  const [treeData, setTreeData] = useState<FolderNode | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingPathsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (rootPath) {
      loadFolderTree(rootPath);
    }
  }, [rootPath]);

  const loadFolderTree = async (path: string) => {
    setLoading(true);
    try {
      const tree = await window.electronAPI.readFolderTree(path);
      if (tree) {
        setTreeData(tree);
        // Auto-expand root
        setExpandedPaths(new Set([tree.path]));
      }
    } catch (error) {
      console.error('Failed to load folder tree:', error);
    } finally {
      setLoading(false);
    }
  };

  const findNode = (node: FolderNode | null, path: string): FolderNode | null => {
    if (!node) return null;
    if (node.path === path) return node;
    for (const child of node.children ?? []) {
      const found = findNode(child, path);
      if (found) return found;
    }
    return null;
  };

  const updateNode = (
    node: FolderNode,
    path: string,
    updater: (node: FolderNode) => FolderNode
  ): FolderNode => {
    if (node.path === path) {
      return updater(node);
    }
    if (!node.children || node.children.length === 0) {
      return node;
    }
    let changed = false;
    const children = node.children.map((child) => {
      const next = updateNode(child, path, updater);
      if (next !== child) changed = true;
      return next;
    });
    return changed ? { ...node, children } : node;
  };

  const loadChildren = async (path: string) => {
    if (loadingPathsRef.current.has(path)) {
      return;
    }
    loadingPathsRef.current.add(path);
    try {
      const children = await window.electronAPI.readSubfolders(path);
      setTreeData((tree) =>
        tree ? updateNode(tree, path, (node) => ({ ...node, children, loaded: true })) : tree
      );
    } catch (error) {
      console.error('Failed to load subfolders:', error);
      // Mark as loaded with no children so the UI doesn't spin forever
      setTreeData((tree) =>
        tree ? updateNode(tree, path, (node) => ({ ...node, children: [], loaded: true })) : tree
      );
    } finally {
      loadingPathsRef.current.delete(path);
    }
  };

  const handleToggle = (path: string) => {
    const isExpanding = !expandedPaths.has(path);
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });

    if (isExpanding) {
      const node = findNode(treeData, path);
      if (node && !node.loaded) {
        loadChildren(path);
      }
    }
  };

  const handleSelect = (path: string) => {
    setSelectedPath(path);
    if (onFolderSelect) {
      onFolderSelect(path);
    }
  };

  // Legacy mode for works
  if (!rootPath) {
    const handleItemClick = (workId: string, workName: string) => {
      if (onFolderSelect) {
        onFolderSelect(workName);
      }
      if (onSelect) {
        onSelect(workId);
      }
    };

    return (
      <div className="folder-tree" data-testid="sidebar">
        <div className="folder-tree-header">
          <h3>Library</h3>
        </div>
        <div className="folder-tree-content" data-testid="folder-tree">
          {works.length === 0 ? (
            <div className="folder-tree-empty">
              <p>No works in library</p>
              <p className="folder-tree-hint">Use File → Import Folder to add content</p>
            </div>
          ) : (
            <ul className="folder-tree-list">
              {works.map((work: any) => (
                <li
                  key={work.id}
                  className={`folder-tree-item ${selectedWork === work.id ? 'selected' : ''}`}
                  onClick={() => handleItemClick(work.id, work.name)}
                >
                  {work.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="folder-tree" data-testid="sidebar">
      <div className="folder-tree-header">
        <h3>Folders</h3>
      </div>
      <div className="folder-tree-content" data-testid="folder-tree">
        {loading ? (
          <div className="folder-tree-loading">Loading...</div>
        ) : !treeData ? (
          <div className="folder-tree-empty">
            <p>No folder selected</p>
          </div>
        ) : (
          <FolderTreeNode
            node={treeData}
            level={0}
            selectedPath={selectedPath}
            expandedPaths={expandedPaths}
            onToggle={handleToggle}
            onSelect={handleSelect}
          />
        )}
      </div>
    </div>
  );
};

export default FolderTree;