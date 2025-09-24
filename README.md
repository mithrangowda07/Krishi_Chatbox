Krishi Chatbox
================

A local web application that helps farmers with agriculture-related information using Gemini AI.

Tech Stack
----------
- Backend: Python (Flask)
- Frontend: HTML, CSS, JavaScript
- AI: Google Generative AI (Gemini)

Features
--------
- Clean, farmer-friendly chat UI (green/earthy theme)
- Chat with timestamps, typing indicator, smooth animations
- Agriculture-only responses; unrelated questions are rejected
- Voice input (Web Speech API) for English and Kannada
- Text-to-speech playback in the same language
- Clear chat button and mobile responsive design

Local Setup
-----------
1) Create a virtual environment (recommended)
   - Windows PowerShell:
     - `python -m venv .venv`
     - `.\.venv\Scripts\Activate.ps1`

2) Install dependencies
   - `pip install -r requirements.txt`

3) Configure environment variables
   - Create a file named `.env` in the project root with:

     GEMINI_API_KEY=your_google_generative_ai_key_here

   - Note: If you cannot create `.env.example` due to system restrictions, simply create your `.env` manually as above.

4) Run the app
   - `python app.py`
   - Open `http://127.0.0.1:5000/` in your browser

Folders
-------
- `templates/index.html` — main UI
- `static/css/style.css` — theme and responsive styles
- `static/js/script.js` — chat logic, voice features
- `app.py` — Flask server and Gemini integration

Troubleshooting
---------------
- If you see `GEMINI_API_KEY is not set`, ensure `.env` exists and contains your key.
- If speech features don't work, try Chrome on desktop (Web Speech APIs are best supported there).
- For Kannada TTS, voices vary by OS/browser; fallback is attempted via `kn-IN` locale.

Security Note
-------------
This app runs locally and loads the API key from `.env`. Do not commit your real key to source control.


