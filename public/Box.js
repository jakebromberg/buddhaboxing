import AudioContextManager from './audioContextManager.js';
import { BoxState } from './boxState.js';
import { createEffect } from './nativeEffects.js';

export class Box {
    constructor(fileName, audioManager, onBoxUpdate, order) {
        this.fileName = fileName;
        this.order = order;
        this.audioManager = audioManager;
        this.sendBoxUpdate = onBoxUpdate;  // Rename to be more explicit
        this.isDragging = false;
        this.hasDragged = false;
        this.startX = 0;
        this.startY = 0;
        this.initialX = 0;
        this.initialY = 0;
        this.debugMode = false;
        this.audioBuffer = null;

        this.createBoxElement();
        this.setupEventListeners();
        this.setupDebugModeListener();
        this.loadAudioLoop();
    }

    createBoxElement() {
        // Create box element
        this.element = document.createElement('div');
        this.element.classList.add('box');
        this.element.style.backgroundColor = this.getBoxColor();

        // Make boxes visible with explicit visibility and opacity
        this.element.style.visibility = 'visible';
        this.element.style.opacity = '1';
        this.element.style.zIndex = '1';

        // Add explicit transition styles including transform
        this.element.style.transition = 'height 0.3s ease, opacity 0.3s ease, transform 0.2s ease';
        this.element.style.transform = 'scale(1)';
        this.element.style.overflow = 'hidden';
        this.element.style.height = '40px';
        this.element.style.position = 'absolute';
        this.element.style.left = '10px';
        
        // Position box based on its order
        this.element.style.top = `${20 + (this.order - 1) * 50}px`;  // Subtract 1 since order starts at 1
        
        this.element.style.width = '120px';

        // Store reference to this box
        this.element.boxId = this.fileName;

        // Create box state manager (using the injected audioManager)
        this.state = new BoxState(this.element, this.fileName, this.audioManager);

        // Add box number
        const boxNumber = document.createElement('div');
        boxNumber.classList.add('box-number');
        boxNumber.textContent = this.fileName;
        this.element.appendChild(boxNumber);

        // Create controls container
        this.createControlsContainer();

        // Add box to body
        document.body.appendChild(this.element);
    }

    createControlsContainer() {
        const controlsContainer = document.createElement('div');
        controlsContainer.classList.add('controls-container');
        controlsContainer.style.opacity = '0';
        controlsContainer.style.transition = 'opacity 0.3s ease';
        controlsContainer.style.position = 'absolute';
        controlsContainer.style.top = '40px';
        controlsContainer.style.left = '0';
        controlsContainer.style.width = '100%';
        controlsContainer.style.padding = '10px';
        controlsContainer.style.boxSizing = 'border-box';
        controlsContainer.style.background = this.getBoxColor();
        this.element.appendChild(controlsContainer);

        // Add effect selector
        const effectLabel = document.createElement('div');
        effectLabel.classList.add('control-label');
        effectLabel.textContent = 'EFFECT';
        controlsContainer.appendChild(effectLabel);

        this.effectSelect = document.createElement('select');
        this.effectSelect.classList.add('effect-select');
        this.element.effectSelect = this.effectSelect;

        // Add effect options - using the correct effect names
        const effectNames = ['none', 'distortion', 'delay', 'reverb', 'convolver-reverb', 'flanger', 'stereo-chorus', 'bitcrusher', 'ring-modulator'];
        effectNames.forEach(effectName => {
            const option = document.createElement('option');
            option.value = effectName;
            // Format the display name nicely
            const displayName = effectName.split('-').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            option.textContent = displayName;
            this.effectSelect.appendChild(option);
        });

        this.effectSelect.value = 'none';
        controlsContainer.appendChild(this.effectSelect);

        // Create parameter container
        this.paramLabel = document.createElement('div');
        this.paramLabel.classList.add('control-label');
        this.paramLabel.textContent = 'PARAMETERS';
        this.paramLabel.style.display = 'none';
        controlsContainer.appendChild(this.paramLabel);

        this.paramContainer = document.createElement('div');
        this.paramContainer.classList.add('param-container');
        this.paramContainer.style.display = 'none';
        controlsContainer.appendChild(this.paramContainer);
        this.element.paramContainer = this.paramContainer;
        this.element.paramLabel = this.paramLabel;

        // Add mix slider
        this.mixLabel = document.createElement('div');
        this.mixLabel.classList.add('control-label');
        this.mixLabel.textContent = 'DRY/WET';
        this.mixLabel.style.display = 'none';
        controlsContainer.appendChild(this.mixLabel);

        this.mixSlider = document.createElement('input');
        this.mixSlider.type = 'range';
        this.mixSlider.min = 0;
        this.mixSlider.max = 100;
        this.mixSlider.value = 0;
        this.mixSlider.classList.add('mix-control');
        this.mixSlider.style.display = 'none';
        this.element.mixSlider = this.mixSlider;
        controlsContainer.appendChild(this.mixSlider);
        this.element.mixLabel = this.mixLabel;

        // Add volume controls
        const volumeLabel = document.createElement('div');
        volumeLabel.classList.add('control-label');
        volumeLabel.textContent = 'VOLUME';
        controlsContainer.appendChild(volumeLabel);

        this.volumeSlider = document.createElement('input');
        this.volumeSlider.type = 'range';
        this.volumeSlider.min = 0;
        this.volumeSlider.max = 100;
        this.volumeSlider.value = 100;
        this.volumeSlider.classList.add('volume-control');
        this.element.volumeSlider = this.volumeSlider;
        controlsContainer.appendChild(this.volumeSlider);
    }

