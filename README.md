# Tab Reset

A chrome extension for when you have too many open tabs. Writes a summary of open tabs to a Markdown file then closes them using private local LLMs and meta tags. Uses the LFM 1.2B model (default: [LFM2-350M](https://leap.liquid.ai/models?model=lfm2-350m)) to summarize.

- Uses [transfomer.js](https://huggingface.co/docs/transformers.js/en/index) to serve LLM via the browser
- Model file used: [LFM2-350M ONXX link](https://huggingface.co/onnx-community/LFM2-350M-ONNX)
- Stores tab data in an append only user selected file (default: tabreset.md)
- Minimal interface and local

Example tabreset.md file:

| Title | Summary | Link | Closed |
|-------|---------|------|--------|
| Article Title | One-line summary here | [link](https://...) | 2026-01-21 14:30 |