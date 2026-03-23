const axios = require("axios");

const makeHfRequest = async (messages, model) => {
  return await axios.post(
    "https://router.huggingface.co/v1/chat/completions",
    {
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 512
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );
};

const generateResponse = async (prompt, history = [], systemContext = '') => {
  try {
    console.log("HF KEY:", process.env.HF_API_KEY ? "LOADED" : "MISSING");
    
    const messages = [];
    if (systemContext) {
      messages.push({ role: "system", content: systemContext });
    } else {
      messages.push({ role: "system", content: "You are a helpful and intelligent AI assistant." });
    }

    if (Array.isArray(history)) {
      messages.push(...history);
    }

    messages.push({ role: "user", content: prompt });

    console.log("Using NEW HF API"); // Debug check for deployment

    let response;
    try {
      // Primary model: Qwen/Qwen2.5-7B-Instruct
      console.log("Trying Qwen model...");
      response = await makeHfRequest(messages, "Qwen/Qwen2.5-7B-Instruct");
    } catch (qwenError) {
      console.error("Qwen failed:", qwenError.response?.data || qwenError.message);
      console.log("Switching to fallback model Meta-Llama...");
      // Fallback model: meta-llama/Meta-Llama-3-8B-Instruct
      response = await makeHfRequest(messages, "meta-llama/Meta-Llama-3-8B-Instruct");
    }

    console.log("HF RESPONSE:", response.data);

    if (!response.data?.choices?.length) {
      throw new Error("Empty response from HF");
    }

    return response.data.choices[0].message.content;

  } catch (error) {
    console.error("HF ERROR FULL:", error.response?.data || error.message);
    // ✅ FALLBACK MESSAGE
    return "AI service temporarily unavailable. Please try again.";
  }
};

module.exports = { generateResponse };
