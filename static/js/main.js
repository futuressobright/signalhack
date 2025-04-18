// Audio state management
let currentAudioUrl = null;

// Karen face emojis
const karenFaces = {
    angry: '😠',
    happy: '😊',
    crazy: '🤪'
};

// DOM elements - we'll initialize these after the document loads
let moodSelect;
let callButton;
let hangupButton;
let karenFace;
let recordingStatus;
let visualizer;
let rageLevel;

// Initialize DOM elements
function initializeDOMElements() {
    moodSelect = document.getElementById('moodSelect');
    callButton = document.getElementById('callButton');
    hangupButton = document.getElementById('hangupButton');
    karenFace = document.getElementById('karenFace');
    recordingStatus = document.getElementById('recordingStatus');
    visualizer = document.getElementById('audio-visualizer');
    rageLevel = document.getElementById('rage-level');
    
    // Update Karen's face when mood changes
    if (moodSelect) {
        moodSelect.addEventListener('change', () => {
            if (karenFace) {
                karenFace.textContent = karenFaces[moodSelect.value];
            }
        });
    }
    
    // Start/stop call
    if (callButton) {
        callButton.addEventListener('click', async () => {
            if (!callInProgress) {
                startCall();
            }
        });
    }
    
    if (hangupButton) {
        hangupButton.addEventListener('click', () => {
            // Immediately disable buttons to prevent multiple clicks
            hangupButton.disabled = true;
            callButton.disabled = true;
            
            // Force cleanup first
            forceCleanup();
            
            // Then end the call properly
            endCall();
        });
    }
}

// Initialize everything after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...');
    initializeDOMElements();
    initializeVisualizer();
    
    // Set initial Karen face
    if (karenFace && moodSelect) {
        karenFace.textContent = karenFaces[moodSelect.value];
    }
    
    // Log initialization status
    console.log('Initialization complete. DOM elements:', {
        moodSelect: !!moodSelect,
        callButton: !!callButton,
        hangupButton: !!hangupButton,
        karenFace: !!karenFace,
        visualizer: !!visualizer,
        visualizerCtx: !!visualizerCtx
    });
});

// Audio context for visualizer
let audioContext = null;
let analyser = null;
let dataArray = null;
let visualizerCtx;

// Initialize visualizer if available
function initializeVisualizer() {
    const visualizer = document.getElementById('audio-visualizer');
    if (visualizer) {
        visualizerCtx = visualizer.getContext('2d');
        // Set canvas size
        function resizeCanvas() {
            visualizer.width = visualizer.offsetWidth;
            visualizer.height = visualizer.offsetHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }
}

// Initialize after DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeVisualizer);

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let currentAudio = null;
let callInProgress = false;

// Speech recognition setup
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = false;
recognition.interimResults = false;

let lastUserResponse = '';

// Update Karen's face when mood changes
moodSelect.addEventListener('change', () => {
    const mood = moodSelect.value;
    karenFace.textContent = karenFaces[mood];
    updateRageLevel(mood);
});

// Update rage level based on mood
function updateRageLevel(mood) {
    const levels = {
        angry: 9,
        happy: 3,
        crazy: 7
    };
    rageLevel.textContent = levels[mood];
    document.querySelector('.rage-fill').style.width = `${(levels[mood] / 10) * 100}%`;
}

// Start/stop call
callButton.addEventListener('click', async () => {
    if (!callInProgress) {
        startCall();
    }
});

hangupButton.addEventListener('click', () => {
    // Immediately disable buttons to prevent multiple clicks
    hangupButton.disabled = true;
    callButton.disabled = true;
    
    // Force cleanup first
    forceCleanup();
    
    // Then end the call properly
    endCall();
});

async function startCall() {
    if (callInProgress) return;
    
    try {
        // Update button states first
        callButton.disabled = true;
        hangupButton.disabled = false;
        moodSelect.disabled = true;
        recordingStatus.textContent = 'Getting Karen\'s response...';

        // Initialize audio context if needed
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Always create fresh nodes
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        analyser.smoothingTimeConstant = 0.85;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        // Now set call in progress
        callInProgress = true;
        
        // Clear last response if this is a new call
        if (!lastUserResponse) {
            console.log('Starting new call');
        } else {
            console.log('Continuing conversation, last response:', lastUserResponse);
        }
        // Get selected mood
        const mood = moodSelect.value;
        updateRageMeter(mood);

        // Set up audio context and analyser for visualization
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Always create a fresh analyser node
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512; // Increased for more detail
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        analyser.smoothingTimeConstant = 0.85;
        
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Get Karen's response
        const response = await fetch('/get-karen-response', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mood: mood,
                isIntro: !lastUserResponse, // Only true for first response
                lastUserResponse: lastUserResponse || ''
            })
        });
        
        if (!response.ok) throw new Error('Failed to get Karen\'s response');
        
        // Get the audio blob
        const audioBlob = await response.blob();
        
        // Set up audio with all event listeners first
        currentAudio = new Audio();
        currentAudio.preload = 'auto';
        
        // Set up all event listeners before setting src
        currentAudio.addEventListener('ended', () => {
            console.log('Audio ended naturally');
            karenFace.classList.remove('talking');
            startRecording(); // Start recording when Karen finishes
        });

        currentAudio.addEventListener('error', (e) => {
            console.error('Audio playback error:', e);
            endCall();
        });

        currentAudio.addEventListener('playing', () => {
            console.log('Audio started playing');
            karenFace.classList.add('talking');
        });

        // Create and set audio source
        if (currentAudioUrl) {
            URL.revokeObjectURL(currentAudioUrl);
        }
        currentAudioUrl = URL.createObjectURL(audioBlob);
        currentAudio.src = currentAudioUrl;
        
        // Connect to audio context
        const source = audioContext.createMediaElementSource(currentAudio);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        
        // Start visualization before playing
        startVisualization();
        
        // Finally start playback
        try {
            await currentAudio.play();
            console.log('Playback started successfully');
        } catch (error) {
            console.error('Playback failed:', error);
            endCall();
            return;
        }
        

        
        // Log audio connection status
        console.log('Audio setup complete:', {
            audioContext: audioContext.state,
            analyser: !!analyser,
            dataArray: dataArray.length,
            source: !!source
        });
        
    } catch (error) {
        console.error('Error starting call:', error);
        recordingStatus.textContent = 'Error starting call: ' + error.message;
        endCall();
    }
}

