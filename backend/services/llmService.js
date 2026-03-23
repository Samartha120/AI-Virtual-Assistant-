const axios = require("axios");

const generateResponse = async (prompt, history = [], systemContext = '') => {
  try {
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

    const response = await axios.post(
      "https://router.huggingface.co/v1/chat/completions",
      {
        model: "Qwen/Qwen2.5-7B-Instruct",
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

    return response.data.choices[0].message.content;

  } catch (error) {
    console.error("HF ERROR:", error.response?.data || error.message);
    throw new Error("Hugging Face request failed");
  }
};

module.exports = { generateResponse };
