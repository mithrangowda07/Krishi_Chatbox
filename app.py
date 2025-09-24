import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

load_dotenv()

import google.generativeai as genai


def initialize_gemini():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set. Please configure your .env file.")
    genai.configure(api_key=api_key)
    # Use a fast, cost-effective model with higher output token limit for richer answers
    generation_config = {
        "temperature": 0.7,
        "top_p": 0.95,
        "top_k": 40,
        "max_output_tokens": 1200,
    }
    return genai.GenerativeModel("gemini-1.5-flash", generation_config=generation_config)


app = Flask(__name__)
gemini_model = None


# Basic heuristic list of agriculture-related terms for a lightweight guardrail.
AGRI_KEYWORDS = [
    "agriculture", "farming", "farmer", "crop", "crops", "soil", "irrigation",
    "pest", "pests", "fertilizer", "fertiliser", "fertilizers", "fertilisers",
    "seed", "seeds", "harvest", "sowing", "planting", "yield", "weather",
    "rain", "monsoon", "drought", "insect", "disease", "fungus", "weed",
    "livestock", "dairy", "goat", "poultry", "cattle", "tractor", "market price",
    "mandi", "commodity", "wheat", "rice", "paddy", "maize", "corn", "millet",
    "ragi", "jowar", "cotton", "turmeric", "spice", "horticulture", "greenhouse",
    "polyhouse", "compost", "vermicompost", "organic", "soil health", "ph",
    "drip", "sprinkler", "mulch", "irrigate", "nursery", "sapling", "fruit",
    "vegetable", "kharif", "rabi", "zayed", "fungicide", "herbicide", "pesticide",
    "extension", "krishi", "krishi kendra", "pruning", "grafting", "bud", "flower",
    "aquaculture", "fish", "bee", "apiculture", "sericulture", "silk"
]

# Common Kannada agriculture terms to improve guardrail for Kannada queries
AGRI_KEYWORDS_KN = [
    "ಕೃಷಿ", "ರೈತ", "ಬೆಳೆ", "ಮಣ್ಣು", "ನೀರಾವರಿ", "ಕೀಟ", "ಗೊಬ್ಬರ", "ಬೀಜ", "ಕೊಯ್ಲು",
    "ಹವಾಮಾನ", "ಮಳೆ", "ಬರ", "ರೋಗ", "ಹುಳು", "ಹುಲ್ಲುನಾಶಕ", "ಕೀಟನಾಶಕ", "ಸಸ್ಯ",
    "ಪಶುಸಂಗೋಪನೆ", "ಹಸು", "ಆಡು", "ಕೋಳಿ", "ಟ್ರಾಕ್ಟರ್", "ಮಾರುಕಟ್ಟೆ", "ಬೆಲೆ", "ಗೋಧಿ",
    "ಅಕ್ಕಿ", "ಜೋಳ", "ರಾಗಿ", "ಜೋವಾರಿ", "ಕಾಟನ್", "ಅರಿಶಿನ", "ತೋಟಗಾರಿಕೆ", "ಗ್ರೀನ್",
    "ಪಾಲಿಹೌಸ್", "ಕಾಂಪೋಸ್ಟ್", "ಸಾವಯವ", "ಪಿಹೆಚ್", "ಡ್ರಿಪ್", "ಸ್ಪ್ರಿಂಕ್ಲರ್", "ನರ್ಸರಿ",
    "ಚಿಗುರು", "ಹಣ್ಣು", "ತರಕಾರಿ"
]


def is_agri_related(text: str) -> bool:
    lower = text.lower()
    if any(keyword in lower for keyword in AGRI_KEYWORDS):
        return True
    # Kannada: check against Kannada list directly (no lowercasing impact for Kannada)
    return any(keyword in text for keyword in AGRI_KEYWORDS_KN)


SYSTEM_INSTRUCTIONS = (
    "You are Krishi Chatbox, an assistant for farmers. "
    "Only answer agriculture-related queries: crops, soil, irrigation, pests, fertilizers, "
    "weather, farm machinery, market prices, and related topics. "
    "Write practical, detailed guidance tailored for Indian conditions when relevant. "
    "Structure answers with short paragraphs and bullet points. Include: a brief overview, "
    "step-by-step actions, recommended quantities/dosages, timing/frequency, common mistakes, "
    "and a concise summary. Aim for 150–300 words (or more if needed). "
    "If the user's question is not agriculture-related, respond exactly with: "
    "This chatbox is only for agriculture-related queries."
)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    lang = (data.get("lang") or "en").strip()  # input language
    resp_lang = (data.get("respLang") or lang).strip()  # response language, default to input

    if not message:
        return jsonify({"error": "Empty message"}), 400

    if not is_agri_related(message):
        return jsonify({
            "reply": "This chatbox is only for agriculture-related queries.",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })

    try:
        global gemini_model
        if gemini_model is None:
            gemini_model = initialize_gemini()
        lang_instruction = "Respond in Kannada." if resp_lang.startswith("kn") else "Respond in English."
        style_instruction = (
            "Use clear headings and bullet points where helpful. Avoid filler and be specific."
        )
        prompt = (
            f"{SYSTEM_INSTRUCTIONS} {lang_instruction} {style_instruction}\n\n"
            f"User ({lang}): {message}"
        )
        result = gemini_model.generate_content(prompt)
        text = getattr(result, "text", None) or "I couldn't generate a response. Please try again."
        return jsonify({
            "reply": text.strip(),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/translate", methods=["POST"])
def translate():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    target_lang = (data.get("targetLang") or "en").strip()

    if not text:
        return jsonify({"error": "Empty text"}), 400

    try:
        global gemini_model
        if gemini_model is None:
            gemini_model = initialize_gemini()
        instruction = (
            "Translate the following text. Return only the translated text with no prefix. "
            + ("Target language: Kannada." if target_lang.startswith("kn") else "Target language: English.")
        )
        result = gemini_model.generate_content(f"{instruction}\n\n{text}")
        translated = getattr(result, "text", None) or ""
        return jsonify({"translated": translated.strip()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="127.0.0.1", port=port, debug=True)


