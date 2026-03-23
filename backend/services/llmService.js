const axios = require('axios');

const MODEL_ID = 'Qwen/Qwen2.5-7B-Instruct';
const HF_API_URL = `https://api-inference.huggingface.co/models/${MODEL_ID}`;

async function generateAIResponse(prompt, history = [], systemContext = '') {
    const apiKey = process.env.HF_API_KEY;

    if (!apiKey) {
        throw new Error('Hugging Face API key (HF_API_KEY) is missing in environment variables.');
    }

    // Format for Qwen2.5 Instruct:
    let formattedPrompt = "";
    
    if (systemContext) {
        formattedPrompt += `<|im_start|>system\n${systemContext}<|im_end|>\n`;
    } else {
        formattedPrompt += `<|im_start|>system\nYou are a helpful and intelligent AI assistant.<|im_end|>\n`;
    }

    if (Array.isArray(history)) {
        for (const msg of history) {
            formattedPrompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
        }
    }

    formattedPrompt += `<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`;

    try {
        const response = await axios.post(
            HF_API_URL,
            {
                inputs: formattedPrompt,
                parameters: {
                    max_new_tokens: 500,
                    temperature: 0.7,
                    return_full_text: false,
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000 // 30 second timeout
            }
        );

        const data = response.data;
        
        // Handle model loading error gracefully (though Axios might throw on 503 natively)
        if (data.error && data.error.includes('is currently loading')) {
            throw new Error(`Model is loading. Please try again in ${Math.ceil(data.estimated_time || 20)} seconds.`);
        }

        const generatedText = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;

        if (!generatedText) {
            throw new Error('Received empty response from Hugging Face API');
        }

        return generatedText.trim();
    } catch (err) {
        // Advanced Axios Error Handling
        if (err.response) {
            if (err.response.status === 503 && err.response.data?.estimated_time) {
                throw new Error(`Model is cold-starting. Try again in ~${Math.ceil(err.response.data.estimated_time)}s.`);
            }
            if (err.response.status === 401) {
                throw new Error('Invalid HF_API_KEY. Please verify your Hugging Face token.');
            }
            throw new Error(`Hugging Face API Error: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
        } else if (err.request) {
            throw new Error('Hugging Face API timeout or no response received.');
        } else {
            throw err;
        }
    }
}

module.exports = {
    generateAIResponse
};