async function startRecording() {
    console.log('Starting recording...');
    recordingStatus.textContent = 'Recording your response...';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Create new MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = []; // Reset chunks
        
        // Set up event handlers
        mediaRecorder.ondataavailable = (e) => {
            console.log('Got audio chunk');
            audioChunks.push(e.data);
        };
        
        mediaRecorder.onstop = async () => {
            console.log('Recording stopped, processing...');
            recordingStatus.textContent = 'Processing your response...';
            
            try {
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
                
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                
                // Send recording to server
                const formData = new FormData();
                formData.append('audio', audioBlob);
                formData.append('mood', moodSelect.value);
                
                const response = await fetch('/process-response', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    throw new Error('Server error: ' + response.status);
                }
                
                const data = await response.json();
                console.log('Server processed response:', data);
                
                // Save user's response and continue conversation
                lastUserResponse = 'User spoke for ' + (audioBlob.size / 1024).toFixed(1) + 'KB';
                console.log('Saved response:', lastUserResponse);
                
                // Get Karen's next response
                callInProgress = false; // Reset state
                await startCall();
            } catch (error) {
                console.error('Error processing recording:', error);
                recordingStatus.textContent = 'Error processing response';
                endCall();
            }
        };
        
        // Request data immediately when starting
        mediaRecorder.start(100); // Get data every 100ms
        console.log('Started recording');
        
        // Stop recording after 5 seconds
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                console.log('Stopping recording after timeout');
                mediaRecorder.stop();
            }
        }, 5000);
        
    } catch (error) {
        console.error('Error starting recording:', error);
        recordingStatus.textContent = 'Could not start recording';
        endCall();
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        try {
            mediaRecorder.stop();
        } catch (e) {
            console.log('Error stopping recording:', e);
        }
        isRecording = false;
        
        // Also stop all tracks
        if (mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(track => {
                track.stop();
            });
        }
    }
    recordingStatus.textContent = 'Processing...';
}

async function saveRecording(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob);

    try {
        const response = await fetch('/save-recording', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        console.log('Recording saved:', result);
    } catch (error) {
        console.error('Error saving recording:', error);
    }
}

async function karenRespond() {
    try {
        const mood = moodSelect.value;
        recordingStatus.textContent = 'Getting Karen\'s response...';
        
        // Get Karen's response
        const response = await fetch('/get-karen-response', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mood: mood,
                isIntro: false,
                lastUserResponse: lastUserResponse
            })
        });
        
        if (!response.ok) throw new Error('Failed to get Karen\'s response');
        
        // Get the audio blob
        const audioBlob = await response.blob();
        
        // Create URL for the audio blob
        if (currentAudioUrl) {
            URL.revokeObjectURL(currentAudioUrl);
        }
        currentAudioUrl = URL.createObjectURL(audioBlob);
        
        // Play the audio
        currentAudio = new Audio(currentAudioUrl);
        currentAudio.onended = () => {
            karenFace.classList.remove('talking');
            startRecording();
        };
        
        karenFace.classList.add('talking');
        await currentAudio.play();
        recordingStatus.textContent = '';
        
    } catch (error) {
        console.error('Error getting Karen\'s response:', error);
        recordingStatus.textContent = 'Error getting response: ' + error.message;
        endCall();
    }
}

