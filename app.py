import os
from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
from elevenlabs.client import ElevenLabs
from elevenlabs import VoiceSettings
from io import BytesIO
import random

app = Flask(__name__)
CORS(app)

# Initialize ElevenLabs client
ELEVENLABS_API_KEY = os.getenv('ELEVENLABS_API_KEY', '')
client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

def generate_karen_response(mood, last_user_response, is_intro=False):
    if is_intro:
        responses = {
            'angry': [
                "I can't believe how incompetent this service is!",
                "I demand to speak to your manager RIGHT NOW!",
                "Do you know how much money I spend here?",
                "This is absolutely UNACCEPTABLE!"
            ],
            'happy': [
                "Oh my goodness, you're just the sweetest thing!",
                "I love love LOVE your customer service!",
                "You're doing such an amazing job, honey!",
                "I'll definitely tell all my friends about this!"
            ],
            'crazy': [
                "The aliens told me your company is part of the conspiracy!",
                "I can see the matrix in your voice, you know...",
                "My pet psychic said this would happen!",
                "The government is listening to this call, I just know it!"
            ]
        }
        return random.choice(responses[mood])
    
    # If we have a user response, generate a contextual response
    if last_user_response:
        if mood == 'angry':
            # More natural, varied angry responses that don't just echo back
            angry_responses = [
                "OH. MY. GOD. I cannot BELIEVE what I'm hearing! You people are COMPLETELY USELESS!",
                "Are you SERIOUSLY trying to tell me that?! This is the WORST customer service I have EVER experienced!",
                "I am literally SHAKING right now! Do you have ANY IDEA who I am?!",
                "EXCUSE ME?! I've been a customer for 15 YEARS and THIS is how you treat me?!",
                "This is RIDICULOUS! My CHILDREN could provide better service than this!",
                "I am going to BLAST your company on EVERY social media platform! You'll be HEARING from my lawyer!",
                "*SCREAMING* I want your manager's manager's MANAGER! RIGHT! NOW!",
                "Oh, that's just PERFECT! Just PERFECT! I'm recording ALL of this for my YouTube channel!"
            ]
            return random.choice(angry_responses)
        elif mood == 'happy':
            return f"Oh my stars! When you say '{last_user_response}' it just makes me so happy!"
        else:  # crazy
            return f"'{last_user_response}'? That's EXACTLY what the lizard people told me you'd say!"
    
    # Fallback responses if no user response
    fallbacks = {
        'angry': [
            # Escalating frustration
            "I'm getting more frustrated by the second, and believe me, you don't want to see me angry!",
            "This is absolutely ridiculous! I've never experienced such incompetence in my life!",
            "I can't believe this is happening! Do you people even know what you're doing?",
            
            # Authority demands
            "I demand to speak to your supervisor RIGHT NOW! This is beyond unacceptable!",
            "Get me your manager immediately! I won't stand for this level of service!",
            "Do you know who I am? I'm friends with the CEO of your competitor!",
            
            # Time-based complaints
            "I've been waiting for 45 minutes! This is absolutely outrageous!",
            "My time is valuable, and you're wasting it with your incompetence!",
            "I could've gone to your competitor and back THREE TIMES by now!",
            
            # Status/loyalty appeals
            "I've been a loyal customer for 15 years, and this is how you treat me?",
            "I spend thousands of dollars here every month! You can't treat me like this!",
            "Everyone in my social circle will hear about this terrible service!",
            
            # Threats and ultimatums
            "Fix this immediately, or I'm taking my business elsewhere!",
            "I'll have you know I have over 10,000 followers on social media!",
            "You'll be hearing from my lawyer about this! This is completely unacceptable!",
            
            # Personal attacks
            "Are you even trained for this job? Because it certainly doesn't seem like it!",
            "My ten-year-old could provide better service than this!",
            "I can't believe they let someone so incompetent handle customer service!"
        ],
        'happy': "Everything is just wonderful, isn't it?",
        'crazy': "The voices in my head agree with me on this one!"
    }
    return random.choice(fallbacks[mood])

# Karen's voice settings for different moods
voice_settings = {
    'angry': VoiceSettings(
        stability=0.05,  # Even more unstable for extreme anger
        similarity_boost=1.0,  # Maximum character similarity
        style=1.0,
        use_speaker_boost=True,
        speaking_rate=1.3,  # Even faster when angry
        temperature=1.5  # Add more variation to the voice
    ),
    'happy': VoiceSettings(
        stability=0.7,
        similarity_boost=0.75,
        style=0.7,
        use_speaker_boost=True
    ),
    'crazy': VoiceSettings(
        stability=0.1,
        similarity_boost=0.75,
        style=1.0,
        use_speaker_boost=True
    )
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get-karen-response', methods=['POST'])
def get_karen_response():
    try:
        data = request.json
        mood = data.get('mood', 'angry')
        is_intro = data.get('isIntro', False)
        last_user_response = data.get('lastUserResponse', '')
        
        print(f"Generating response for mood: {mood}")
        print(f"User said: {last_user_response}")
        
        # Generate a contextual response
        response_text = generate_karen_response(mood, last_user_response, is_intro)
        print(f"Selected response: {response_text}")
        
        try:
            # Generate audio using ElevenLabs
            audio_generator = client.text_to_speech.convert(
                text=response_text,
                voice_id="21m00Tcm4TlvDq8ikWAM",  # Rachel voice
                model_id="eleven_multilingual_v2",
                voice_settings=voice_settings[mood]
            )
            
            # Convert generator to bytes
            audio = b''.join(chunk for chunk in audio_generator)
            print("Audio generated successfully")
            
            # Create a BytesIO object to serve the audio
            audio_io = BytesIO(audio)
            
            return send_file(
                audio_io,
                mimetype='audio/mpeg',
                as_attachment=True,
                download_name='karen_response.mp3'
            )
        except Exception as e:
            print(f"Error generating audio: {str(e)}")
            raise e
            
    except Exception as e:
        print(f"Error in get_karen_response: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/save-recording', methods=['POST'])
def save_recording():
    # For MVP, we'll just acknowledge the recording
    # In a real app, you'd save this for training
    return jsonify({"status": "success", "message": "Recording saved!"})

if __name__ == '__main__':
    if not ELEVENLABS_API_KEY:
        print("WARNING: ELEVENLABS_API_KEY not set! Voice generation will fail.")
    app.run(debug=True)
