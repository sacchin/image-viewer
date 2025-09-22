import { Page } from 'playwright';

export class MainPage {
  constructor(private page: Page) {}

  get toolbar() {
    return {
      container: () => this.page.locator('[data-testid="toolbar"]'),
      folderOpenButton: () => this.page.locator('[data-testid="folder-open-btn"]'),
      viewModeButton: () => this.page.locator('[data-testid="view-mode-btn"]'),
      sortButton: () => this.page.locator('[data-testid="sort-btn"]'),
      filterButton: () => this.page.locator('[data-testid="filter-btn"]'),
      searchInput: () => this.page.locator('[data-testid="search-input"]')
    };
  }

  get sidebar() {
    return {
      container: () => this.page.locator('[data-testid="sidebar"]'),
      folderTree: () => this.page.locator('[data-testid="folder-tree"]'),
      folderItem: (name: string) => this.page.locator(`[data-testid="folder-item-${name}"]`),
      toggleButton: () => this.page.locator('[data-testid="sidebar-toggle"]')
    };
  }

  get imageGrid() {
    return {
      container: () => this.page.locator('[data-testid="image-grid"]'),
      images: () => this.page.locator('[data-testid^="image-item-"]'),
      imageItem: (index: number) => this.page.locator(`[data-testid="image-item-${index}"]`),
      selectedImage: () => this.page.locator('[data-testid^="image-item-"].selected'),
      emptyState: () => this.page.locator('[data-testid="empty-state"]')
    };
  }

  get statusBar() {
    return {
      container: () => this.page.locator('[data-testid="status-bar"]'),
      itemCount: () => this.page.locator('[data-testid="item-count"]'),
      selectedCount: () => this.page.locator('[data-testid="selected-count"]'),
      zoomLevel: () => this.page.locator('[data-testid="zoom-level"]')
    };
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.toolbar.container().waitFor({ state: 'visible', timeout: 10000 });
  }

  async isToolbarVisible(): Promise<boolean> {
    return await this.toolbar.container().isVisible();
  }

  async isSidebarVisible(): Promise<boolean> {
    return await this.sidebar.container().isVisible();
  }

  async isImageGridVisible(): Promise<boolean> {
    return await this.imageGrid.container().isVisible();
  }

  async isStatusBarVisible(): Promise<boolean> {
    return await this.statusBar.container().isVisible();
  }

  async getImageCount(): Promise<number> {
    const images = await this.imageGrid.images().all();
    return images.length;
  }

  async getSelectedImageCount(): Promise<number> {
    const selected = await this.imageGrid.selectedImage().all();
    return selected.length;
  }

  async selectImage(index: number): Promise<void> {
    await this.imageGrid.imageItem(index).click();
  }

  async searchImages(query: string): Promise<void> {
    const searchInput = this.toolbar.searchInput();
    await searchInput.fill(query);
    await searchInput.press('Enter');
  }

  async openFolder(): Promise<void> {
    await this.toolbar.folderOpenButton().click();
  }

  async toggleSidebar(): Promise<void> {
    await this.sidebar.toggleButton().click();
  }

  async getStatusText(): Promise<{ itemCount: string; selectedCount: string; zoomLevel: string }> {
    const itemCount = await this.statusBar.itemCount().textContent() || '';
    const selectedCount = await this.statusBar.selectedCount().textContent() || '';
    const zoomLevel = await this.statusBar.zoomLevel().textContent() || '';

    return { itemCount, selectedCount, zoomLevel };
  }
}