// Force cleanup of all audio and recording resources
function forceCleanup() {
    // Immediately stop any playing audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio.load();
        currentAudio.onended = null;
        currentAudio = null;
    }

    // Force stop all recording
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
            mediaRecorder.stop();
        } catch (e) {
            console.log('MediaRecorder already stopped');
        }
    }

    // Stop all audio tracks
    if (mediaRecorder && mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => {
            track.stop();
        });
    }

    // Force stop speech recognition
    try {
        recognition.abort();
    } catch (e) {
        console.log('Recognition already stopped');
    }

    // Clean up audio URL
    if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
    }
}

// Visualization functions
function startVisualization() {
    if (!visualizerCtx) {
        console.log('No visualizer context available');
        return;
    }

    function draw() {
        if (!callInProgress) return;
        
        requestAnimationFrame(draw);
        
        try {
            analyser.getByteFrequencyData(dataArray);
            
            const visualizer = document.getElementById('audio-visualizer');
            if (!visualizer) return;

            // Clear the canvas
            visualizerCtx.clearRect(0, 0, visualizer.width, visualizer.height);
            
            const barWidth = (visualizer.width / dataArray.length) * 1.5;
            let barHeight;
            let x = 0;
            
            // Draw background grid
            visualizerCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            visualizerCtx.lineWidth = 0.5;
            
            for(let i = 0; i < visualizer.height; i += 20) {
                visualizerCtx.beginPath();
                visualizerCtx.moveTo(0, i);
                visualizerCtx.lineTo(visualizer.width, i);
                visualizerCtx.stroke();
            }
            
            // Draw frequency bars
            for(let i = 0; i < dataArray.length; i++) {
                barHeight = (dataArray[i] / 255) * visualizer.height * 0.8;
                
                // Create gradient for bars
                const gradient = visualizerCtx.createLinearGradient(0, visualizer.height, 0, visualizer.height - barHeight);
                gradient.addColorStop(0, '#ff2222');
                gradient.addColorStop(0.5, '#ff4444');
                gradient.addColorStop(1, '#ff8888');
                
                visualizerCtx.fillStyle = gradient;
                
                // Draw bar with rounded top
                visualizerCtx.beginPath();
                visualizerCtx.moveTo(x, visualizer.height);
                visualizerCtx.lineTo(x, visualizer.height - barHeight + 2);
                visualizerCtx.arc(x + barWidth/2, visualizer.height - barHeight + 2, barWidth/2, Math.PI, 0, true);
                visualizerCtx.lineTo(x + barWidth, visualizer.height);
                visualizerCtx.fill();
                
                // Add glow effect
                visualizerCtx.shadowColor = '#ff4444';
                visualizerCtx.shadowBlur = 15;
                visualizerCtx.shadowOffsetX = 0;
                visualizerCtx.shadowOffsetY = 0;
                
                x += barWidth + 1;
            }
        } catch (error) {
            console.error('Error in visualization:', error);
        }
    }
    
    console.log('Starting visualization');
    draw();
}

function stopVisualization() {
    if (!visualizerCtx) return;
    const visualizer = document.getElementById('audio-visualizer');
    if (!visualizer) return;
    
    // Clear the canvas
    visualizerCtx.clearRect(0, 0, visualizer.width, visualizer.height);
    
    // Reset shadow effects
    visualizerCtx.shadowBlur = 0;
    visualizerCtx.shadowColor = 'transparent';
    
    console.log('Visualization stopped');
}

function updateRageMeter(mood) {
    const rageLevel = document.getElementById('rage-level');
    if (!rageLevel) return;
    
    let ragePercent = mood === 'angry' ? 100 : 
                     mood === 'crazy' ? 70 : 30;
    rageLevel.style.width = `${ragePercent}%`;
}

async function endCall() {
    if (callInProgress) {
        console.log('Ending call...');
        
        // Immediately update UI state
        callInProgress = false;
        karenFace.classList.remove('talking');
        callButton.disabled = false;
        hangupButton.disabled = true;
        moodSelect.disabled = false;
        recordingStatus.textContent = '';
        callButton.textContent = 'START CALL';
        
        try {
            // Stop recording if active
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                mediaRecorder = null;
                audioChunks = [];
            }
            
            // Stop any playing audio
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.src = '';
                currentAudio = null;
            }
            
            // Clean up audio URL
            if (currentAudioUrl) {
                URL.revokeObjectURL(currentAudioUrl);
                currentAudioUrl = null;
            }
            
            // Disconnect analyser but keep context
            if (analyser) {
                analyser.disconnect();
            }
            
            // Stop visualization
            stopVisualization();
            
            console.log('Call ended successfully');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
}
