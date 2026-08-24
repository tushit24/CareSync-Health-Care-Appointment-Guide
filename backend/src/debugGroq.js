const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function debug() {
  console.log('API Key:', process.env.GROQ_API_KEY);
  try {
    const response = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'user',
          content: 'Analyse these symptoms and return a JSON object containing: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: High fever, sore throat'
        }
      ],
      response_format: { type: "json_object" }
    });

    console.log('SUCCESS!');
    console.log(response.choices[0].message.content);
  } catch (error) {
    console.error('ERROR OCCURRED:');
    console.error(error);
  }
}

debug();
