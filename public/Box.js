import AudioContextManager from './audioContextManager.js';
import { BoxState } from './boxState.js';
import { createEffect } from './nativeEffects.js';

export class Box {
  constructor(index, audioManager, isSafari, audioFiles) {
    this.index = index;
    this.audioManager = audioManager;
    this.isSafari = isSafari;
    this.audioFiles = audioFiles;
    this.isDragging = false;
    this.hasDragged = false;
    this.isPlaying = false;
    this.startX = 0;
    this.startY = 0;
    this.initialX = 0;
    this.initialY = 0;
    
    this.createBoxElement();
    this.setupEventListeners();
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
    
    // Add explicit transition styles
    this.element.style.transition = 'height 0.3s ease, opacity 0.3s ease';
    this.element.style.overflow = 'hidden';
    this.element.style.height = '40px';
    this.element.style.position = 'absolute';
    this.element.style.left = '10px';
    this.element.style.top = `${20 + this.index * 50}px`;
    this.element.style.width = '120px';
    
    // Store reference to this box
    this.element.boxId = this.index;
    
    // Create audio manager
    this.audioManager = new AudioContextManager();
    
    // Create box state manager
    this.state = new BoxState(this.element, this.index, this.audioManager);
    
    // Add box number
    const boxNumber = document.createElement('div');
    boxNumber.classList.add('box-number');
    boxNumber.textContent = (this.index + 1).toString().padStart(2, '0');
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
    
    // Drag event listeners
    this.element.addEventListener('mousedown', (e) => this.handleDragStart(e));
    document.addEventListener('mousemove', (e) => this.handleDragMove(e, debouncedCheckPosition));
    document.addEventListener('mouseup', () => this.handleDragEnd(debouncedCheckPosition));
    
    // Click handler
    this.element.addEventListener('click', (e) => this.handleBoxClick(e));
    
    // Slider event listeners
    this.mixSlider.addEventListener('mousedown', (e) => e.stopPropagation());
    this.volumeSlider.addEventListener('mousedown', (e) => e.stopPropagation());
    
    // Effect selection handler
    this.effectSelect.addEventListener('change', (e) => this.handleEffectChange(e));
    
    // Mix control
    this.mixSlider.addEventListener('input', (e) => this.handleMixChange(e));
    
    // Volume control
    this.volumeSlider.addEventListener('input', (e) => this.handleVolumeChange(e));
  }

  getBoxColor() {
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
    return boxColors[this.index];
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
    this.startX = e.clientX - this.element.offsetLeft;
    this.startY = e.clientY - this.element.offsetTop;
    this.initialX = this.element.offsetLeft;
    this.initialY = this.element.offsetTop;
    
    // Try to initialize audio context when dragging starts
    if (!this.audioManager.isReady()) {
      console.log('Audio context not ready, attempting initialization on drag');
      this.audioManager.initialize().catch(error => {
        console.warn('Audio initialization failed during drag:', error);
      });
    }
    
    this.updateBoxPosition();
  }

  handleDragMove(e, debouncedCheckPosition) {
    if (!this.isDragging) return;
    
    e.preventDefault();
    const newX = e.clientX - this.startX;
    const newY = e.clientY - this.startY;
    
    // Only mark as dragged if we've moved more than 5 pixels
    if (Math.abs(newX - this.initialX) > 5 || Math.abs(newY - this.initialY) > 5) {
      this.hasDragged = true;
      debouncedCheckPosition();
    }
    
    this.element.style.left = `${newX}px`;
    this.element.style.top = `${newY}px`;
  }

  handleDragEnd(debouncedCheckPosition) {
    if (this.isDragging) {
      this.isDragging = false;
      
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
      
      // Reset drag state immediately
      this.hasDragged = false;
    }
  }

  handleBoxClick(e) {
    // Don't handle click if we're dragging
    if (this.isDragging) {
      console.log('Box click ignored - currently dragging');
      return;
    }

    // Don't handle click if it was on a control element
    if (e.target === this.effectSelect || 
        e.target === this.mixSlider || 
        e.target === this.volumeSlider ||
        e.target.closest('select') || 
        e.target.closest('input')) {
      console.log('Box click ignored - control element clicked');
      return;
    }
    
    // Toggle expanded state
    const isExpanded = this.element.classList.contains('expanded');
    this.element.classList.toggle('expanded');
    
    // Log the current state of the box
    console.log('Box state before expansion:', {
      isExpanded: !isExpanded,
      currentHeight: this.element.style.height,
      hasExpandedClass: this.element.classList.contains('expanded'),
      computedHeight: window.getComputedStyle(this.element).height,
      controlsOpacity: this.element.querySelector('.controls-container')?.style.opacity
    });
    
    // Update controls visibility
    const controlsContainer = this.element.querySelector('.controls-container');
    if (controlsContainer) {
      controlsContainer.style.opacity = isExpanded ? '0' : '1';
      console.log('Controls container opacity updated:', {
        newOpacity: controlsContainer.style.opacity,
        isExpanded: !isExpanded
      });
    }
    
    // Adjust box size based on current effect
    const currentEffect = this.effectSelect ? this.effectSelect.value : 'none';
    this.adjustBoxSize(currentEffect);
    
    // Log the final state
    console.log('Box state after expansion:', {
      isExpanded: !isExpanded,
      newHeight: this.element.style.height,
      hasExpandedClass: this.element.classList.contains('expanded'),
      computedHeight: window.getComputedStyle(this.element).height,
      controlsOpacity: this.element.querySelector('.controls-container')?.style.opacity
    });
  }

