import AudioContextManager from './audioContextManager.js';
import { BoxState } from './boxState.js';
import { nativeEffects } from './nativeEffects.js';

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
    
    // Store reference to this box
    this.element.boxId = this.index;
    
    // Create box state manager
    this.state = new BoxState(this.element, this.index);
    
    // Add box number
    const boxNumber = document.createElement('div');
    boxNumber.classList.add('box-number');
    boxNumber.textContent = (this.index + 1).toString().padStart(2, '0');
    this.element.appendChild(boxNumber);

    // Create controls container
    this.createControlsContainer();
    
    // Position box
    this.element.style.position = 'absolute';
    this.element.style.left = '10px';
    this.element.style.top = `${20 + this.index * 50}px`;
    this.element.style.width = '120px';
    this.element.style.height = '40px';
    
    // Add box to body
    document.body.appendChild(this.element);
  }

  createControlsContainer() {
    const controlsContainer = document.createElement('div');
    controlsContainer.classList.add('controls-container');
    controlsContainer.style.opacity = '0';
    controlsContainer.style.transition = 'opacity 0.3s ease';
    this.element.appendChild(controlsContainer);

    // Add effect selector
    const effectLabel = document.createElement('div');
    effectLabel.classList.add('control-label');
    effectLabel.textContent = 'EFFECT';
    controlsContainer.appendChild(effectLabel);
    
    this.effectSelect = document.createElement('select');
    this.effectSelect.classList.add('effect-select');
    this.element.effectSelect = this.effectSelect;
    
    // Add effect options
    Object.keys(nativeEffects).forEach(effectName => {
      const option = document.createElement('option');
      option.value = effectName;
      option.textContent = effectName.charAt(0).toUpperCase() + effectName.slice(1);
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
    
    this.updateBoxPosition();
  }

  handleDragMove(e, debouncedCheckPosition) {
    if (!this.isDragging) return;
    
    e.preventDefault();
    const newX = e.clientX - this.startX;
    const newY = e.clientY - this.startY;
    
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
      debouncedCheckPosition();
      
      if (this.isBoxInsideTable(this.element)) {
        this.startAudio();
      } else {
        this.stopAudio();
      }
      
      if (this.hasDragged) {
        this.element.classList.remove('expanded');
        const controlsContainer = this.element.querySelector('.controls-container');
        controlsContainer.style.opacity = '0';
        this.element.style.height = '40px';
      }
      
      setTimeout(() => {
        this.hasDragged = false;
      }, 300);
    }
  }

  handleBoxClick(e) {
    if (this.isDragging || this.hasDragged) {
      return;
    }

    if (this.effectSelect === e.target || this.mixSlider === e.target || this.volumeSlider === e.target) {
      return;
    }
    
    const isExpanded = this.element.classList.contains('expanded');
    this.element.classList.toggle('expanded');
    
    const controlsContainer = this.element.querySelector('.controls-container');
    controlsContainer.style.opacity = !isExpanded ? '1' : '0';
    
    this.adjustBoxSize(this.effectSelect.value);
  }

  handleEffectChange(e) {
    const effectName = this.effectSelect.value;
    
    this.state.cleanupEffect();
    this.state.setupEffect(effectName, nativeEffects, this.createParamSliders.bind(this));
    
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
    const boxParamContainer = box.paramContainer;
    boxParamContainer.innerHTML = '';
    
    const effect = nativeEffects[effectName];
    if (!effect || !effect.params) {
      return 0;
    }
    
    const paramEntries = Object.entries(effect.params);
    const paramCount = paramEntries.length;
    
    paramEntries.forEach(([paramName, paramConfig]) => {
      const paramSlider = document.createElement('div');
      paramSlider.classList.add('param-slider');
      paramSlider.style.margin = '5px 0';
      paramSlider.style.padding = '0';
      paramSlider.style.border = 'none';
      paramSlider.style.background = 'none';
      
      const label = document.createElement('div');
      label.classList.add('control-label');
      label.textContent = paramName.toUpperCase();
      label.style.marginBottom = '2px';
      paramSlider.appendChild(label);
      
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = paramConfig.min;
      slider.max = paramConfig.max;
      slider.step = (paramConfig.max - paramConfig.min) / 100;
      slider.value = paramConfig.default;
      slider.classList.add('param-control');
      slider.style.width = '100%';
      slider.style.margin = '0';
      paramSlider.appendChild(slider);
      
      const valueDisplay = document.createElement('span');
      valueDisplay.classList.add('value');
      valueDisplay.textContent = paramConfig.default.toFixed(2);
      valueDisplay.style.marginLeft = '5px';
      paramSlider.appendChild(valueDisplay);
      
      slider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        valueDisplay.textContent = value.toFixed(2);
        
        if (box.effectNode && paramConfig.callback) {
          paramConfig.callback(box.effectNode, value);
        }
      });
      
      boxParamContainer.appendChild(paramSlider);
    });
    
    return paramCount;
  }

  adjustBoxSize(effectName) {
    const paramCount = this.createParamSliders(this.element, effectName);
    const baseHeight = 180;
    
    if (paramCount > 0 && effectName !== 'none') {
      this.paramLabel.style.display = 'block';
      this.paramContainer.style.display = 'block';
      this.mixLabel.style.display = 'block';
      this.mixSlider.style.display = 'block';
      
      const paramHeight = 60;
      const newHeight = baseHeight + ((paramCount + 1) * paramHeight);
      
      this.element.style.transition = 'height 0.3s ease';
      
      if (this.element.classList.contains('expanded')) {
        this.element.style.height = `${newHeight}px`;
      } else {
        this.element.style.height = '40px';
      }
    } else {
      this.paramLabel.style.display = 'none';
      this.paramContainer.style.display = 'none';
      this.mixLabel.style.display = effectName !== 'none' ? 'block' : 'none';
      this.mixSlider.style.display = effectName !== 'none' ? 'block' : 'none';
      
      if (this.element.classList.contains('expanded')) {
        const mixHeight = effectName !== 'none' ? 60 : 0;
        this.element.style.height = `${baseHeight + mixHeight}px`;
      } else {
        this.element.style.height = '40px';
      }
    }
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
    if (this.isBoxInsideTable(this.element)) {
      this.startAudio();
    } else {
      this.stopAudio();
    }
  }

  async startAudio() {
    if (this.isPlaying) return;

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
    const delayMs = this.isSafari ? 300 : 50;
    
    setTimeout(async () => {
      const hasBasicAudio = window.tempAudioElements && window.tempAudioElements[this.index];
      const hasFullAudio = window.audioBuffers && window.audioBuffers[this.index];
      
      if (!hasBasicAudio && !hasFullAudio) {
        console.error(`No audio available for box ${this.index + 1}`);
        this.element.style.border = '2px solid red';
        this.element.style.backgroundColor = '#ffebee';
        
        if (!this.element.querySelector('.reload-btn')) {
          const reloadBtn = document.createElement('button');
          reloadBtn.className = 'reload-btn';
          reloadBtn.textContent = '↻';
          reloadBtn.onclick = (e) => {
            e.stopPropagation();
            this.loadSingleAudioFile(this.audioFiles[this.index], this.index);
          };
          this.element.appendChild(reloadBtn);
        }
        return;
      }
      
      this.element.style.border = '';
      const reloadBtn = this.element.querySelector('.reload-btn');
      if (reloadBtn) this.element.removeChild(reloadBtn);
      
      if (hasFullAudio) {
        if (!this.state.sourceNode) {
          try {
            this.state.sourceNode = this.audioManager.createNode('BufferSource');
            this.state.sourceNode.buffer = window.audioBuffers[this.index];
            this.state.sourceNode.loop = true;
            this.state.sourceNode.playbackRate.value = 1.0;
            this.state.sourceNode.connect(this.state.gainNode);
            
            if (this.effectSelect.value !== 'none') {
              this.state.effectNode = this.state.cleanupEffect(this.state.effectNode, this.state.gainNode, this.state.dryNode);
              this.state.setupAudioRouting();
              this.state.effectNode = this.state.setupEffect(this.effectSelect.value, this.state.gainNode, this.state.wetNode, this.element);
              const mixValue = this.mixSlider.value / 100;
              this.state.applyMix(mixValue);
            }

            const volume = this.volumeSlider.value / 100;
            this.state.gainNode.gain.setValueAtTime(volume, this.audioManager.getCurrentTime());
            
            this.state.sourceNode.start(0);
            this.isPlaying = true;
            this.element.isPlaying = true;
          } catch (e) {
            console.error(`Error starting audio for box ${this.index + 1}:`, e);
            this.isPlaying = false;
            this.element.isPlaying = false;
          }
        }
      } else if (hasBasicAudio) {
        const tempAudio = window.tempAudioElements[this.index];
        if (tempAudio) {
          tempAudio.currentTime = 0;
          try {
            await tempAudio.play();
            this.isPlaying = true;
            this.element.isPlaying = true;
          } catch (e) {
            console.error(`Error starting basic audio for box ${this.index + 1}:`, e);
            this.isPlaying = false;
            this.element.isPlaying = false;
          }
        }
      }
    }, delayMs);
  }

  async loadSingleAudioFile(url, index) {
    try {
      const response = await fetch(`/loops/${url}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Create a temporary audio element for immediate playback
      const tempAudio = new Audio();
      tempAudio.src = URL.createObjectURL(new Blob([arrayBuffer]));
      
      window.tempAudioElements = window.tempAudioElements || {};
      window.tempAudioElements[index] = tempAudio;
      
      window.audioLoadStatus[index] = 'basic-ready';
      
      // Decode the array buffer into an AudioBuffer
      const audioBuffer = await this.audioManager.decodeAudioData(arrayBuffer);
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
} 