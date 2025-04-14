import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface RetrievalAnimationProps {
  startAnimation: boolean;
  onAnimationComplete: () => void;
  // TODO: Add props for actual item/container dimensions and item start position
  // For now, using fixed sizes and positions for demonstration.
}

const RetrievalAnimation: React.FC<RetrievalAnimationProps> = ({ startAnimation, onAnimationComplete }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current; // Capture mount point

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background
    currentMount.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // --- Container ---
    const containerWidth = 2;
    const containerHeight = 1.5;
    const containerDepth = 2;
    const containerGeometry = new THREE.BoxGeometry(containerWidth, containerHeight, containerDepth);
    
    // Wireframe using EdgesGeometry
    const edges = new THREE.EdgesGeometry(containerGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 }); // Green wireframe
    const containerWireframe = new THREE.LineSegments(edges, lineMaterial);

    // Position the container mesh so its logical origin (bottom-left of open face at +Z) is at (0,0,0)
    containerWireframe.position.set(containerWidth / 2, containerHeight / 2, -containerDepth / 2);
    scene.add(containerWireframe);

    // --- Item ---
    // TODO: Use actual item dimensions prop
    const itemSize = 0.4;
    const itemGeometry = new THREE.BoxGeometry(itemSize, itemSize, itemSize);
    const itemMaterial = new THREE.MeshStandardMaterial({ color: 0x00ccff, roughness: 0.5 }); // Cyan item
    const item = new THREE.Mesh(itemGeometry, itemMaterial);
    
    // Initial position relative to container origin (inside, near the back)
    // TODO: Use actual item position prop
    const initialItemX = containerWidth * 0.3;
    const initialItemY = containerHeight * 0.3;
    const initialItemZ = -containerDepth * 0.6; // Start inside, towards the back
    const retrievalDistance = containerDepth * 0.6 + 1; // Distance to move out along +Z

    item.position.set(initialItemX, initialItemY, initialItemZ);
    scene.add(item);

    // --- Camera ---
    camera.position.set(containerWidth * 0.8, containerHeight * 1.5, 2.5); // Positioned to view the open face
    camera.lookAt(containerWidth / 2, containerHeight / 2, -containerDepth / 2); // Look at the container center

    // --- Animation Logic ---
    let startTime: number | null = null;
    const animationDuration = 1500; // ms

    const animate = (time: number) => {
      animationFrameId.current = requestAnimationFrame(animate); // Request next frame early

      if (!isAnimating && !startAnimation && item.position.z !== initialItemZ) {
        // Reset position instantly if needed when animation is not active
        item.position.z = initialItemZ;
        startTime = null;
      } else if (startAnimation && !isAnimating) {
        // Start the animation
        setIsAnimating(true);
        startTime = time;
      } else if (startAnimation && isAnimating) {
        if (!startTime) startTime = time; // Ensure startTime is set
        const elapsedTime = time - startTime;
        const progress = Math.min(elapsedTime / animationDuration, 1);

        // Animate item moving out along the +Z axis (perpendicular to open face)
        item.position.z = initialItemZ + progress * retrievalDistance;

        if (progress >= 1) {
          setIsAnimating(false);
          startTime = null;
          onAnimationComplete();
        }
      }
        
      // Optional: Subtle rotation for visual interest (can be removed)
       containerWireframe.rotation.y += 0.001;

      renderer.render(scene, camera);
    };

    // --- Resize Handling ---
    const handleResize = () => {
       if (currentMount) {
        const width = currentMount.clientWidth;
        const height = currentMount.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };
    window.addEventListener('resize', handleResize);

    // --- Start Animation ---
    animate(performance.now()); // Start the loop immediately

    // --- Cleanup ---
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      
      // Dispose Three.js objects
      scene.remove(item);
      scene.remove(containerWireframe);
      itemGeometry.dispose();
      itemMaterial.dispose();
      containerGeometry.dispose(); // Base geometry for edges
      edges.dispose();
      lineMaterial.dispose();
      ambientLight.dispose();
      directionalLight.dispose();
      
      renderer.dispose();
       if (currentMount && renderer.domElement.parentNode === currentMount) {
         currentMount.removeChild(renderer.domElement);
       }
    };
    // Dependencies: Rerun effect if animation needs to be triggered or props change
  }, [startAnimation, onAnimationComplete]); 

  // Removed isAnimating from deps: internal state shouldn't trigger full useEffect rerun

  return <div ref={mountRef} className="w-full h-48 md:h-64" />;
};

export default RetrievalAnimation; 