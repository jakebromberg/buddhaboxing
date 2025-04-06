import AudioEngine from './AudioEngine.js';
import { EffectController } from './EffectController.js';

class AudioPlayer {
    #audioBuffers = new Map();
    #audioManager;
    #source = null;
    #gainNode = null;
    #isInitialized = false;
    #fileName;
    #effectController;
    #isPlaying = false;

    constructor(audioManager, fileName) {
        this.#audioManager = audioManager;
        this.#fileName = fileName;
        this.#effectController = new EffectController(null, fileName, audioManager);
    }

    // AudioManager proxy methods
    #isReady() {
        return this.#audioManager.isReady();
    }

    async #initialize() {
        return this.#audioManager.initialize();
    }

    #getState() {
        return this.#audioManager.getState();
    }

    get isPlaying() {
        return this.#isPlaying;
    }

    getCurrentTime() {
        return this.#audioManager.getCurrentTime();
    }

    createGain() {
        return this.#audioManager.createGain();
    }

    createBufferSource() {
        return this.#audioManager.createBufferSource();
    }

    connect(node) {
        return this.#audioManager.connect(node);
    }

    getDestination() {
        return this.#audioManager.getDestination();
    }

    getAudioContext() {
        return this.#audioManager.getAudioContext();
    }

    onStateChange(callback) {
        return this.#audioManager.onStateChange(callback);
    }

    async loadAudioLoop() {
        try {
            // Check if we already have this buffer loaded
            if (this.#audioBuffers.has(this.#fileName)) {
                return;
            }

            const response = await fetch(`/loops/${this.#fileName}.m4a`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            console.log(`Audio file loaded, decoding for ${this.#fileName}`);

            // Decode the array buffer into an AudioBuffer
            const audioBuffer = await this.#audioManager.decodeAudioData(arrayBuffer);
            console.log(`Audio buffer decoded for ${this.#fileName}`);
            
            // Store the buffer
            this.#audioBuffers.set(this.#fileName, audioBuffer);
        } catch (error) {
            console.error(`Error loading audio file for ${this.#fileName}:`, error);
            throw error;
        }
    }

    async play() {
        console.log(`Attempting to play audio for ${this.#fileName}`, {
            isReady: this.#isReady(),
            state: this.#getState(),
            hasSource: !!this.#source,
            hasGainNode: !!this.#gainNode,
            hasBuffer: this.#audioBuffers.has(this.#fileName),
            isPlaying: this.#isPlaying
        });

        // If already playing, do nothing
        if (this.#isPlaying) {
            console.log(`Audio already playing for ${this.#fileName}`);
            return;
        }

        try {
            // Ensure audio context is ready
            if (!this.#isReady()) {
                console.log('Audio not ready, initializing...');
                await this.#initialize();
            }

            // Ensure we have the audio buffer loaded
            if (!this.#audioBuffers.has(this.#fileName)) {
                console.log('Loading audio buffer...');
                await this.loadAudioLoop();
            }

            // Create new source and gain nodes
            console.log('Creating new audio source...');
            this.#source = this.createBufferSource();
            this.#gainNode = this.createGain();
            this.#gainNode.gain.value = 1.0;
            
            // Get the audio buffer
            const audioBuffer = this.#audioBuffers.get(this.#fileName);
            if (!audioBuffer) {
                throw new Error(`No audio buffer found for ${this.#fileName}`);
            }

            // Set up the source
            this.#source.buffer = audioBuffer;
            this.#source.loop = true;
            
            // Connect nodes
            this.#source.connect(this.#gainNode);
            this.#gainNode.connect(this.getDestination());
            
            // Start playback
            console.log('Starting audio playback...');
            this.#source.start(0);
            this.#isPlaying = true;
            console.log(`Successfully started playback for ${this.#fileName}`);
        } catch (e) {
            console.error(`Error starting playback for ${this.#fileName}:`, e);
            this.#isPlaying = false;
            throw e;
        }
    }

    stop() {
        if (!this.#isPlaying) return;

        try {
            this.#effectController.stopAudio();
            if (this.#source) {
                this.#source.stop();
                this.#source = null;
            }
            if (this.#gainNode) {
                this.#gainNode.disconnect();
                this.#gainNode = null;
            }
            this.#isPlaying = false;
            console.log(`Successfully stopped playback for ${this.#fileName}`);
        } catch (error) {
            console.error(`Error stopping playback for ${this.#fileName}:`, error);
            throw error;
        }
    }

    setVolume(volume) {
        this.#effectController.setVolume(volume);
    }

    setMix(mixValue) {
        this.#effectController.applyMix(mixValue);
    }

    async setupEffect(effectName) {
        await this.#effectController.setupEffect(effectName);
    }

    cleanup() {
        this.stop();
        this.#audioBuffers.delete(this.#fileName);
        this.#effectController.cleanupEffect();
    }
}

// Export the AudioPlayer class as default
export default AudioPlayer; 