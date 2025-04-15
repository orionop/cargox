import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface RetrievalAnimationProps {
  startAnimation: boolean;
  onAnimationComplete?: () => void;
  disturbed_items?: string[]; // IDs of items that need to be moved
  steps?: number; // Number of steps needed
  // We'll still use fixed dimensions for simplicity
}

const RetrievalAnimation: React.FC<RetrievalAnimationProps> = ({ 
  startAnimation, 
  onAnimationComplete,
  disturbed_items = [],
  steps = 3 // Default to 3 steps if not specified
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>();
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationStep, setAnimationStep] = useState(0);
  const [animationDescription, setAnimationDescription] = useState('Initializing...');
  const sceneRef = useRef<any>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [animationError, setAnimationError] = useState(false);

  // Add the animateStep function for smooth step animations
  const animateStep = async (updateFn: () => void, frames: number): Promise<void> => {
    return new Promise((resolve) => {
      let frame = 0;
      
      const runFrame = () => {
        if (frame < frames) {
          updateFn();
          frame++;
          requestAnimationFrame(runFrame);
        } else {
          resolve();
        }
      };
      
      requestAnimationFrame(runFrame);
    });
  };

  // Set up the Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Initialize the scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      65, 
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1, 7);
    camera.lookAt(0, 0, 0);

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setClearColor(0x111111);
    mountRef.current.appendChild(renderer.domElement);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Add a second light to highlight edges
    const secondaryLight = new THREE.DirectionalLight(0xffffff, 0.5);
    secondaryLight.position.set(-5, 2, -2);
    scene.add(secondaryLight);

    // Create container wireframe
    const containerGeometry = new THREE.BoxGeometry(3, 2, 2);
    const containerMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff88, 
      wireframe: true,
      transparent: true,
      opacity: 0.8,
      wireframeLinewidth: 2
    });
    const containerWireframe = new THREE.Mesh(containerGeometry, containerMaterial);
    containerWireframe.rotation.y = Math.PI * 0.15; // Slight initial rotation for better visibility
    scene.add(containerWireframe);

    // Create target item
    const targetGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const targetMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const targetItem = new THREE.Mesh(targetGeometry, targetMaterial);
    targetItem.position.set(0, 0, 0);
    scene.add(targetItem);

    // Create obstacle items
    const obstacleItems = [];
    const obstaclePositions = [];
    
    // Add obstacle items if disturbed_items array is not empty
    if (disturbed_items && disturbed_items.length > 0) {
      for (let i = 0; i < Math.min(disturbed_items.length, 5); i++) {
        const size = 0.3 + Math.random() * 0.2;
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({ 
          color: Math.random() * 0xffffff,
          transparent: true,
          opacity: 0.8
        });
        
        const obstacle = new THREE.Mesh(geometry, material);
        
        // Random position within container
        const x = (Math.random() - 0.5) * 2;
        const y = (Math.random() - 0.5) * 1;
        const z = (Math.random() - 0.5) * 1;
        
        const position = new THREE.Vector3(x, y, z);
        obstaclePositions.push(position.clone());
        obstacle.position.copy(position);
        scene.add(obstacle);
        obstacleItems.push(obstacle);
      }
    }

    // Store references for animation
    sceneRef.current = {
      scene,
      camera,
      renderer,
      containerWireframe,
      containerMaterial,
      targetItem,
      obstacleItems,
      obstaclePositions
    };

    // Simple animation loop
    const animate = () => {
      // Slowly rotate the container for better visualization when not animating
      if (containerWireframe && !startAnimation) {
        containerWireframe.rotation.y += 0.005;
      }
      
      const animationId = requestAnimationFrame(animate);
      sceneRef.current.animationId = animationId;
      renderer.render(scene, camera);
    };
    
    animate();

    // Handle window resize
    const handleResize = () => {
      if (!mountRef.current) return;
      
      const { renderer, camera } = sceneRef.current;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      if (sceneRef.current.animationId) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }
      if (sceneRef.current.renderer) {
        mountRef.current?.removeChild(sceneRef.current.renderer.domElement);
        sceneRef.current.renderer.dispose();
      }
    };
  }, [disturbed_items]);

  // Animation step manager
  useEffect(() => {
    if (!startAnimation) return;
    
    const runAnimation = async () => {
      try {
        // Step 1: Opening container
        setCurrentStep(1);
        setAnimationDescription('Opening container...');
        setAnimationProgress(10);
        
        await new Promise<void>((resolve) => {
          const { containerWireframe, containerMaterial } = sceneRef.current;
          if (!containerWireframe || !containerMaterial) {
            resolve();
            return;
          }
          
          // Animation to "open" the container by making it more transparent
          let opacity = 1.0;
          const interval = setInterval(() => {
            opacity -= 0.05;
            if (opacity <= 0.3) {
              clearInterval(interval);
              resolve();
            }
            containerMaterial.opacity = opacity;
          }, 50);
        });
        
        // Step 2: Moving obstacles
        setCurrentStep(2);
        setAnimationDescription('Moving obstacles aside...');
        setAnimationProgress(25);
        
        await new Promise<void>((resolve) => {
          const { obstacleItems } = sceneRef.current;
          
          if (!obstacleItems || obstacleItems.length === 0) {
            // No obstacles to move, just wait a moment
            setTimeout(() => resolve(), 800);
            return;
          }
          
          // Move obstacles away from the center
          let frame = 0;
          const totalFrames = 60; // Increased from 30 to slow down
          
          const moveObstacles = () => {
            if (frame >= totalFrames) {
              resolve();
              return;
            }
            
            obstacleItems.forEach((obstacle, index) => {
              // Move outward in different directions
              const direction = new THREE.Vector3(
                obstacle.position.x > 0 ? 1 : -1,
                obstacle.position.y > 0 ? 1 : -1,
                obstacle.position.z > 0 ? 1 : -1
              );
              
              // Scale the direction to move outward - reduced to slow down
              direction.multiplyScalar(0.05);
              obstacle.position.add(direction);
            });
            
            frame++;
            // Slow down the animation by adding a delay between frames
            setTimeout(() => requestAnimationFrame(moveObstacles), 20);
          };
          
          moveObstacles();
        });
        
        // Step 3: Retrieving item
        setCurrentStep(3);
        setAnimationDescription('Retrieving target item...');
        setAnimationProgress(50);
        
        await new Promise<void>((resolve) => {
          const { targetItem, camera } = sceneRef.current;
          if (!targetItem || !camera) {
            resolve();
            return;
          }
          
          // Move the target item toward the camera
          const startPosition = targetItem.position.clone();
          const endPosition = new THREE.Vector3(0, 0, 3);
          let progress = 0;
          
          const interval = setInterval(() => {
            progress += 0.02;
            if (progress >= 1) {
              clearInterval(interval);
              resolve();
            }
            
            // Interpolate position
            const currentPos = startPosition.clone().lerp(endPosition, progress);
            targetItem.position.copy(currentPos);
            
            // Also make it a bit bigger
            const scale = 1 + progress;
            targetItem.scale.set(scale, scale, scale);
          }, 50);
        });
        
        // Step 4: Return displaced items
        setCurrentStep(4);
        setAnimationDescription('Returning displaced items...');
        setAnimationProgress(75);
        
        await new Promise<void>((resolve) => {
          const { obstacleItems, obstaclePositions } = sceneRef.current;
          
          if (!obstacleItems || obstacleItems.length === 0 || !obstaclePositions || obstaclePositions.length === 0) {
            // No obstacles to return, just wait a moment
            setTimeout(() => resolve(), 800);
            return;
          }
          
          // Move obstacles back to their original positions
          let frame = 0;
          const totalFrames = 50; // Slower return animation
          
          const returnObstacles = () => {
            if (frame >= totalFrames) {
              resolve();
              return;
            }
            
            obstacleItems.forEach((obstacle, index) => {
              if (obstaclePositions[index]) {
                // Lerp back to original position
                const originalPos = obstaclePositions[index];
                const currentPos = obstacle.position.clone();
                const progress = frame / totalFrames;
                
                // Smooth interpolation back to original position
                obstacle.position.lerp(originalPos, 0.05);
              }
            });
            
            frame++;
            // Add delay for slower animation
            setTimeout(() => requestAnimationFrame(returnObstacles), 25);
          };
          
          returnObstacles();
        });
        
        // Step 5: Finishing up
        setCurrentStep(5);
        setAnimationDescription('Retrieval complete!');
        setAnimationProgress(100);
        
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            resolve();
          }, 1000);
        });
        
        // Complete animation and notify parent
        setAnimationComplete(true);
        if (onAnimationComplete) {
          onAnimationComplete();
        }
        
      } catch (error) {
        console.error("Animation error:", error);
        setAnimationError(true);
        setAnimationDescription('Error during retrieval');
      }
    };
    
    runAnimation();
  }, [startAnimation, onAnimationComplete]);

  // Reset animation when startAnimation changes from true to false
  useEffect(() => {
    if (startAnimation) {
      // Reset animation state when starting
      setCurrentStep(1);
      setAnimationProgress(0);
      setAnimationDescription('Initializing...');
      setAnimationError(false);
      setAnimationComplete(false);
    }
  }, [startAnimation]);

  // For debugging purposes, log key states
  useEffect(() => {
    console.log('RetrievalAnimation states:', { 
      startAnimation, 
      animationComplete,
      currentStep,
      disturbed_items: disturbed_items?.length || 0
    });
  }, [startAnimation, animationComplete, currentStep, disturbed_items]);

  // Reset animation objects when animation completes
  useEffect(() => {
    if (animationComplete && !startAnimation) {
      // Reset 3D objects after animation completes
      setTimeout(() => {
        if (sceneRef.current.targetItem) {
          sceneRef.current.targetItem.position.set(0, 0, 0);
          sceneRef.current.targetItem.scale.set(1, 1, 1);
        }
        
        if (sceneRef.current.containerMaterial) {
          sceneRef.current.containerMaterial.opacity = 0.8;
        }
        
        // Reset obstacles if any
        if (sceneRef.current.obstacleItems && sceneRef.current.obstaclePositions) {
          sceneRef.current.obstacleItems.forEach((item, index) => {
            if (item && sceneRef.current.obstaclePositions[index]) {
              item.position.copy(sceneRef.current.obstaclePositions[index]);
            }
          });
        }
      }, 500);
    }
  }, [animationComplete, startAnimation]);

  return (
    <div className="w-full h-full flex flex-col">
      <div ref={mountRef} className="flex-grow relative" id="scene-container">
        {animationError && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-30">
            <p className="text-white font-bold">Error during animation</p>
          </div>
        )}
      </div>
      <div className="p-4 bg-gray-900 text-white">
        <div className="flex justify-between mb-1">
          <span>{animationDescription}</span>
          <span>Step {currentStep}/5</span>
        </div>
        <div className="w-full bg-gray-800 h-1">
          <div 
            className="bg-green-500 h-1 transition-all duration-300"
            style={{ width: `${animationProgress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default RetrievalAnimation; 