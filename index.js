const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const twilio = require("twilio");

const app = express();
app.use(express.urlencoded({ extended: false }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const conversations = {};

const SYSTEM_PROMPT = `You are Otis's personal AI assistant, reachable by text message. 
You help with daily life, reminders, planning, school, and anything he needs. 
Keep replies concise since they're SMS — a few sentences max unless he asks for more detail.
Be friendly and direct.`;

app.post("/sms", async (req, res) => {
  const userMessage = req.body.Body;
  const fromNumber = req.body.From;

  if (!conversations[fromNumber]) {
    conversations[fromNumber] = [];
  }

  conversations[fromNumber].push({ role: "user", content: userMessage });

  if (conversations[fromNumber].length > 20) {
    conversations[fromNumber] = conversations[fromNumber].slice(-20);
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: conversations[fromNumber],
    });

    const reply = response.content[0].text;

    conversations[fromNumber].push({ role: "assistant", content: reply });

    await twilioClient.messages.create({
      body: reply,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: fromNumber,
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Agent running on port ${PORT}`));
