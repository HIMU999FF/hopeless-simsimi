const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

const mongoURI = 'mongodb+srv://jonny:404@cluster0.e6is4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected...'))
  .catch(err => console.log('MongoDB connection error:', err));

const chatSchema = new mongoose.Schema({
  input: { type: String, unique: true, required: true },
  responses: { type: [String], default: [] }
});

const Chat = mongoose.model('Chat', chatSchema);

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
    throw new Error("Error fetching translation:", error.message);
  }
}

async function samirtranslate(text, lang = 'en') {
  if (typeof text !== "string") throw new Error("The first argument (text) must be a string");
  if (typeof lang !== "string") throw new Error("The second argument (lang) must be a string");

  return translateAPI(text, lang);
}

function evaluateMath(expression) {
  try {
    expression = expression.replace(/[^\d+\-*/().^√]/g, '');
    expression = expression.replace(/\^/g, '**').replace(/√([^)]+)/g, 'Math.sqrt($1)');
    const result = eval(expression);
    return result !== undefined ? result.toString() : null;
  } catch (error) {
    return null;
  }
}

function chooseRandomly(input) {
  const regex = /choose between\s+(.+?)\s+and\s+(.+)/i;
  const match = input.match(regex);

  if (match && match.length === 3) {
    const option1 = match[1].trim();
    const option2 = match[2].trim();
    const choices = [option1, option2];
    const randomChoice = choices[Math.floor(Math.random() * choices.length)];
    return `I choose ${randomChoice}.`;
  } else {
    return 'Please provide a valid format: "choose between name1 and name2".';
  }
}

function getDateTimeInfo(query) {
  const now = new Date();

  if (/current date|what is the date|date/i.test(query)) {
    return `The current date is ${now.toLocaleDateString()}.`;
  }

  if (/what time is it|current time|time/i.test(query)) {
    return `The current time is ${now.toLocaleTimeString()}.`;
  }

  if (/time in bangladesh/i.test(query)) {
    const bangladeshTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
    return `The current time in Bangladesh is ${bangladeshTime.toLocaleTimeString()}.`;
  }

  return null;
}

app.post('/chat', async (req, res) => {
  const { input, lang = 'en' } = req.body;

  const normalizedInput = input.toLowerCase();
  const mathResult = evaluateMath(normalizedInput);
  const randomChoiceResult = chooseRandomly(normalizedInput);
  const dateTimeResult = getDateTimeInfo(normalizedInput);

  if (dateTimeResult) {
    const translatedResponse = await samirtranslate(dateTimeResult, lang);
    return res.send({ response: translatedResponse });
  }

  if (mathResult !== null) {
    const mathExpression = normalizedInput.replace(/[^0-9+\-*/().^√]/g, '');
    const formattedResponse = `The equation of ${mathExpression} would be ${mathResult}.`;
    const translatedResponse = await samirtranslate(formattedResponse, lang);
    return res.send({ response: translatedResponse });
  }

  if (randomChoiceResult !== 'Please provide a valid format: "choose between name1 and name2".') {
    const translatedResponse = await samirtranslate(randomChoiceResult, lang);
    return res.send({ response: translatedResponse });
  }

  Chat.findOne({ input: normalizedInput }, async (err, chat) => {
    if (err) {
      return res.status(500).send({ error: 'Database error' });
    }

    if (chat) {
      if (chat.responses.length > 0) {
        const randomResponse = chat.responses[Math.floor(Math.random() * chat.responses.length)];
        const translatedResponse = await samirtranslate(randomResponse, lang);
        return res.send({ response: translatedResponse });
      } else {
        const defaultResponse = `I don't know about "${input}", but I'll learn!`;
        return res.send({ response: defaultResponse });
      }
    } else {
      const defaultResponse = `I don't know about "${input}", but I'll learn!`;
      return res.send({ response: defaultResponse });
    }
  });
});

app.post('/tech', async (req, res) => {
  const { input, response, lang = 'en' } = req.body;

  const normalizedInput = input.toLowerCase();
  const translatedResponse = await samirtranslate(response, 'en');

  Chat.findOne({ input: normalizedInput }, (err, chat) => {
    if (err) {
      return res.status(500).send({ error: 'Database error' });
    }

    if (chat) {
      if (!chat.responses.includes(translatedResponse)) {
        chat.responses.push(translatedResponse);
        chat.save((err) => {
          if (err) {
            return res.status(500).send({ error: 'Database error' });
          }
          return res.send({ message: `Response added: "${response}"` });
        });
      } else {
        return res.send({ message: `Response already exists: "${response}"` });
      }
    } else {
      const newChat = new Chat({ input: normalizedInput, responses: [translatedResponse] });
      newChat.save((err) => {
        if (err) {
          return res.status(500).send({ error: 'Database error' });
        }
        return res.send({ message: `Response added: "${response}"` });
      });
    }
  });
});

app.delete('/delete', async (req, res) => {
  const { input, response, lang = 'en' } = req.body;

  const normalizedInput = input.toLowerCase();

  const translatedInput = await samirtranslate(normalizedInput, 'en');

  Chat.findOne({ input: translatedInput }, (err, chat) => {
    if (err) {
      return res.status(500).send({ error: 'Database error' });
    }

    if (chat) {
      if (response) {
        samirtranslate(response, 'en').then(translatedResponse => {
          chat.responses = chat.responses.filter(res => res !== translatedResponse);

          if (chat.responses.length > 0) {
            chat.save((err) => {
              if (err) {
                return res.status(500).send({ error: 'Database error' });
              }
              return res.send({ message: `Response "${response}" deleted from input "${input}"` });
            });
          } else {
            Chat.deleteOne({ input: translatedInput }, (err) => {
              if (err) {
                return res.status(500).send({ error: 'Database error' });
              }
              return res.send({ message: `No more responses left for input "${input}", entry deleted` });
            });
          }
        });
      } else {
        Chat.deleteOne({ input: translatedInput }, (err) => {
          if (err) {
            return res.status(500).send({ error: 'Database error' });
          }
          return res.send({ message: `All responses for input "${input}" deleted` });
        });
      }
    } else {
      return res.send({ message: `No chat found with input: "${input}"` });
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
