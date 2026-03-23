const axios = require('axios');

const HF_API_KEY = process.env.HF_API_KEY;
const WHISPER_API_URL = 'https://api-inference.huggingface.co/models/openai/whisper-base';

/**
 * Converts audio buffer to text using Hugging Face Whisper API
 * @param {Buffer} audioBuffer - Binary audio data from multer
 * @param {string} mimetype - Content type of the audio file
 * @returns {Promise<string>} - Transcribed text
 */
async function speechToText(audioBuffer, mimetype = 'audio/webm') {
    if (!HF_API_KEY) {
        throw new Error('HF_API_KEY is not defined in environment variables');
    }

    try {
        const response = await axios.post(WHISPER_API_URL, audioBuffer, {
            headers: {
                'Authorization': `Bearer ${HF_API_KEY}`,
                'Content-Type': mimetype || 'audio/flac', 
            },
            maxBodyLength: Infinity
        });

        if (response.data && response.data.text) {
            return response.data.text.trim();
        }

        // If HF returns array of chunks
        if (Array.isArray(response.data)) {
            return response.data.map(chunk => chunk.text).join(' ').trim();
        }

        throw new Error('Unexpected response format from Whisper API');
    } catch (error) {
        console.error('speechToText Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.error || 'Failed to convert speech to text');
    }
}

module.exports = {
    speechToText
};