  handleEffectChange(e) {
    const effectName = this.effectSelect.value;
    
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
      }
    } catch (error) {
      console.error(`Failed to create effect ${effectName}:`, error);
      // Reset to no effect on error
      this.effectSelect.value = 'none';
      this.element.classList.remove('expanded');
    }
  }

  handleMixChange(e) {
    const mixValue = this.mixSlider.value / 100;
    
    if (this.effectSelect.value !== 'none' && this.state.effectNode) {
      this.state.applyMix(mixValue);
    }
  }

  handleVolumeChange(e) {
    if (this.state.sourceNode) {
      const volume = this.volumeSlider.value / 100;
      this.state.setVolume(volume);
    }
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
      const label = document.createElement('div');
      label.classList.add('control-label');
      label.textContent = paramName.toUpperCase();
      this.paramContainer.appendChild(label);
      
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = param.min;
      slider.max = param.max;
      slider.value = param.default;
      slider.classList.add('param-control');
      
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
      
      this.paramContainer.appendChild(slider);
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
    
    console.log(`Box ${this.index + 1} position check:`, {
      insideTable,
      boxPosition: { left: boxRect.left, top: boxRect.top },
      tableBounds: { left: tableRect.left, top: tableRect.top },
      isPlaying: this.isPlaying,
      audioContextState: this.audioManager.getState(),
      hasEffectNode: !!this.state.effectNode,
      timestamp: new Date().toISOString()
    });
    
    // Start or stop audio based on position
    if (insideTable) {
      if (!this.isPlaying) {
        console.log(`Starting audio for box ${this.index + 1} - Current state:`, {
          isPlaying: this.isPlaying,
          audioContextState: this.audioManager.getState(),
          timestamp: new Date().toISOString()
        });
        this.startAudio();
      }
    } else {
      if (this.isPlaying) {
        console.log(`Stopping audio for box ${this.index + 1} - Current state:`, {
          isPlaying: this.isPlaying,
          audioContextState: this.audioManager.getState(),
          timestamp: new Date().toISOString()
        });
        this.stopAudio();
      }
    }
  }

  async startAudio() {
    if (this.isPlaying) {
      console.log(`Box ${this.index + 1} is already playing`);
      return;
    }

    // Check if audio buffer is available
    if (!window.audioBuffers || !window.audioBuffers[this.index]) {
      console.log(`Audio buffer not available for box ${this.index + 1}, waiting for it to load...`);
      try {
        // Wait for the audio buffer to be loaded
        while (!window.audioBuffers || !window.audioBuffers[this.index]) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log(`Audio buffer loaded for box ${this.index + 1}`);
      } catch (error) {
        console.warn(`Error waiting for audio buffer: ${error}`);
        return;
      }
    }

    if (!this.audioManager.isReady()) {
      try {
        await this.audioManager.initialize();
        this.startAudioPlayback();
      } catch (e) {
        console.warn('Failed to initialize audio context:', e);
      }
    } else if (this.isSafari && this.audioManager.getState() === 'suspended') {
      try {
        await this.audioManager.safariAudioUnlock();
        await this.audioManager.resume();
        this.startAudioPlayback();
      } catch (e) {
        console.warn('Failed to unlock audio after drag:', e);
      }
    } else {
      this.startAudioPlayback();
    }
  }

  stopAudio() {
    this.isPlaying = false;
    this.element.isPlaying = false;
    
    if (this.audioManager.isReady() && this.state.gainNode) {
      this.state.gainNode.gain.cancelScheduledValues(this.audioManager.getCurrentTime());
      this.state.gainNode.gain.setValueAtTime(this.state.gainNode.gain.value, this.audioManager.getCurrentTime());
      this.state.gainNode.gain.linearRampToValueAtTime(0, this.audioManager.getCurrentTime() + 0.5);

      setTimeout(() => {
        this.state.cleanup();
      }, 600);
    } else {
      const tempAudio = window.tempAudioElements[this.index];
      if (tempAudio) {
        tempAudio.pause();
        tempAudio.currentTime = 0;
      }
    }
  }

  async startAudioPlayback() {
    try {
      // If already playing, don't start again
      if (this.state.isPlaying) {
        console.log(`Box ${this.index + 1} is already playing`);
        return;
      }
      
      console.log(`Starting audio playback for box ${this.index + 1}`);
      
      // Ensure audio context is initialized
      console.log('Initializing audio context...');
      await this.audioManager.initialize();
      
      if (!this.audioManager.isReady()) {
        console.error('Audio context not ready after initialization');
        throw new Error('Audio context not ready');
      }
      
      // Check if we have an audio buffer
      if (!window.audioBuffers || !window.audioBuffers[this.index]) {
        console.error(`No audio buffer available for box ${this.index + 1}`);
        throw new Error('No audio buffer available');
      }
      
      console.log('Creating audio nodes...');
      // Create audio nodes
      this.state.gainNode = this.audioManager.createGain();
      this.state.dryNode = this.audioManager.createGain();
      this.state.wetNode = this.audioManager.createGain();
      this.state.mixerNode = this.audioManager.createGain();
      
      // Initialize gain values
      this.state.gainNode.gain.value = 0;
      this.state.dryNode.gain.value = 1;
      this.state.wetNode.gain.value = 0;
      
      console.log('Setting up audio routing...');
      // Set up initial routing
      this.state.setupAudioRouting();
      
      console.log('Creating source node...');
      // Create source node
      this.state.sourceNode = this.audioManager.createBufferSource();
      this.state.sourceNode.buffer = window.audioBuffers[this.index];
      this.state.sourceNode.loop = true;
      
      console.log('Connecting source to gain...');
      // Connect source to gain
      this.state.sourceNode.connect(this.state.gainNode);
      
      console.log('Starting playback...');
      // Start playback
      this.state.sourceNode.start(0);
      this.state.isPlaying = true;
      
      console.log('Setting up fade in...');
      // Fade in
      this.state.gainNode.gain.setValueAtTime(0, this.audioManager.getCurrentTime());
      this.state.gainNode.gain.linearRampToValueAtTime(1, this.audioManager.getCurrentTime() + 0.5);
      
      console.log(`Successfully started audio for box ${this.index + 1}`);
    } catch (e) {
      console.error(`Error starting audio for box ${this.index + 1}:`, e);
      throw e;
    }
  }

  async loadSingleAudioFile(url, index) {
    try {
      console.log(`Loading audio file: ${url} for box ${index + 1}`);
      const response = await fetch(`/loops/${url}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log(`Audio file loaded, decoding for box ${index + 1}`);
      
      // Create a temporary audio element for immediate playback
      const tempAudio = new Audio();
      tempAudio.src = URL.createObjectURL(new Blob([arrayBuffer]));
      
      window.tempAudioElements = window.tempAudioElements || {};
      window.tempAudioElements[index] = tempAudio;
      
      window.audioLoadStatus[index] = 'basic-ready';
      
      // Decode the array buffer into an AudioBuffer
      const audioBuffer = await this.audioManager.decodeAudioData(arrayBuffer);
      console.log(`Audio buffer decoded for box ${index + 1}`);
      
      // Store the audio buffer
      this.audioBuffer = audioBuffer;
      window.audioBuffers = window.audioBuffers || {};
      window.audioBuffers[index] = audioBuffer;
      
      const box = this.element;
      if (this.isBoxInsideTable(box)) {
        tempAudio.loop = true;
        tempAudio.volume = box.volumeSlider ? box.volumeSlider.value / 100 : 1;
        try {
          await tempAudio.play();
        } catch (e) {
          console.warn(`Could not start immediate playback for box ${index + 1}:`, e);
        }
      }
    } catch (error) {
      console.error(`Error loading audio file ${url}:`, error);
      window.audioLoadStatus[index] = 'error';
      throw error;
    }
  }

  updateFromServer({ newX, newY, effect, mixValue, volume }) {
    // Update position (if provided)
    if (newX !== undefined && newY !== undefined) {
      this.element.style.left = newX + 'px';
      this.element.style.top = newY + 'px';
      
      // Check if inside table and play/stop audio
      this.checkBoxPosition();
    }
    
    // Update effect (if provided)
    if (effect !== undefined && this.effectSelect) {
      this.effectSelect.value = effect;
      
      // Trigger the change event to apply the effect
      const changeEvent = new Event('change');
      this.effectSelect.dispatchEvent(changeEvent);
    }
    
    // Update mix value (if provided)
    if (mixValue !== undefined && this.mixSlider) {
      this.mixSlider.value = mixValue * 100;
      
      // Trigger the input event to apply the mix
      const inputEvent = new Event('input');
      this.mixSlider.dispatchEvent(inputEvent);
    }
    
    // Update volume (if provided)
    if (volume !== undefined && this.volumeSlider) {
      this.volumeSlider.value = volume * 100;
      
      // Trigger the input event to apply the volume
      const inputEvent = new Event('input');
      this.volumeSlider.dispatchEvent(inputEvent);
    }
  }

  updateAudioContext() {
    console.log('Updating box audio context');
    if (this.audioManager.isReady()) {
      // Reinitialize audio nodes if needed
      if (this.state) {
        this.state.cleanup();
        this.state.setupEffect(this.effectSelect.value);
      }
    }
  }
} 