/***********************************************
 * 1) Session & Socket Setup
 ***********************************************/

// For simplicity, just hard-code or generate a sessionId.
// In a real app, you might parse the URL or prompt the user.
const sessionId = "my-test-session";

// Connect to Socket.IO (same host/port as your server)
const socket = io();

// Join the specified session/room on the server
socket.emit('joinSession', sessionId);

// The server can send us the current session state on connect
socket.on('initialState', (data) => {
  console.log('Got initial state from server:', data);

  // If the server is already tracking a box position/volume,
  // you could apply it here. E.g.:
  // if (data.box) {
  //   box.style.left = data.box.x + 'px';
  //   box.style.top = data.box.y + 'px';
  // }
});

// Example function for notifying the server about a box move
function handleBoxDrag(boxId, newX, newY) {
  socket.emit('updateBox', { sessionId, boxId, newX, newY });
}

// Receive box updates from other players
socket.on('boxUpdated', ({ boxId, newX, newY }) => {
  // In a multi-box scenario, you’d find the correct DOM element.
  // Here, we just assume one box. Move it to newX/newY.
  box.style.left = newX + 'px';
  box.style.top = newY + 'px';
});

// Similarly, for volume changes
function handleVolumeChange(boxId, volume) {
  socket.emit('changeVolume', { sessionId, boxId, volume });
}

socket.on('volumeChanged', ({ boxId, volume }) => {
  // Update your local audio volume for that box.
  // (We only have one box in this demo, so just set the gain.)
  gainNode.gain.value = volume;
});

/***********************************************
 * 2) Audio Setup
 ***********************************************/

// Create AudioContext
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Preload/Decode Audio
let audioBuffer = null;
fetch('buddha machine01.m4a')
  .then(response => response.arrayBuffer())
  .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
  .then(decodedData => {
    audioBuffer = decodedData;
  });

// Setup audio nodes for our single box
let sourceNode = null;
const gainNode = audioCtx.createGain();
gainNode.gain.value = 0; // start muted
gainNode.connect(audioCtx.destination);

function startAudio() {
  audioCtx.resume().then(() => {
    if (!sourceNode) {
      sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.loop = true;
      sourceNode.playbackRate.value = 1.0;
      sourceNode.connect(gainNode);

      sourceNode.start(0);
    }
    // Fade in
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 0.5);
  });
}

function stopAudio() {
  // Fade out
  gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
  gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);

  // Stop source after fade
  setTimeout(() => {
    if (sourceNode) {
      sourceNode.stop();
      sourceNode.disconnect();
      sourceNode = null;
    }
  }, 600); // slightly more than 0.5s
}

/***********************************************
 * 3) DOM and Drag/Drop Logic
 ***********************************************/

// Create the table + box in the DOM
const table = document.getElementById('table');
const box = document.createElement('div');
box.classList.add('box');
table.appendChild(box);

let isDragging = false;
let offsetX, offsetY;

// For a simple demo, let's define a unique ID for this box
// If you had multiple boxes, you'd generate or store them in an array
const BOX_ID = 1;

box.addEventListener('pointerdown', (e) => {
  isDragging = true;
  offsetX = e.clientX - box.offsetLeft;
  offsetY = e.clientY - box.offsetTop;
  box.setPointerCapture(e.pointerId);
});

box.addEventListener('pointermove', (e) => {
  if (!isDragging) return;

  // Move the box locally
  const newX = e.clientX - offsetX;
  const newY = e.clientY - offsetY;
  box.style.left = newX + 'px';
  box.style.top = newY + 'px';

  // Also notify the server so other clients see the move
  handleBoxDrag(BOX_ID, newX, newY);
});

box.addEventListener('pointerup', (e) => {
  isDragging = false;
  box.releasePointerCapture(e.pointerId);

  // Check if box is within the table boundaries
  const tableRect = table.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();

  const insideTable = (
    boxRect.left >= tableRect.left &&
    boxRect.right <= tableRect.right &&
    boxRect.top >= tableRect.top &&
    boxRect.bottom <= tableRect.bottom
  );

  if (insideTable) {
    startAudio();
  } else {
    stopAudio();
  }
});
