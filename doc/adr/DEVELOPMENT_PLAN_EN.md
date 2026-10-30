# Image Viewer Application Development Plan

## Project Overview
An image management application for Windows desktop focused on doujinshi content. Provides functionality to crawl images from specific websites and manage/view them locally.

## Technology Stack
- **Frontend**: Electron + React (TypeScript)
- **Crawling**: Node.js (Puppeteer or Playwright)
- **Data Management**: File system + JSON metadata (no database)
- **Testing**: Playwright (E2E)

## Expected Scale
- Number of works: Hundreds
- Images per work: Up to ~100
- Total images: Tens of thousands

## Data Structure
```
/library/
  /[WorkID]_[WorkName]/
    /images/
      001.jpg
      002.jpg
      ...
    metadata.json
```

### metadata.json Structure
```json
{
  "id": "unique-id",
  "title": "Work Title",
  "url": "Source URL",
  "tags": ["tag1", "tag2"],
  "createdAt": "2024-01-01T00:00:00Z",
  "imageCount": 100
}
```

## Project Structure
```
image-viewer/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts
│   │   └── crawler/    # Crawling logic
│   ├── renderer/       # Renderer process (React)
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── FolderTree.tsx
│   │   │   ├── ImageGrid.tsx
│   │   │   └── TagManager.tsx
│   │   └── hooks/      # Custom hooks
│   └── shared/         # Shared type definitions
├── library/            # Image data storage
├── tests/
│   └── e2e/           # Playwright tests
└── package.json
```

## UI/UX Design
- **Main Screen**: Folder tree + Image list (Explorer-style)
- **Layout**:
  ```
  [Menu Bar]
  [Toolbar: New Download | Tag Management | Search | View Toggle]
  [==========================================]
  [Folder Tree]    | [Image List/Grid View]
  [  Works List  ] | [Thumbnail Display    ]
  [  - Work A    ] | [Detail Panel         ]
  [  - Work B    ] | [  Tags: []           ]
  [==========================================]
  [Status Bar: Selected Work Information]
  ```

## Feature List (By Priority)

### Priority: High (Core Features)
1. **Crawling Functionality**
   - Batch image retrieval via URL input
   - Image collection by following in-page links
   - Progress display and cancel functionality

2. **Basic Image Management**
   - Work management via folder tree
   - Image list display (Explorer-style)
   - Fast image display (thumbnail cache)

3. **Tagging Feature**
   - Manual tagging per work
   - Search and filtering by tags

### Priority: Medium
- Duplicate image checking
- Retry functionality for errors
- Lazy loading of images
- Bulk tag editing

### Priority: Low
- Security features (password lock, etc.)
- Export functionality (ZIP/PDF)
- Reading history
- Favorites feature

## Development Phases

### Phase 1: Basic Setup (MVP)
1. Initial setup of Electron + React + TypeScript
2. Create basic window and menus
3. Build project structure
4. Simple crawling functionality
5. Image saving and list display
6. Folder tree implementation

### Phase 2: Tagging and Search
1. Implement tagging UI
2. Metadata management system
3. Search and filtering by tags
4. Thumbnail generation and fast display

### Phase 3: Testing and Optimization
1. Implement E2E tests with Playwright
2. Performance optimization
3. UI/UX improvements
4. Strengthen error handling

## Crawling Specifications
- **Target**: Specific websites
- **Method**: Input URL and retrieve images from linked pages within that page
- **Considerations**:
  - Compliance with Terms of Service and robots.txt
  - Rate limiting (access frequency control)
  - Copyright considerations

## Performance Optimization
- Thumbnail cache generation
- Lazy loading (only load images in viewport)
- Preloading (prefetch next images)

## Future Expansion Possibilities
- Cross-platform support (Mac/Linux)
- Cloud storage integration
- Automatic tagging with AI
- Image editing features