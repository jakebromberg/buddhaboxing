import AudioEngine from './AudioEngine.js';
import AudioPlayer from './AudioPlayer.js';

export class Box {
    static debugMode = false;
    static debugListenerAdded = false;

    constructor(fileName, audioPlayer, onBoxUpdate, order, audioEngine) {
        this.fileName = fileName;
        this.audioPlayer = audioPlayer;
        this.sendBoxUpdate = onBoxUpdate;
        this.order = order;
        this.audioEngine = audioEngine;
        this.isDragging = false;
        this.hasDragged = false;
        this.startX = 0;
        this.startY = 0;
        this.initialX = 0;
        this.initialY = 0;
        this.debugMode = false;
        this.source = null;
        this.gainNode = null;
        this.element = null;
        this.effectSelect = null;
        this.mixSlider = null;
        this.volumeSlider = null;
        this.createBoxElement();
        this.setupEventListeners();
        this.setupDebugModeListener();
    }

    createBoxElement() {
        // Remove any existing box with the same ID
        const existingBox = document.querySelector(`.box[boxId="${this.fileName}"]`);
        if (existingBox) {
            existingBox.remove();
        }

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
        this.element.setAttribute('boxId', this.fileName);

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
        // Only add the listener once
        if (!Box.debugListenerAdded) {
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
                    Box.debugMode = !Box.debugMode;
                    console.log('Debug mode:', Box.debugMode ? 'enabled' : 'disabled');
                }
            });
            Box.debugListenerAdded = true;
        }
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
                // Use only the debounced version
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

    async handleEffectChange(e) {
        const effectName = e.target.value;
        const currentX = this.element.style.left;
        const currentY = this.element.style.top;

        console.log('Effect change started:', {
            effectName,
            isExpanded: this.element.classList.contains('expanded'),
            currentHeight: this.element.style.height
        });

        try {
            // First update the UI to show loading state
            if (effectName !== 'none') {
                console.log('Adding expanded class and showing controls');
                this.element.classList.add('expanded');
                const controlsContainer = this.element.querySelector('.controls-container');
                controlsContainer.style.opacity = '1';

                // Setup the effect only if it's not 'none'
                console.log('Setting up effect:', effectName);
                await this.audioPlayer.setupEffect(effectName);

                // Wait a small amount of time to ensure effect is fully initialized
                console.log('Waiting for effect initialization...');
                await new Promise(resolve => setTimeout(resolve, 50));

                // Now update the UI with the effect parameters
                console.log('Adjusting box size for effect:', effectName);
                this.adjustBoxSize(effectName);

                if (this.paramContainer) {
                    console.log('Setting up parameter controls');
                    this.paramContainer.style.display = 'block';
                    this.paramLabel.style.display = 'block';
                    // Create parameter sliders for the selected effect
                    this.createParamSliders(this.element, effectName);
                }
                if (this.mixLabel) {
                    console.log('Setting up mix controls');
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
                // Handle 'none' effect case
                console.log('Handling none effect case');
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

                // Send update for 'none' effect
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
            console.error(`Failed to setup effect ${effectName}:`, error);
            // Reset to no effect on error
            this.effectSelect.value = 'none';
            this.element.classList.remove('expanded');
            const controlsContainer = this.element.querySelector('.controls-container');
            controlsContainer.style.opacity = '0';
            this.element.style.height = '40px';
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
            this.audioPlayer.setMix(mixValue);
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

        this.audioPlayer.setVolume(volume);
    }

    createParamSliders(box, effectName) {
        if (!this.paramContainer) return;

        // Clear existing sliders
        this.paramContainer.innerHTML = '';

        // Get effect parameters from the effect instance through the EffectController
        const effectController = this.audioPlayer.effectController;
        if (!effectController || !effectController.effectInstance) {
            console.error(`Effect instance not initialized: ${effectName}`);
            return;
        }

        const params = effectController.effectInstance.getParams();
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
            // Make all sliders continuous by default, except for bitcrusher's bits parameter
            slider.step = (effectName === 'bitcrusher' && paramName === 'bits') ? 1 : 0.001;
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
                if (effectController.effectInstance) {
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

        // Get the effect instance through the effectController
        const effectController = this.audioPlayer.effectController;
        if (!effectController) {
            console.error('Effect controller not available');
            return;
        }

        const effectInstance = effectController.effectInstance;
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

    checkBoxPosition() {
        const table = document.getElementById('table');
        if (!table) {
            console.error('Table element not found');
            return;
        }

        const tableRect = table.getBoundingClientRect();
        const boxRect = this.element.getBoundingClientRect();

        console.log('Position check:', {
            tableRect,
            boxRect,
            boxId: this.fileName,
            isPlaying: this.audioPlayer.isPlaying
        });

        // Check if box is within the table
        const insideTable = (
            boxRect.left >= tableRect.left &&
            boxRect.right <= tableRect.right &&
            boxRect.top >= tableRect.top &&
            boxRect.bottom <= tableRect.bottom
        );

        console.log('Box position check result:', {
            insideTable,
            boxId: this.fileName,
            isPlaying: this.audioPlayer.isPlaying
        });

        // Start or stop audio based on position
        if (insideTable) {
            console.log(`Box ${this.fileName} is inside table, starting audio...`);
            this.startAudio();
        } else {
            console.log(`Box ${this.fileName} is outside table, stopping audio...`);
            this.stop();
        }

        // Send update with current position and expanded state
        if (this.sendBoxUpdate) {
            this.sendBoxUpdate({
                newX: parseInt(this.element.style.left),
                newY: parseInt(this.element.style.top),
                effect: this.effectSelect.value,
                mixValue: this.mixSlider.value / 100,
                volume: this.volumeSlider.value / 100,
                isExpanded: this.element.classList.contains('expanded')
            });
        }
    }

    async startAudio() {
        try {
            console.log(`Starting audio for box ${this.fileName}...`);
            await this.audioPlayer.play();
            console.log(`Successfully started audio for box ${this.fileName}`);
        } catch (e) {
            console.error(`Error starting audio for box ${this.fileName}:`, e);
        }
    }

    stop() {
        if (!this.audioPlayer.isPlaying) {
            return;
        }

        try {
            this.audioPlayer.stop();
            console.log(`Stopped playback for ${this.fileName}`);
        } catch (error) {
            console.error(`Error stopping playback for ${this.fileName}:`, error);
            throw error;
        }
    }

    async updateFromServer({ newX, newY, effect, mixValue, volume, isExpanded }) {
        this.element.style.left = `${newX}px`;
        this.element.style.top = `${newY}px`;

        // Only update effect if it's different from current value
        if (this.effectSelect.value !== effect) {
            this.effectSelect.value = effect;
            // Don't call handleEffectChange here as it will trigger another update
            // Just update the UI state directly
            this.element.classList.toggle('expanded', isExpanded);
            
            // Initialize the effect before adjusting box size
            try {
                await this.audioPlayer.setupEffect(effect);
                this.adjustBoxSize(effect);
            } catch (error) {
                console.error(`Failed to setup effect ${effect}:`, error);
                // If effect setup fails, just set to none
                this.effectSelect.value = 'none';
                this.adjustBoxSize('none');
            }
        }

        this.mixSlider.value = mixValue * 100;
        this.handleMixChange({ target: this.mixSlider });

        this.handleVolumeChange({ target: this.volumeSlider });
        this.volumeSlider.value = volume * 100;

        // Only handle click if expansion state changed
        if (this.element.classList.contains('expanded') !== isExpanded) {
            this.handleBoxClick({ target: this.element });
        }

        // Check box position after updating position
        this.checkBoxPosition();
    }
}