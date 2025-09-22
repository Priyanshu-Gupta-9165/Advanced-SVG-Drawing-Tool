document.addEventListener('DOMContentLoaded', function() {
            // Get DOM elements
            const canvas = document.getElementById('svg-canvas');
            const shapeButtons = document.querySelectorAll('.shape-btn');
            const strokeColor = document.getElementById('stroke-color');
            const fillColor = document.getElementById('fill-color');
            const strokeWidth = document.getElementById('stroke-width');
            const widthValue = document.getElementById('width-value');
            const opacity = document.getElementById('opacity');
            const opacityValue = document.getElementById('opacity-value');
            const dashArray = document.getElementById('dash-array');
            const dashValue = document.getElementById('dash-value');
            const clearBtn = document.getElementById('clear-btn');
            const exportBtn = document.getElementById('export-btn');
            const undoBtn = document.getElementById('undo-btn');
            const redoBtn = document.getElementById('redo-btn');
            const helpBtn = document.getElementById('help-btn');
            const coordinates = document.querySelector('.coordinates');
            const drawingMode = document.querySelector('.drawing-mode');
            const toast = document.getElementById('toast');
            const helpModal = document.getElementById('help-modal');
            const closeBtn = document.querySelector('.close-btn');
            const previewSvg = document.getElementById('preview-svg');
            const zoomInBtn = document.getElementById('zoom-in');
            const zoomOutBtn = document.getElementById('zoom-out');
            const resetViewBtn = document.getElementById('reset-view');
            const snapToGridBtn = document.getElementById('snap-to-grid');
            
            // Transformation controls
            const rotation = document.getElementById('rotation');
            const scaleX = document.getElementById('scaleX');
            const scaleY = document.getElementById('scaleY');
            const posX = document.getElementById('posX');
            const posY = document.getElementById('posY');
            
            // Drawing state
            let currentShape = 'rectangle';
            let isDrawing = false;
            let startX, startY;
            let currentElement = null;
            let selectedElement = null;
            let polygons = [];
            let currentPolygon = null;
            let history = [];
            let historyIndex = -1;
            let zoomLevel = 1;
            let snapToGrid = true;
            let canvasTransform = {
                x: 0,
                y: 0,
                scale: 1
            };
            
            // Initialize canvas
            setCanvasSize();
            updateShapePreview();
            
            // Set active shape
            shapeButtons.forEach(button => {
                button.addEventListener('click', function() {
                    shapeButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');
                    currentShape = this.dataset.shape;
                    drawingMode.textContent = `Current Tool: ${currentShape.charAt(0).toUpperCase() + currentShape.slice(1)}`;
                    updateShapePreview();
                    
                    // If switching to polygon, reset current polygon
                    if (currentShape !== 'polygon') {
                        currentPolygon = null;
                    }
                });
            });
            
            // Toggle snap to grid
            snapToGridBtn.addEventListener('click', function() {
                snapToGrid = !snapToGrid;
                this.classList.toggle('active', snapToGrid);
                showToast(snapToGrid ? "Snap to grid enabled" : "Snap to grid disabled");
            });
            
            // Zoom functionality
            zoomInBtn.addEventListener('click', function() {
                zoomLevel = Math.min(zoomLevel + 0.1, 3);
                updateCanvasZoom();
            });
            
            zoomOutBtn.addEventListener('click', function() {
                zoomLevel = Math.max(zoomLevel - 0.1, 0.5);
                updateCanvasZoom();
            });
            
            resetViewBtn.addEventListener('click', function() {
                zoomLevel = 1;
                canvasTransform.x = 0;
                canvasTransform.y = 0;
                updateCanvasZoom();
            });
            
            function updateCanvasZoom() {
                canvas.style.transform = `scale(${zoomLevel})`;
                showToast(`Zoom: ${Math.round(zoomLevel * 100)}%`);
            }
            
            // Update stroke width display
            strokeWidth.addEventListener('input', function() {
                widthValue.textContent = `${this.value}px`;
                if (selectedElement) {
                    selectedElement.setAttribute('stroke-width', this.value);
                    saveState();
                }
                updateShapePreview();
            });
            
            // Update opacity display
            opacity.addEventListener('input', function() {
                opacityValue.textContent = `${Math.round(this.value * 100)}%`;
                if (selectedElement) {
                    selectedElement.setAttribute('opacity', this.value);
                    saveState();
                }
                updateShapePreview();
            });
            
            // Update dash array
            dashArray.addEventListener('input', function() {
                const value = this.value;
                if (value == 0) {
                    dashValue.textContent = "Solid";
                } else {
                    dashValue.textContent = `Dashed: ${value}`;
                }
                
                if (selectedElement) {
                    if (value == 0) {
                        selectedElement.removeAttribute('stroke-dasharray');
                    } else {
                        selectedElement.setAttribute('stroke-dasharray', value);
                    }
                    saveState();
                }
                updateShapePreview();
            });
            
            // Color change events
            strokeColor.addEventListener('input', function() {
                if (selectedElement) {
                    selectedElement.setAttribute('stroke', this.value);
                    saveState();
                }
                updateShapePreview();
            });
            
            fillColor.addEventListener('input', function() {
                if (selectedElement) {
                    selectedElement.setAttribute('fill', this.value);
                    saveState();
                }
                updateShapePreview();
            });
            
            // Transformation events
            rotation.addEventListener('change', applyTransformations);
            scaleX.addEventListener('change', applyTransformations);
            scaleY.addEventListener('change', applyTransformations);
            posX.addEventListener('change', applyTransformations);
            posY.addEventListener('change', applyTransformations);
            
            // Mouse event handlers
            canvas.addEventListener('mousedown', startDrawing);
            canvas.addEventListener('mousemove', handleMouseMove);
            canvas.addEventListener('mouseup', stopDrawing);
            canvas.addEventListener('mouseleave', stopDrawing);
            canvas.addEventListener('click', handleCanvasClick);
            
            // Clear canvas
            clearBtn.addEventListener('click', function() {
                while (canvas.firstChild) {
                    canvas.removeChild(canvas.firstChild);
                }
                polygons = [];
                currentPolygon = null;
                selectedElement = null;
                saveState();
                showToast("Canvas cleared");
            });
            
            // Export SVG
            exportBtn.addEventListener('click', function() {
                const svgData = new XMLSerializer().serializeToString(canvas);
                const blob = new Blob([svgData], {type: 'image/svg+xml'});
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = 'drawing.svg';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                showToast("Drawing exported as SVG");
            });
            
            // Undo/Redo functionality
            undoBtn.addEventListener('click', undo);
            redoBtn.addEventListener('click', redo);
            
            // Help modal
            helpBtn.addEventListener('click', function() {
                helpModal.style.display = 'flex';
            });
            
            closeBtn.addEventListener('click', function() {
                helpModal.style.display = 'none';
            });
            
            window.addEventListener('click', function(e) {
                if (e.target === helpModal) {
                    helpModal.style.display = 'none';
                }
            });
            
            // Initialize with empty state
            saveState();
            
            // Set canvas size based on container
            function setCanvasSize() {
                const drawingArea = document.querySelector('.drawing-area');
                const width = drawingArea.clientWidth;
                const height = drawingArea.clientHeight;
                
                canvas.setAttribute('width', width);
                canvas.setAttribute('height', height);
            }
            
            // Update shape preview
            function updateShapePreview() {
                // Clear preview
                while (previewSvg.firstChild) {
                    previewSvg.removeChild(previewSvg.firstChild);
                }
                
                // Create preview element
                let previewElement;
                const strokeVal = strokeColor.value;
                const fillVal = fillColor.value;
                const strokeWidthVal = strokeWidth.value;
                const opacityVal = opacity.value;
                const dashVal = dashArray.value > 0 ? dashArray.value : null;
                
                switch (currentShape) {
                    case 'rectangle':
                        previewElement = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                        previewElement.setAttribute('x', 10);
                        previewElement.setAttribute('y', 10);
                        previewElement.setAttribute('width', 30);
                        previewElement.setAttribute('height', 30);
                        break;
                    case 'circle':
                        previewElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                        previewElement.setAttribute('cx', 25);
                        previewElement.setAttribute('cy', 25);
                        previewElement.setAttribute('r', 15);
                        break;
                    case 'line':
                        previewElement = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        previewElement.setAttribute('x1', 10);
                        previewElement.setAttribute('y1', 10);
                        previewElement.setAttribute('x2', 40);
                        previewElement.setAttribute('y2', 40);
                        break;
                    case 'polygon':
                        previewElement = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                        previewElement.setAttribute('points', '25,5 40,40 10,40');
                        break;
                    case 'star':
                        previewElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        previewElement.setAttribute('d', 'M25,5 L30,20 L45,20 L33,30 L38,45 L25,35 L12,45 L17,30 L5,20 L20,20 Z');
                        break;
                    case 'arrow':
                        previewElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        previewElement.setAttribute('d', 'M10,25 L35,25 M35,25 L28,20 M35,25 L28,30');
                        break;
                }
                
                // Apply styles
                previewElement.setAttribute('stroke', strokeVal);
                previewElement.setAttribute('fill', currentShape !== 'line' ? fillVal : 'none');
                previewElement.setAttribute('stroke-width', strokeWidthVal);
                previewElement.setAttribute('opacity', opacityVal);
                if (dashVal) {
                    previewElement.setAttribute('stroke-dasharray', dashVal);
                }
                
                previewSvg.appendChild(previewElement);
            }
            
            // Handle mouse movement for coordinates and drawing
            function handleMouseMove(e) {
                const rect = canvas.getBoundingClientRect();
                let x = e.clientX - rect.left;
                let y = e.clientY - rect.top;
                
                // Apply zoom transformation
                x = x / zoomLevel;
                y = y / zoomLevel;
                
                // Snap to grid if enabled
                if (snapToGrid) {
                    x = Math.round(x / 8) * 8;
                    y = Math.round(y / 8) * 8;
                }
                
                // Update coordinates display
                coordinates.textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
                
                // If drawing, continue drawing
                if (isDrawing) {
                    draw(e);
                }
            }
            
            // Handle canvas click for selecting elements
            function handleCanvasClick(e) {
                if (isDrawing) return; // Skip if we're in the middle of drawing
                
                const elements = document.elementsFromPoint(e.clientX, e.clientY);
                const shape = elements.find(el => el !== canvas && el.parentNode === canvas);
                
                // Deselect if clicking on canvas with no shape
                if (!shape) {
                    if (selectedElement) {
                        selectedElement.classList.remove('selected');
                        selectedElement = null;
                    }
                    return;
                }
                
                // Select the clicked shape
                if (selectedElement) {
                    selectedElement.classList.remove('selected');
                }
                
                selectedElement = shape;
                shape.classList.add('selected');
                
                // Update transformation controls with selected shape's properties
                updateTransformControls(shape);
                
                showToast("Shape selected");
            }
            
            // Update transformation controls based on selected shape
            function updateTransformControls(shape) {
                const transform = shape.getAttribute('transform') || '';
                const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                const rotateMatch = transform.match(/rotate\(([^)]+)\)/);
                const scaleMatch = transform.match(/scale\(([^,]+),\s*([^)]+)\)/);
                
                if (translateMatch) {
                    posX.value = parseFloat(translateMatch[1]);
                    posY.value = parseFloat(translateMatch[2]);
                } else {
                    posX.value = 0;
                    posY.value = 0;
                }
                
                if (rotateMatch) {
                    rotation.value = parseFloat(rotateMatch[1]);
                } else {
                    rotation.value = 0;
                }
                
                if (scaleMatch) {
                    scaleX.value = parseFloat(scaleMatch[1]);
                    scaleY.value = parseFloat(scaleMatch[2]);
                } else {
                    scaleX.value = 1;
                    scaleY.value = 1;
                }
                
                // Update style controls
                strokeWidth.value = shape.getAttribute('stroke-width') || 2;
                widthValue.textContent = `${strokeWidth.value}px`;
                
                strokeColor.value = rgbToHex(shape.getAttribute('stroke')) || '#000000';
                fillColor.value = rgbToHex(shape.getAttribute('fill')) || '#4b6cb7';
                
                const opacityValue = shape.getAttribute('opacity') || 1;
                opacity.value = opacityValue;
                opacityValue.textContent = `${Math.round(opacityValue * 100)}%`;
                
                const dashValue = shape.getAttribute('stroke-dasharray') || 0;
                dashArray.value = dashValue;
                if (dashValue == 0) {
                    dashValue.textContent = "Solid";
                } else {
                    dashValue.textContent = `Dashed: ${dashValue}`;
                }
            }
            
            // Convert RGB color to hex
            function rgbToHex(rgb) {
                if (!rgb || rgb === 'none') return null;
                
                if (rgb.startsWith('#')) return rgb;
                
                const rgbMatch = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
                if (rgbMatch) {
                    return `#${parseInt(rgbMatch[1]).toString(16).padStart(2, '0')}${parseInt(rgbMatch[2]).toString(16).padStart(2, '0')}${parseInt(rgbMatch[3]).toString(16).padStart(2, '0')}`;
                }
                
                return null;
            }
            
            // Apply transformations to selected element
            function applyTransformations() {
                if (!selectedElement) return;
                
                const tx = posX.value || 0;
                const ty = posY.value || 0;
                const rot = rotation.value || 0;
                const sx = scaleX.value || 1;
                const sy = scaleY.value || 1;
                
                let transform = '';
                
                if (tx != 0 || ty != 0) {
                    transform += `translate(${tx}, ${ty}) `;
                }
                
                if (rot != 0) {
                    transform += `rotate(${rot}) `;
                }
                
                if (sx != 1 || sy != 1) {
                    transform += `scale(${sx}, ${sy})`;
                }
                
                selectedElement.setAttribute('transform', transform.trim());
                saveState();
                
                showToast("Transformation applied");
            }
            
            // Drawing functions
            function startDrawing(e) {
                if (e.target !== canvas) return; // Only start drawing on canvas, not on existing shapes
                
                isDrawing = true;
                const rect = canvas.getBoundingClientRect();
                let x = e.clientX - rect.left;
                let y = e.clientY - rect.top;
                
                // Apply zoom transformation
                x = x / zoomLevel;
                y = y / zoomLevel;
                
                // Snap to grid if enabled
                if (snapToGrid) {
                    x = Math.round(x / 8) * 8;
                    y = Math.round(y / 8) * 8;
                }
                
                startX = x;
                startY = y;
                
                if (currentShape === 'polygon') {
                    if (!currentPolygon) {
                        // Start a new polygon
                        currentPolygon = {
                            points: [],
                            element: null
                        };
                        polygons.push(currentPolygon);
                    }
                    
                    // Add point to current polygon
                    currentPolygon.points.push([startX, startY]);
                    
                    // Create or update polygon element
                    if (!currentPolygon.element) {
                        currentPolygon.element = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                        canvas.appendChild(currentPolygon.element);
                        applyStyles(currentPolygon.element);
                    }
                    
                    updatePolygonPoints(currentPolygon);
                } else {
                    // Create shape element
                    currentElement = createShapeElement();
                    canvas.appendChild(currentElement);
                }
            }
            
            function draw(e) {
                if (!isDrawing) return;
                
                const rect = canvas.getBoundingClientRect();
                let x = e.clientX - rect.left;
                let y = e.clientY - rect.top;
                
                // Apply zoom transformation
                x = x / zoomLevel;
                y = y / zoomLevel;
                
                // Snap to grid if enabled
                if (snapToGrid) {
                    x = Math.round(x / 8) * 8;
                    y = Math.round(y / 8) * 8;
                }
                
                if (currentShape === 'polygon') {
                    // For polygon, we just update the last point temporarily
                    if (currentPolygon && currentPolygon.points.length > 0) {
                        const tempPoints = [...currentPolygon.points];
                        tempPoints.push([x, y]);
                        updatePolygonPoints({points: tempPoints, element: currentPolygon.element});
                    }
                } else {
                    // Update the shape based on mouse position
                    updateShape(currentElement, x, y);
                }
            }
            
            function stopDrawing() {
                if (!isDrawing) return;
                
                isDrawing = false;
                
                if (currentShape !== 'polygon') {
                    // Select the newly created shape
                    if (selectedElement) {
                        selectedElement.classList.remove('selected');
                    }
                    selectedElement = currentElement;
                    if (selectedElement) {
                        selectedElement.classList.add('selected');
                        updateTransformControls(selectedElement);
                    }
                    
                    currentElement = null;
                    showToast("Shape created");
                }
                
                saveState();
            }
            
            function createShapeElement() {
                let element;
                
                switch (currentShape) {
                    case 'rectangle':
                        element = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                        break;
                    case 'circle':
                        element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                        break;
                    case 'line':
                        element = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        break;
                    case 'star':
                        element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        break;
                    case 'arrow':
                        element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        break;
                    default:
                        element = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                }
                
                applyStyles(element);
                return element;
            }
            
            function applyStyles(element) {
                element.setAttribute('stroke', strokeColor.value);
                element.setAttribute('stroke-width', strokeWidth.value);
                element.setAttribute('fill', currentShape !== 'line' ? fillColor.value : 'none');
                element.setAttribute('opacity', opacity.value);
                
                if (dashArray.value > 0) {
                    element.setAttribute('stroke-dasharray', dashArray.value);
                }
            }
            
            function updateShape(element, currentX, currentY) {
                const width = currentX - startX;
                const height = currentY - startY;
                
                switch (currentShape) {
                    case 'rectangle':
                        element.setAttribute('x', Math.min(startX, currentX));
                        element.setAttribute('y', Math.min(startY, currentY));
                        element.setAttribute('width', Math.abs(width));
                        element.setAttribute('height', Math.abs(height));
                        break;
                    case 'circle':
                        const radius = Math.sqrt(width * width + height * height) / 2;
                        element.setAttribute('cx', startX);
                        element.setAttribute('cy', startY);
                        element.setAttribute('r', radius);
                        break;
                    case 'line':
                        element.setAttribute('x1', startX);
                        element.setAttribute('y1', startY);
                        element.setAttribute('x2', currentX);
                        element.setAttribute('y2', currentY);
                        break;
                    case 'star':
                        // Create star shape
                        const points = calculateStarPoints(startX, startY, Math.abs(width), Math.abs(height));
                        element.setAttribute('d', pointsToPath(points));
                        break;
                    case 'arrow':
                        // Create arrow shape
                        const arrowPath = calculateArrowPath(startX, startY, currentX, currentY);
                        element.setAttribute('d', arrowPath);
                        break;
                }
            }
            
            // Calculate points for a star
            function calculateStarPoints(cx, cy, width, height) {
                const outerRadius = Math.max(width, height) / 2;
                const innerRadius = outerRadius * 0.4;
                const points = [];
                
                for (let i = 0; i < 10; i++) {
                    const angle = Math.PI / 5 * i;
                    const radius = i % 2 === 0 ? outerRadius : innerRadius;
                    const x = cx + radius * Math.sin(angle);
                    const y = cy - radius * Math.cos(angle);
                    points.push([x, y]);
                }
                
                return points;
            }
            
            // Convert points to SVG path
            function pointsToPath(points) {
                return points.map((point, i) => {
                    return `${i === 0 ? 'M' : 'L'} ${point[0]},${point[1]}`;
                }).join(' ') + ' Z';
            }
            
            // Calculate arrow path
            function calculateArrowPath(startX, startY, endX, endY) {
                const headLength = 15;
                const headWidth = 10;
                
                const angle = Math.atan2(endY - startY, endX - startX);
                
                // Calculate the points for the arrowhead
                const leftX = endX - headLength * Math.cos(angle) + headWidth * Math.sin(angle);
                const leftY = endY - headLength * Math.sin(angle) - headWidth * Math.cos(angle);
                
                const rightX = endX - headLength * Math.cos(angle) - headWidth * Math.sin(angle);
                const rightY = endY - headLength * Math.sin(angle) + headWidth * Math.cos(angle);
                
                return `M ${startX},${startY} L ${endX},${endY} M ${leftX},${leftY} L ${endX},${endY} L ${rightX},${rightY}`;
            }
            
            function updatePolygonPoints(polygon) {
                const pointsString = polygon.points.map(point => point.join(',')).join(' ');
                polygon.element.setAttribute('points', pointsString);
            }
            
            // Double-click to finish polygon
            canvas.addEventListener('dblclick', function() {
                if (currentShape === 'polygon' && currentPolygon) {
                    // Select the finished polygon
                    if (selectedElement) {
                        selectedElement.classList.remove('selected');
                    }
                    selectedElement = currentPolygon.element;
                    selectedElement.classList.add('selected');
                    updateTransformControls(selectedElement);
                    
                    currentPolygon = null;
                    saveState();
                    showToast("Polygon completed");
                }
            });
            
            // Save canvas state for undo/redo
            function saveState() {
                // Remove future states if we're not at the end of history
                if (historyIndex < history.length - 1) {
                    history = history.slice(0, historyIndex + 1);
                }
                
                // Save current state
                history.push(canvas.innerHTML);
                historyIndex++;
                
                // Limit history size
                if (history.length > 50) {
                    history.shift();
                    historyIndex--;
                }
                
                // Update undo/redo buttons
                updateUndoRedoButtons();
            }
            
            // Undo functionality
            function undo() {
                if (historyIndex <= 0) return;
                
                historyIndex--;
                canvas.innerHTML = history[historyIndex];
                
                // Deselect any selected element
                if (selectedElement) {
                    selectedElement.classList.remove('selected');
                    selectedElement = null;
                }
                
                updateUndoRedoButtons();
                showToast("Undo performed");
            }
            
            // Redo functionality
            function redo() {
                if (historyIndex >= history.length - 1) return;
                
                historyIndex++;
                canvas.innerHTML = history[historyIndex];
                
                // Deselect any selected element
                if (selectedElement) {
                    selectedElement.classList.remove('selected');
                    selectedElement = null;
                }
                
                updateUndoRedoButtons();
                showToast("Redo performed");
            }
            
            // Update undo/redo buttons state
            function updateUndoRedoButtons() {
                undoBtn.disabled = historyIndex <= 0;
                redoBtn.disabled = historyIndex >= history.length - 1;
            }
            
            // Show toast notification
            function showToast(message) {
                toast.textContent = message;
                toast.classList.add('show');
                
                setTimeout(function() {
                    toast.classList.remove('show');
                }, 3000);
            }
            
            // Handle window resize
            window.addEventListener('resize', function() {
                setCanvasSize();
                saveState();
            });
        });
