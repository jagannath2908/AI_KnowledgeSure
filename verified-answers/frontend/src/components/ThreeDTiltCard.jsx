import React, { useRef, useState } from 'react';

/**
 * ThreeDTiltCard wraps any element with realistic 3D perspective tilt
 * and interactive dynamic light glare without changing internal layout or content.
 */
export default function ThreeDTiltCard({ children, className = '', style = {}, maxTilt = 8, scale = 1.015, ...props }) {
  const cardRef = useRef(null);
  const [transformStyle, setTransformStyle] = useState('');
  const [glareStyle, setGlareStyle] = useState({ opacity: 0 });

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left; // x position within element
    const y = e.clientY - rect.top;  // y position within element
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -maxTilt;
    const rotateY = ((x - centerX) / centerX) * maxTilt;

    setTransformStyle(
      `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`
    );

    // Glare effect position
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    setGlareStyle({
      opacity: 0.15,
      background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.6) 0%, rgba(99, 102, 241, 0.2) 40%, transparent 80%)`,
    });
  };

  const handleMouseLeave = () => {
    setTransformStyle('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    setGlareStyle({ opacity: 0 });
  };

  return (
    <div
      ref={cardRef}
      className={`tilt-card-wrapper ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.16s ease-out, box-shadow 0.2s ease-out',
        transform: transformStyle,
        ...style
      }}
      {...props}
    >
      {children}
      <div
        className="tilt-glare-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 'inherit',
          pointerEvents: 'none',
          transition: 'opacity 0.25s ease-out',
          zIndex: 3,
          ...glareStyle
        }}
        aria-hidden="true"
      />
    </div>
  );
}
