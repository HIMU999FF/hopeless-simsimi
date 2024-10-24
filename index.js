const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// MongoDB connection
const mongoURI = 'mongodb+srv://user2000:test123@cluster0.e6is4.mongodb.net/chatbotDB?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected...'))
  .catch(err => console.log('MongoDB connection error:', err));

mongoose.connection.on('error', (err) => {
  console.log('MongoDB connection error:', err);
});

// Schema for Chat responses
const chatSchema = new mongoose.Schema({
  input: { type: String, unique: true, required: true },
  responses: { type: [String], default: [] }
});

const Chat = mongoose.model('Chat', chatSchema);

// Translation function using Google Translate API
async function translateAPI(text, lang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    if (data && data.length > 0 && data[0].length > 0 && data[0][0].length > 0) {
      return data[0][0][0];
    } else {
      throw new Error("Unable to extract translated text from the API response.");
    }
  } catch (error) {
    throw new Error("Error fetching translation: " + error.message);
  }
}

async function samirtranslate(text, lang = 'en') {
  if (typeof text !== "string") throw new Error("The first argument (text) must be a string");
  if (typeof lang !== "string") throw new Error("The second argument (lang) must be a string");

  return translateAPI(text, lang);
}

// Main chat endpoint
app.post('/chat', async (req, res) => {
  const { input, lang = 'en' } = req.body;

  const normalizedInput = input.toLowerCase();

  console.log('User input received:', normalizedInput); // Debugging log

  // Search for input in the database
  Chat.findOne({ input: normalizedInput }, async (err, chat) => {
    if (err) {
      console.log('Error finding input in DB:', err); // Debugging log
      return res.status(500).send({ error: 'Database error' });
    }

    if (chat) {
      console.log('Chat found in DB:', chat); // Debugging log

      if (chat.responses.length > 0) {
        // Pick a random response
        const randomResponse = chat.responses[Math.floor(Math.random() * chat.responses.length)];
        const translatedResponse = await samirtranslate(randomResponse, lang);

        console.log('Response sent:', translatedResponse); // Debugging log
        return res.send({ response: translatedResponse });
      } else {
        const defaultResponse = `I don't know about "${input}", but I'll learn!`;
        return res.send({ response: defaultResponse });
      }
    } else {
      console.log('Chat not found in DB, input:', normalizedInput); // Debugging log

      const defaultResponse = `I don't know about "${input}", but I'll learn!`;
      return res.send({ response: defaultResponse });
    }
  });
});

// Admin route to add response
app.post('/tech', async (req, res) => {
  const { input, response, lang = 'en' } = req.body;

  const normalizedInput = input.toLowerCase();
  const translatedResponse = await samirtranslate(response, 'en');

  console.log('Admin adding response:', translatedResponse); // Debugging log

  Chat.findOne({ input: normalizedInput }, (err, chat) => {
    if (err) {
      console.log('Error finding input in DB:', err); // Debugging log
      return res.status(500).send({ error: 'Database error' });
    }

    if (chat) {
      if (!chat.responses.includes(translatedResponse)) {
        chat.responses.push(translatedResponse);
        chat.save((err) => {
          if (err) {
            console.log('Error saving chat in DB:', err); // Debugging log
            return res.status(500).send({ error: 'Database error' });
          }
          console.log(`Response added: "${response}" for input "${input}"`); // Debugging log
          return res.send({ message: `Response added: "${response}"` });
        });
      } else {
        return res.send({ message: `Response already exists: "${response}"` });
      }
    } else {
      const newChat = new Chat({ input: normalizedInput, responses: [translatedResponse] });
      newChat.save((err) => {
        if (err) {
          console.log('Error saving new chat in DB:', err); // Debugging log
          return res.status(500).send({ error: 'Database error' });
        }
        console.log(`New response added: "${response}" for input "${input}"`); // Debugging log
        return res.send({ message: `Response added: "${response}"` });
      });
    }
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