    setupEventListeners() {
        // Create debounced version of checkBoxPosition
        const debouncedCheckPosition = this.debounce(() => {
            this.checkBoxPosition();
        }, 100);

        // Track touch start time for distinguishing taps from drags
        let touchStartTime = 0;
        let touchStartX = 0;
        let touchStartY = 0;

        // Drag event listeners for mouse
        this.element.addEventListener('mousedown', (e) => {
            this.handleDragStart(e);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.handleDragMove(e, debouncedCheckPosition);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.handleDragEnd(debouncedCheckPosition);
            }
        });

        // Click handler for mouse
        this.element.addEventListener('click', (e) => {
            if (!this.hasDragged) {
                this.handleBoxClick(e);
            }
        });

        // Touch event listeners with tap support
        this.element.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling
            const touch = e.touches[0];
            touchStartTime = Date.now();
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            this.handleDragStart(touch);
        });

        document.addEventListener('touchmove', (e) => {
            if (this.isDragging) {
                e.preventDefault(); // Prevent scrolling
                const touch = e.touches[0];
                // Calculate distance moved
                const deltaX = Math.abs(touch.clientX - touchStartX);
                const deltaY = Math.abs(touch.clientY - touchStartY);
                // If moved more than 10px, consider it a drag
                if (deltaX > 10 || deltaY > 10) {
                    this.hasDragged = true;
                }
                this.handleDragMove(touch, debouncedCheckPosition);
            }
        });

        document.addEventListener('touchend', (e) => {
            const touchEndTime = Date.now();
            const touchDuration = touchEndTime - touchStartTime;
            
            if (this.isDragging) {
                this.handleDragEnd(debouncedCheckPosition);
                // If touch duration was short and we didn't move much, treat as tap
                if (touchDuration < 200 && !this.hasDragged) {
                    this.handleBoxClick(e);
                }
            }
        });

        // Slider event listeners with improved handling
        const handleSliderInteraction = (e) => {
            e.stopPropagation();
            // Prevent the box from being draggable while interacting with sliders
            this.isDragging = false;
            this.hasDragged = false;
        };

        // Add event listeners for all slider interactions
        [this.mixSlider, this.volumeSlider].forEach(slider => {
            if (slider) {
                slider.addEventListener('mousedown', handleSliderInteraction);
                slider.addEventListener('touchstart', handleSliderInteraction);
                slider.addEventListener('click', handleSliderInteraction);
            }
        });

        // Effect selection handler
        this.effectSelect.addEventListener('mousedown', handleSliderInteraction);
        this.effectSelect.addEventListener('touchstart', handleSliderInteraction);
        this.effectSelect.addEventListener('click', handleSliderInteraction);
        this.effectSelect.addEventListener('change', (e) => this.handleEffectChange(e));

        // Mix control
        this.mixSlider.addEventListener('input', (e) => this.handleMixChange(e));

        // Volume control
        this.volumeSlider.addEventListener('input', (e) => this.handleVolumeChange(e));
    }

    setupDebugModeListener() {
        document.addEventListener('keydown', (e) => {
            // Debug the key event
            console.log('Key event:', {
                key: e.key,
                code: e.code,
                altKey: e.altKey,
                shiftKey: e.shiftKey,
                metaKey: e.metaKey,
                ctrlKey: e.ctrlKey
            });

            // Check for Option (Alt) + Shift + K
            const isOptionKey = e.altKey || e.metaKey; // Support both Option and Alt
            const isShiftKey = e.shiftKey;
            const isKKey = e.key.toLowerCase() === 'k' || e.code === 'KeyK';

            if (isOptionKey && isShiftKey && isKKey) {
                e.preventDefault(); // Prevent any default behavior
                this.debugMode = !this.debugMode;
                console.log('Debug mode:', this.debugMode ? 'enabled' : 'disabled');

                // Adjust box size based on debug mode
                this.adjustBoxSize(this.effectSelect.value);

                // Recreate parameter sliders to show/hide debug inputs
                if (this.effectSelect.value !== 'none') {
                    this.createParamSliders(this.element, this.effectSelect.value);
                }
            }
        });
    }

    getBoxColor() {
        // Create a deterministic color based on the fileName string
        let hash = 0;
        for (let i = 0; i < this.fileName.length; i++) {
            hash = this.fileName.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const boxColors = [
            '#FF6B6B', // red
            '#4ECDC4', // teal
            '#FFD166', // yellow
            '#6B5B95', // purple
            '#88D8B0', // green
            '#FF8C94', // pink
            '#5D98D2', // blue
            '#E6AA68', // orange
            '#A5AAA3'  // gray
        ];
        
        // Use the hash to select a color
        const colorIndex = Math.abs(hash) % boxColors.length;
        return boxColors[colorIndex];
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    handleDragStart(e) {
        if (e.target === this.effectSelect || e.target === this.mixSlider || e.target === this.volumeSlider ||
            e.target.closest('select') || e.target.closest('input')) {
            return;
        }

        this.isDragging = true;
        this.hasDragged = false;
        
        // Scale up the box when dragging starts
        this.element.style.transform = 'scale(1.1)';
        this.element.style.zIndex = '1000'; // Bring to front while dragging
        
        // Get current position from style (or default to current offset if not set)
        const currentLeft = this.element.style.left ? parseInt(this.element.style.left) : this.element.offsetLeft;
        const currentTop = this.element.style.top ? parseInt(this.element.style.top) : this.element.offsetTop;
        
        // Calculate offset from mouse/touch position to element edge
        const clientX = e.clientX || e.pageX;
        const clientY = e.clientY || e.pageY;
        this.startX = clientX - currentLeft;
        this.startY = clientY - currentTop;

        // Store initial position for drag detection
        this.initialX = currentLeft;
        this.initialY = currentTop;

        // Try to initialize audio context when dragging starts
        if (!this.audioManager.isReady()) {
            console.log('Audio context not ready, attempting initialization on drag');
            this.audioManager.initialize().catch(error => {
                console.warn('Audio initialization failed during drag:', error);
            });
        }
    }

    handleDragMove(e, debouncedCheckPosition) {
        if (!this.isDragging) return;

        // Calculate new position by subtracting the initial mouse offset
        const clientX = e.clientX || e.pageX;
        const clientY = e.clientY || e.pageY;
        const newX = clientX - this.startX;
        const newY = clientY - this.startY;

        // Update element position
        this.element.style.left = `${newX}px`;
        this.element.style.top = `${newY}px`;

        // Check if we've moved enough to count as a drag
        if (!this.hasDragged && (Math.abs(newX - this.initialX) > 5 || Math.abs(newY - this.initialY) > 5)) {
            this.hasDragged = true;
        }

        // Send position update
        if (this.sendBoxUpdate) {
            console.log('Box sending update:', {
                boxId: this.fileName,
                newX: newX,
                newY: newY,
                effect: this.effectSelect.value,
                mixValue: this.mixSlider.value / 100,
                volume: this.volumeSlider.value / 100,
                timestamp: new Date().toISOString()
            });
            
            this.sendBoxUpdate({
                boxId: this.fileName,
                newX: newX,
                newY: newY,
                effect: this.effectSelect.value,
                mixValue: this.mixSlider.value / 100,
                volume: this.volumeSlider.value / 100
            });
        } else {
            console.warn('Box update function not available:', {
                boxId: this.fileName,
                timestamp: new Date().toISOString()
            });
        }

        // Check if box is in playable area
        debouncedCheckPosition();
    }

    handleDragEnd(debouncedCheckPosition) {
        console.log('Drag end event:', {
            isDragging: this.isDragging,
            hasDragged: this.hasDragged,
        });
        if (this.isDragging) {
            // Reset scale and z-index when dragging ends
            this.element.style.transform = 'scale(1)';
            this.element.style.zIndex = '1';
            
            // Only check position if we actually dragged
            if (this.hasDragged) {
                debouncedCheckPosition();

                // Only collapse if the box wasn't expanded before dragging
                if (!this.element.classList.contains('expanded')) {
                    const controlsContainer = this.element.querySelector('.controls-container');
                    controlsContainer.style.opacity = '0';
                    this.element.style.height = '40px';
                }
            }

            // Reset isDragging immediately
            this.isDragging = false;
            
            // Reset hasDragged after a short delay to ensure click handler sees the correct state
            setTimeout(() => {
                this.hasDragged = false;
            }, 0);
        }
    }

    handleBoxClick(e) {
        console.log('Box click event:', {
            isDragging: this.isDragging,
            hasDragged: this.hasDragged,
            target: e.target,
            targetType: e.target.tagName,
            targetClass: e.target.classList,
            hasEffect: this.effectSelect.value !== 'none',
            isExpanded: this.element.classList.contains('expanded')
        });

        // Don't handle click if we're dragging or if we just dragged
        if (this.isDragging || this.hasDragged) {
            console.log('Box click ignored - currently dragging or just dragged');
            return;
        }

        // Don't handle click if it was on a control element
        if (e.target === this.effectSelect ||
            e.target === this.mixSlider ||
            e.target === this.volumeSlider ||
            e.target.closest('select') ||
            e.target.closest('input') ||
            e.target.closest('.controls-container')) {
            console.log('Box click ignored - control element clicked');
            return;
        }

        // Toggle expanded state
        const isExpanded = this.element.classList.contains('expanded');
        this.element.classList.toggle('expanded');

        // Update controls visibility
        const controlsContainer = this.element.querySelector('.controls-container');
        if (controlsContainer) {
            controlsContainer.style.opacity = isExpanded ? '0' : '1';
        }

        // Always adjust box size based on current effect
        const currentEffect = this.effectSelect.value;
        this.adjustBoxSize(currentEffect);

        // If we have an effect, ensure controls are visible when expanded
        if (currentEffect !== 'none' && !isExpanded) {
            if (this.paramContainer) {
                this.paramContainer.style.display = 'block';
                this.paramLabel.style.display = 'block';
            }
            if (this.mixLabel) {
                this.mixLabel.style.display = 'block';
                this.mixSlider.style.display = 'block';
            }
        }

        // Send state update to sync expansion state
        if (this.sendBoxUpdate) {
            const currentX = parseInt(this.element.style.left);
            const currentY = parseInt(this.element.style.top);
            
            this.sendBoxUpdate({
                boxId: this.fileName,
                newX: currentX,
                newY: currentY,
                effect: this.effectSelect.value,
                mixValue: this.mixSlider.value / 100,
                volume: this.volumeSlider.value / 100,
                isExpanded: !isExpanded  // Send the new expansion state
            });
        }

        console.log('Box click handled:', {
            wasExpanded: isExpanded,
            isNowExpanded: this.element.classList.contains('expanded'),
            effect: currentEffect,
            newHeight: this.element.style.height,
            controlsOpacity: controlsContainer?.style.opacity
        });
    }

    handleEffectChange(e) {
        const effectName = this.effectSelect.value;
        
        // Get current position from style at the start
        const currentX = parseInt(this.element.style.left);
        const currentY = parseInt(this.element.style.top);
        
        // Send effect update
        if (this.sendBoxUpdate) {
            console.log('Box sending effect update:', {
                boxId: this.fileName,
                effect: effectName,
                timestamp: new Date().toISOString()
            });
            
            this.sendBoxUpdate({
                boxId: this.fileName,
                newX: currentX,
                newY: currentY,
                effect: effectName,
                mixValue: this.mixSlider.value / 100,
                volume: this.volumeSlider.value / 100,
                isExpanded: this.element.classList.contains('expanded')
            });
        }

        try {
            this.state.cleanupEffect();
            this.state.setupEffect(effectName, { [effectName]: (audioCtx) => createEffect(effectName, audioCtx) }, this.createParamSliders.bind(this), this.element);

            if (effectName !== 'none') {
                this.element.classList.add('expanded');
                const controlsContainer = this.element.querySelector('.controls-container');
                controlsContainer.style.opacity = '1';

                this.adjustBoxSize(effectName);

                if (this.paramContainer) {
                    this.paramContainer.style.display = 'block';
                    this.paramLabel.style.display = 'block';
                }
                if (this.mixLabel) {
                    this.mixLabel.style.display = 'block';
                    this.mixSlider.style.display = 'block';
                }

                // Send another update after expansion is complete
                if (this.sendBoxUpdate) {
                    this.sendBoxUpdate({
                        boxId: this.fileName,
                        newX: currentX,
                        newY: currentY,
                        effect: effectName,
                        mixValue: this.mixSlider.value / 100,
                        volume: this.volumeSlider.value / 100,
                        isExpanded: true
                    });
                }
            } else {
                // Hide controls when 'none' is selected
                this.element.classList.remove('expanded');
                const controlsContainer = this.element.querySelector('.controls-container');
                controlsContainer.style.opacity = '0';

                if (this.paramContainer) {
                    this.paramContainer.style.display = 'none';
                    this.paramLabel.style.display = 'none';
                }
                if (this.mixLabel) {
                    this.mixLabel.style.display = 'none';
                    this.mixSlider.style.display = 'none';
                }
                this.element.style.height = '40px';

                // Send another update after collapse is complete
                if (this.sendBoxUpdate) {
                    this.sendBoxUpdate({
                        boxId: this.fileName,
                        newX: currentX,
                        newY: currentY,
                        effect: effectName,
                        mixValue: this.mixSlider.value / 100,
                        volume: this.volumeSlider.value / 100,
                        isExpanded: false
                    });
                }
            }
        } catch (error) {
            console.error(`Failed to create effect ${effectName}:`, error);
            // Reset to no effect on error
            this.effectSelect.value = 'none';
            this.element.classList.remove('expanded');
        }
    }

    handleMixChange(e) {
        const mixValue = e.target.value / 100;
        
        // Send mix update
        if (this.sendBoxUpdate) {
            console.log('Box sending mix update:', {
                boxId: this.fileName,
                mixValue,
                timestamp: new Date().toISOString()
            });
            
            // Get current position from style
            const currentX = parseInt(this.element.style.left);
            const currentY = parseInt(this.element.style.top);
            
            this.sendBoxUpdate({
                boxId: this.fileName,
                newX: currentX,
                newY: currentY,
                effect: this.effectSelect.value,
                mixValue: mixValue,
                volume: this.volumeSlider.value / 100,
                isExpanded: this.element.classList.contains('expanded')
            });
        }

        if (this.effectSelect.value !== 'none') {
            this.state.applyMix(mixValue);
        }
    }

    handleVolumeChange(e) {
        const volume = e.target.value / 100;
        
        // Send volume update
        if (this.sendBoxUpdate) {
            console.log('Box sending volume update:', {
                boxId: this.fileName,
                volume,
                timestamp: new Date().toISOString()
            });
            
            // Get current position from style
            const currentX = parseInt(this.element.style.left);
            const currentY = parseInt(this.element.style.top);
            
            this.sendBoxUpdate({
                boxId: this.fileName,
                newX: currentX,
                newY: currentY,
                effect: this.effectSelect.value,
                mixValue: this.mixSlider.value / 100,
                volume: volume,
                isExpanded: this.element.classList.contains('expanded')
            });
        }

        this.state.setVolume(volume);
    }

    createParamSliders(box, effectName) {
        if (!this.paramContainer) return;

        // Clear existing sliders
        this.paramContainer.innerHTML = '';

        // Get effect parameters from the effect instance
        const effectInstance = this.state.effectInstance;
        if (!effectInstance) {
            console.error(`Effect instance not initialized: ${effectName}`);
            return;
        }

        const params = effectInstance.getParams();
        if (!params) {
            console.error(`No parameters found for effect: ${effectName}`);
            return;
        }

        // Create sliders for each parameter
        Object.entries(params).forEach(([paramName, param]) => {
            // Create parameter container
            const paramContainer = document.createElement('div');
            paramContainer.classList.add('param-container');
            paramContainer.style.marginBottom = '20px';
            paramContainer.style.width = '100%';

            // Create label container
            const labelContainer = document.createElement('div');
            labelContainer.style.marginBottom = '10px';

            const label = document.createElement('div');
            label.classList.add('control-label');
            label.textContent = paramName.toUpperCase();
            label.style.fontSize = '12px';
            label.style.color = '#666';
            labelContainer.appendChild(label);

            // Create slider container
            const sliderContainer = document.createElement('div');
            sliderContainer.style.display = 'flex';
            sliderContainer.style.alignItems = 'center';
            sliderContainer.style.width = '100%';
            sliderContainer.style.gap = '10px'; // Use gap for consistent spacing

            // Create min value input if in debug mode
            let minInput;
            if (this.debugMode) {
                minInput = document.createElement('input');
                minInput.type = 'number';
                minInput.step = '0.01';
                minInput.value = param.min;
                minInput.style.width = '80px';
                minInput.style.padding = '4px';
                minInput.style.border = '1px solid #ccc';
                minInput.style.borderRadius = '4px';
                minInput.addEventListener('change', (e) => {
                    const newMin = parseFloat(e.target.value);
                    if (!isNaN(newMin) && newMin < param.max) {
                        param.min = newMin;
                        slider.min = newMin;
                    }
                });
            }

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = param.min;
            slider.max = param.max;
            slider.value = param.default;
            slider.classList.add('param-control');
            slider.style.flex = '1';
            slider.style.minWidth = '0'; // Important for flex item to shrink properly
            slider.style.height = '20px';

            // Create max value input if in debug mode
            let maxInput;
            if (this.debugMode) {
                maxInput = document.createElement('input');
                maxInput.type = 'number';
                maxInput.step = '0.01';
                maxInput.value = param.max;
                maxInput.style.width = '80px';
                maxInput.style.padding = '4px';
                maxInput.style.border = '1px solid #ccc';
                maxInput.style.borderRadius = '4px';
                maxInput.addEventListener('change', (e) => {
                    const newMax = parseFloat(e.target.value);
                    if (!isNaN(newMax) && newMax > param.min) {
                        param.max = newMax;
                        slider.max = newMax;
                    }
                });
            }

            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (effectInstance) {
                    try {
                        param.callback(value);
                    } catch (error) {
                        console.warn(`Error updating parameter ${paramName}:`, error);
                    }
                } else {
                    console.warn(`Effect instance not initialized for parameter: ${paramName}`);
                }
            });

            // Assemble the containers in the correct order
            if (this.debugMode) {
                sliderContainer.appendChild(minInput);
            }
            sliderContainer.appendChild(slider);
            if (this.debugMode) {
                sliderContainer.appendChild(maxInput);
            }

            paramContainer.appendChild(labelContainer);
            paramContainer.appendChild(sliderContainer);
            this.paramContainer.appendChild(paramContainer);
        });
    }

    adjustBoxSize(effectName) {
        console.log('Adjusting box size:', {
            effectName,
            isExpanded: this.element.classList.contains('expanded'),
            currentHeight: this.element.style.height
        });

        // If effect is "none", just set the base height
        if (effectName === 'none') {
            console.log('Setting base height for none effect');
            if (this.element.classList.contains('expanded')) {
                this.element.style.height = '180px';
            } else {
                this.element.style.height = '40px';
            }
            if (this.paramContainer) {
                this.paramContainer.style.display = 'none';
                this.paramLabel.style.display = 'none';
            }
            if (this.mixLabel) {
                this.mixLabel.style.display = 'none';
                this.mixSlider.style.display = 'none';
            }
            return;
        }

        // Get the effect instance and its parameters
        const effectInstance = this.state.effectInstance;
        if (!effectInstance) {
            console.error(`Effect instance not initialized: ${effectName}`);
            return;
        }

        const params = effectInstance.getParams();
        if (!params) {
            console.error(`No parameters found for effect: ${effectName}`);
            return;
        }

        // Calculate the total height needed
        const baseHeight = 180; // Base height for controls
        const paramHeight = 60; // Height per parameter (label + slider)
        const paramCount = Object.keys(params).length;
        const volumeHeight = 60; // Height for volume control
        const totalHeight = baseHeight + (paramCount * paramHeight) + volumeHeight;

        // Adjust width based on debug mode
        if (this.debugMode) {
            this.element.style.width = '300px'; // Wider width for debug mode
            if (this.paramContainer) {
                this.paramContainer.style.width = '280px'; // Slightly smaller than box width
            }
        } else {
            this.element.style.width = '120px'; // Default width
            if (this.paramContainer) {
                this.paramContainer.style.width = '100px'; // Default width
            }
        }

        console.log('Calculating new height:', {
            paramCount,
            baseHeight,
            totalHeight,
            isExpanded: this.element.classList.contains('expanded')
        });

        // Show/hide controls based on expanded state
        if (this.element.classList.contains('expanded')) {
            this.paramLabel.style.display = 'block';
            this.paramContainer.style.display = 'block';
            this.mixLabel.style.display = 'block';
            this.mixSlider.style.display = 'block';

            // Force a reflow to ensure the transition works
            this.element.offsetHeight;

            console.log('Setting expanded height:', totalHeight);
            this.element.style.height = `${totalHeight}px`;
        } else {
            this.paramLabel.style.display = 'none';
            this.paramContainer.style.display = 'none';
            this.mixLabel.style.display = 'none';
            this.mixSlider.style.display = 'none';

            // Force a reflow to ensure the transition works
            this.element.offsetHeight;

            console.log('Setting collapsed height');
            this.element.style.height = '40px';
        }

        // Log the final state
        console.log('Box size adjusted:', {
            effectName,
            isExpanded: this.element.classList.contains('expanded'),
            newHeight: this.element.style.height,
            computedHeight: window.getComputedStyle(this.element).height
        });
    }

    updateBoxPosition() {
        if (!this.isDragging) return;

        const currentX = this.element.offsetLeft;
        const currentY = this.element.offsetTop;
        const targetX = this.initialX;
        const targetY = this.initialY;
        const dx = targetX - currentX;
        const dy = targetY - currentY;

        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
            return;
        }

        const easing = 0.1;
        const newX = currentX + dx * easing;
        const newY = currentY + dy * easing;

        this.element.style.left = `${newX}px`;
        this.element.style.top = `${newY}px`;

        requestAnimationFrame(() => this.updateBoxPosition());
    }

    isBoxInsideTable(box) {
        const table = document.getElementById('table');
        if (!table) return false;

        const tableRect = table.getBoundingClientRect();
        const boxRect = box.getBoundingClientRect();

        return (
            boxRect.left >= tableRect.left &&
            boxRect.right <= tableRect.right &&
            boxRect.top >= tableRect.top &&
            boxRect.bottom <= tableRect.bottom
        );
    }

    checkBoxPosition() {
        const table = document.getElementById('table');
        if (!table) {
            console.error('Table element not found');
            return;
        }

        const tableRect = table.getBoundingClientRect();
        const boxRect = this.element.getBoundingClientRect();

        // Check if box is within the table
        const insideTable = (
            boxRect.left >= tableRect.left &&
            boxRect.right <= tableRect.right &&
            boxRect.top >= tableRect.top &&
            boxRect.bottom <= tableRect.bottom
        );

        console.log(`Box ${this.fileName} position check:`, {
            insideTable,
            boxPosition: { left: boxRect.left, top: boxRect.top },
            tableBounds: { left: tableRect.left, top: tableRect.top },
            ...this.state.getDebugInfo(),
            audioContextState: this.audioManager.getState(),
            timestamp: new Date().toISOString()
        });

        // Start or stop audio based on position
        if (insideTable) {
            if (!this.state.isPlaying) {
                console.log(`Starting audio for box ${this.fileName} - Current state:`, {
                    isPlaying: this.state.isPlaying,
                    audioContextState: this.audioManager.getState(),
                    timestamp: new Date().toISOString()
                });
                this.startAudio();
            }
        } else {
            if (this.state.isPlaying) {
                console.log(`Stopping audio for box ${this.fileName} - Current state:`, {
                    isPlaying: this.state.isPlaying,
                    audioContextState: this.audioManager.getState(),
                    timestamp: new Date().toISOString()
                });
                this.stopAudio();
            }
        }
    }

    async loadAudioLoop() {
        try {
            const response = await fetch(`/loops/${this.fileName}.m4a`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            console.log(`Audio file loaded, decoding for box ${this.fileName}`);

            // Decode the array buffer into an AudioBuffer
            this.audioBuffer = await this.audioManager.decodeAudioData(arrayBuffer);
            console.log(`Audio buffer decoded for box ${this.fileName}`);
        } catch (error) {
            console.error(`Error loading audio file for box ${this.fileName}:`, error);
        }
    }

    async startAudio() {
        if (this.state.isPlaying) {
            console.log(`Box ${this.fileName} is already playing`);
            return;
        }

        // Check if audio buffer is available
        if (!this.audioBuffer) {
            console.log(`Audio buffer not available for box ${this.fileName}, waiting for it to load...`);
            try {
                await this.loadAudioLoop();
                if (!this.audioBuffer) {
                    throw new Error('Failed to load audio buffer');
                }
            } catch (error) {
                console.warn(`Error waiting for audio buffer: ${error}`);
                return;
            }
        }

        try {
            await this.state.startAudio(this.audioBuffer);
            console.log(`Successfully started audio for box ${this.fileName}`);
        } catch (e) {
            console.error(`Error starting audio for box ${this.fileName}:`, e);
        }
    }

    stopAudio() {
        this.state.stopAudio();
    }

    updateFromServer({ newX, newY, effect, mixValue, volume, isExpanded }) {
        console.log('Received server update:', {
            newX, newY, effect, mixValue, volume, isExpanded,
            currentEffect: this.effectSelect.value,
            currentlyExpanded: this.element.classList.contains('expanded')
        });

        let needsSizeAdjustment = false;

        // Update position (if provided)
        if (newX !== undefined && newY !== undefined) {
            this.element.style.left = newX + 'px';
            this.element.style.top = newY + 'px';
            this.checkBoxPosition();
        }

        // Handle expansion state first
        if (isExpanded !== undefined) {
            const currentlyExpanded = this.element.classList.contains('expanded');
            if (currentlyExpanded !== isExpanded) {
                console.log('Updating expansion state:', { wasExpanded: currentlyExpanded, willBeExpanded: isExpanded });
                this.element.classList.toggle('expanded');
                const controlsContainer = this.element.querySelector('.controls-container');
                if (controlsContainer) {
                    controlsContainer.style.opacity = isExpanded ? '1' : '0';
                }
                needsSizeAdjustment = true;
            }
        }

        // Update effect (if provided)
        if (effect !== undefined && this.effectSelect) {
            // Only update if the effect has changed
            if (this.effectSelect.value !== effect) {
                this.effectSelect.value = effect;
                needsSizeAdjustment = true;

                if (effect !== 'none') {
                    const initializeEffect = async () => {
                        try {
                            if (!this.audioManager.isReady()) {
                                await this.audioManager.initialize();
                            }
                            this.state.cleanupEffect();
                            await this.state.setupEffect(effect, { [effect]: (audioCtx) => createEffect(effect, audioCtx) }, this.createParamSliders.bind(this), this.element);
                            
                            // Update control visibility after effect is initialized
                            if (this.state.effectInstance) {
                                const shouldShow = this.element.classList.contains('expanded');
                                if (this.paramContainer) {
                                    this.paramContainer.style.display = shouldShow ? 'block' : 'none';
                                    this.paramLabel.style.display = shouldShow ? 'block' : 'none';
                                }
                                if (this.mixLabel) {
                                    this.mixLabel.style.display = shouldShow ? 'block' : 'none';
                                    this.mixSlider.style.display = shouldShow ? 'block' : 'none';
                                }
                                // Force size adjustment after effect initialization
                                this.adjustBoxSize(effect);
                            }
                        } catch (error) {
                            console.error(`Failed to initialize effect ${effect}:`, error);
                        }
                    };

                    initializeEffect();
                } else {
                    this.state.cleanupEffect();
                    if (this.paramContainer) {
                        this.paramContainer.style.display = 'none';
                        this.paramLabel.style.display = 'none';
                    }
                    if (this.mixLabel) {
                        this.mixLabel.style.display = 'none';
                        this.mixSlider.style.display = 'none';
                    }
                }
            }
        }

        // Update mix value (if provided)
        if (mixValue !== undefined && this.mixSlider) {
            this.mixSlider.value = mixValue * 100;
            if (this.state.effectInstance) {
                const inputEvent = new Event('input');
                this.mixSlider.dispatchEvent(inputEvent);
            }
        }

        // Update volume (if provided)
        if (volume !== undefined && this.volumeSlider) {
            this.volumeSlider.value = volume * 100;
            const inputEvent = new Event('input');
            this.volumeSlider.dispatchEvent(inputEvent);
        }

        // Adjust box size if needed and not waiting for effect initialization
        if (needsSizeAdjustment && (!effect || effect === 'none')) {
            const currentEffect = this.effectSelect.value;
            const isCurrentlyExpanded = this.element.classList.contains('expanded');
            console.log('Adjusting box size after state update:', {
                effect: currentEffect,
                isExpanded: isCurrentlyExpanded,
                hasEffect: this.state.effectInstance !== null
            });
            this.adjustBoxSize(currentEffect);
        }
    }
} 