# Nutrition
App to prototype out building agents. Specifically to record nutrition and recipes by scanning screenshots or labels using Anthropic API.

## Process
start the backend `uvicorn main:app --reload`

start the frontend `npm run dev`

Change `USE_MOCK` in .env to `false` in order to send to anthropic 

Prod start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`