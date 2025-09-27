import React, { useState, useEffect, useRef } from 'react';
import './ImagePreview.css';

interface ImagePreviewProps {
  imagePath: string | null;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ imagePath }) => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [fitMode, setFitMode] = useState<'fit' | 'actual'>('fit');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (imagePath) {
      loadImage(imagePath);
    } else {
      setImageData(null);
      setError(null);
    }
  }, [imagePath]);

  useEffect(() => {
    if (fitMode === 'fit' && imageRef.current && containerRef.current) {
      fitImageToContainer();
    }
  }, [imageData, fitMode]);

  const loadImage = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log('Loading image from path:', path);
      const result = await window.electronAPI.readImageFile(path);
      console.log('Image data received:', result ? 'Yes' : 'No');
      if (result && result.data) {
        console.log('Image data length:', result.data.length);
        console.log('Image type:', result.type);
        setImageData(result.data);
        setScale(1);
      } else {
        setError('Failed to load image - no data received');
        console.error('No image data received for path:', path);
      }
    } catch (err) {
      setError(`Error loading image: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Failed to load image:', err);
    } finally {
      setLoading(false);
    }
  };

  const fitImageToContainer = () => {
    if (!imageRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const image = imageRef.current;

    const containerWidth = container.clientWidth - 40; // padding
    const containerHeight = container.clientHeight - 80; // padding + toolbar

    const imageWidth = image.naturalWidth;
    const imageHeight = image.naturalHeight;

    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;

    const newScale = Math.min(scaleX, scaleY, 1);
    setScale(newScale);
  };

  const handleZoomIn = () => {
    setFitMode('actual');
    setScale(prevScale => Math.min(prevScale * 1.2, 5));
    // Keep position when zooming
  };

  const handleZoomOut = () => {
    setFitMode('actual');
    setScale(prevScale => {
      const newScale = Math.max(prevScale * 0.8, 0.1);
      // Reset position if zooming out to scale 1 or less
      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  };

  const handleFit = () => {
    setFitMode('fit');
    fitImageToContainer();
    setPosition({ x: 0, y: 0 }); // Reset position when fitting
  };

  const handleActualSize = () => {
    setFitMode('actual');
    setScale(1);
    setPosition({ x: 0, y: 0 }); // Reset position
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setPosition({ x: newX, y: newY });
      e.preventDefault();
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    e.preventDefault();
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    setIsDragging(false);
  };

  if (!imagePath) {
    return (
      <div className="image-preview-container">
        <div className="image-preview-empty">
          Select an image to preview
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="image-preview-container">
        <div className="image-preview-loading">
          Loading image...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="image-preview-container">
        <div className="image-preview-error">
          {error}
        </div>
      </div>
    );
  }

  if (!imageData) {
    return null;
  }

  return (
    <div className="image-preview-container" ref={containerRef}>
      <div className="image-preview-toolbar">
        <button
          className="toolbar-button"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          ➖
        </button>
        <button
          className="toolbar-button"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          ➕
        </button>
        <button
          className="toolbar-button"
          onClick={handleFit}
          title="Fit to Window"
        >
          ⬜
        </button>
        <button
          className="toolbar-button"
          onClick={handleActualSize}
          title="Actual Size"
        >
          1:1
        </button>
        <span className="zoom-level">{Math.round(scale * 100)}%</span>
      </div>

      <div
        className="image-preview-viewport"
        ref={viewportRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
        }}
      >
        <div className="image-preview-content">
          <img
            ref={imageRef}
            src={imageData}
            alt="Preview"
            className="preview-image"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              userSelect: 'none',
              pointerEvents: scale > 1 ? 'auto' : 'none'
            }}
            onLoad={() => {
              if (fitMode === 'fit') {
                fitImageToContainer();
              }
            }}
          />
        </div>
      </div>

      <div className="image-preview-info">
        <span className="image-path">{imagePath.split(/[/\\]/).pop()}</span>
      </div>
    </div>
  );
};

export default ImagePreview;