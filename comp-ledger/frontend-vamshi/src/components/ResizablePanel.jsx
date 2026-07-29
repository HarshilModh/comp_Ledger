import React, { useState, useRef, useCallback } from 'react';

export default function ResizablePanel({ left, right, minLeft = 280, minRight = 300, defaultLeftPercent = 38 }) {
  const containerRef = useRef(null);
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setDragging(true);

    const onMouseMove = (moveEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const totalWidth = rect.width;
      let pct = (x / totalWidth) * 100;

      const minLeftPct = (minLeft / totalWidth) * 100;
      const minRightPct = 100 - (minRight / totalWidth) * 100;
      pct = Math.max(minLeftPct, Math.min(minRightPct, pct));

      setLeftPercent(pct);
    };

    const onMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [minLeft, minRight]);

  return (
    <div ref={containerRef} className="flex w-full" style={{ minHeight: 0 }}>
      <div className="overflow-hidden flex flex-col" style={{ width: `${leftPercent}%`, minWidth: minLeft }}>
        {left}
      </div>

      <div
        onMouseDown={handleMouseDown}
        className="resizer-handle group"
        style={{ cursor: 'col-resize' }}
      >
        <div className={`resizer-bar ${dragging ? 'resizer-bar-active' : ''}`} />
      </div>

      <div className="overflow-hidden flex-1 flex flex-col min-w-0" style={{ minWidth: minRight }}>
        {right}
      </div>
    </div>
  );
}
