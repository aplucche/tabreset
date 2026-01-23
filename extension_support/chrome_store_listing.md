# Chrome Web Store Listing Content

## Store Description (16000 char max)

**Tab Reset** helps you declutter your browser by summarizing and closing your open tabs.

**How it works:**
1. Click the extension and select a markdown file to save your summaries
2. Click "Summarize & Reset"
3. Each tab is summarized, saved to your file, and closed

**Features:**
- Local AI summarization - all processing happens on your device, nothing is sent to external servers
- Saves tab summaries as a markdown table with title, summary, link, and timestamp
- Remembers your chosen file between sessions
- Processes tabs one-by-one so your data is saved before each tab closes

**Permissions explained:**
- "Read and change all your data on all websites" - Required to read page content for summarization. Content is processed locally and never transmitted.

**Note:** First launch downloads the AI model (~700MB), which may take a moment. Subsequent launches use the cached model.

---

## Privacy Practices Tab

### Single Purpose
Summarize and close browser tabs using local AI, saving summaries to a user-selected markdown file.

### Host Permission (`<all_urls>`)
Required to extract page content from all open tabs for local AI summarization. Content is processed entirely on-device and never transmitted to external servers.

### Remote Code Use
The extension downloads an open-source AI model (LFM2-350M-ONNX) from Hugging Face on first launch. This model runs locally via WebAssembly for on-device text summarization. No user data is sent remotely.

### Scripting Permission
Required to execute a content script that extracts text content from web pages for summarization. The script only reads page text and meta descriptions.

### Tabs Permission
Required to query open tabs in the current window, access their URLs and titles, and close them after summarization is complete.

---

## Data Usage Checkboxes

- [ ] Personally identifiable information — **NO**
- [ ] Health information — **NO**
- [ ] Financial and payment information — **NO**
- [ ] Authentication information — **NO**
- [ ] Personal communications — **NO**
- [ ] Location — **NO**
- [ ] Web history — **NO**
- [ ] User activity — **NO**
- [ ] Website content — **NO** (read locally, never transmitted)

All processing occurs on-device. No data is collected, transmitted, or stored externally.
