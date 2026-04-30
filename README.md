# Tab Reset

An experiment in running local LLMs in the browser.

A chrome extension for too many open tabs. Writes a summary of open tabs to a Markdown file then closes them. Uses the [LFM2-350M](https://leap.liquid.ai/models?model=lfm2-350m) model to summarize along with meta tags.


Install in the [Chrome Store](https://chromewebstore.google.com/detail/helipkcklcnlbaccacknhiijfinpamnb?utm_source=item-share-cb)

- Uses [transformers.js](https://huggingface.co/docs/transformers.js/en/index) to serve LLM via the browser
- Stores tab data in an append only user selected file
- ONXX link: [LFM2-350M ONXX link](https://huggingface.co/onnx-community/LFM2-350M-ONNX)

Example tabreset.md file:

| Title | Summary | Link | Closed |
|-------|---------|------|--------|
| Article Title | One-line summary here | [link](https://...) | 2026-01-21 14:30 |