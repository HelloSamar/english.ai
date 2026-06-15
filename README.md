# vocab.ai

vocab.ai is a vocabulary revision web app for government exam aspirants who want quick English practice with Hindi support.

## What it does

Enter an English word or phrase and build your revision PDF automatically. For each lookup, vocab.ai gives:

- Hindi meaning
- Two synonyms
- Two antonyms
- One exam-style example sentence
- Hindi meaning of the example sentence

Every generated entry is saved locally in the browser for later revision. Learners can download the saved list as a PDF and use it for quick review before mocks.

## AI generation

The frontend first calls a Firebase Cloud Function:

```text
https://us-central1-abhyasam-ai.cloudfunctions.net/generateVocabulary
```

That function calls the OpenAI API from the server side, so the OpenAI API key is never placed in the public GitHub Pages frontend.

If the function is not deployed or fails, the frontend falls back to the older browser-side dictionary and translation lookup.

## Firebase Function deployment

Install Firebase CLI:

```bash
npm install -g firebase-tools
```

Login and select the Firebase project:

```bash
firebase login
firebase use abhyasam-ai
```

Set the OpenAI API key as a Firebase secret:

```bash
firebase functions:secrets:set OPENAI_API_KEY
```

Deploy only functions:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Optional model override:

```bash
firebase functions:config:set openai.model="gpt-5.5"
```

The function currently defaults to `gpt-5.5` unless `OPENAI_MODEL` is available in the runtime environment.

## Who it is for

vocab.ai is useful for aspirants preparing for exams such as:

- SSC CGL
- SSC CHSL
- Banking exams
- Railway exams
- Defence exams
- State government exams
- Other competitive exams with English vocabulary sections

## Focus areas

The app is designed around common vocabulary needs in government exams:

- One Word Substitution
- Idioms
- Antonyms & Synonyms
- Spellings
- Important words and phrases

## Revision tip

Generate entries for the words and phrases you miss in practice sets, previous-year questions, mocks, or daily reading. Keep adding them to your saved list, then download the PDF for fast revision before tests.
