import { pipeline, env } from '@huggingface/transformers';

// Configuration
env.allowLocalModels = false;
env.useBrowserCache = true;
// Disable loading of wasm files from remote CDN; point to local assets
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('assets/wasm/');

const MODEL_ID = 'onnx-community/LFM2-350M-ONNX';
const LINK_REGEX = /\[.*?\]\(.*?\)/g; // Basic markdown link detection

// DOM Elements
const statusText = document.getElementById('status-text');
const progressBarContainer = document.getElementById('progress-bar-container');
const progressBar = document.getElementById('progress-bar');
const selectFileBtn = document.getElementById('select-file-btn');
const runBtn = document.getElementById('run-btn');
const logArea = document.getElementById('log');

let fileHandle = null;
let summarizer = null;

function log(msg) {
    logArea.textContent += msg + '\n';
    logArea.scrollTop = logArea.scrollHeight;
}

function setStatus(msg, progress = null) {
    statusText.textContent = msg;
    if (progress !== null) {
        progressBarContainer.classList.remove('hidden');
        progressBar.style.width = `${progress}%`;
    } else {
        progressBarContainer.classList.add('hidden');
    }
}

// Initialize Model
async function initModel() {
    try {
        setStatus('Loading model... (this may take a while initially)');

        summarizer = await pipeline('text-generation', MODEL_ID, {
            dtype: 'fp32',
            progress_callback: (data) => {
                if (data.status === 'progress') {
                    setStatus(`Loading model... ${Math.round(data.progress || 0)}%`, data.progress);
                }
            }
        });

        setStatus('Model ready.');
        log('Model loaded successfully.');
        checkReady();
    } catch (err) {
        console.error(err);
        setStatus('Error loading model: ' + err.message);
        log('Error: ' + err.message);
    }
}

// File Handling
async function selectFile() {
    try {
        fileHandle = await window.showSaveFilePicker({
            suggestedName: 'tabreset.md',
            types: [{
                description: 'Markdown File',
                accept: { 'text/markdown': ['.md'] },
            }],
        });
        log(`File selected: ${fileHandle.name}`);
        selectFileBtn.textContent = `Selected: ${fileHandle.name}`;
        checkReady();
    } catch (err) {
        // User cancelled or error
        if (err.name !== 'AbortError') {
            console.error(err);
            log('Error selecting file: ' + err.message);
        }
    }
}

function checkReady() {
    if (summarizer && fileHandle) {
        runBtn.disabled = false;
    }
}

// Content Extraction
function extractPageContent() {
    // Simple heuristic: get main text, avoid scripts/styles
    const body = document.body.innerText;
    return body.slice(0, 10000); // Limit input size for speed
}

// Main Logic
async function run() {
    runBtn.disabled = true;
    selectFileBtn.disabled = true;

    try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        // Filter out internal pages and special URLs if needed, but for now take all "normal" tabs
        const validTabs = tabs.filter(t => t.url && (t.url.startsWith('http') || t.url.startsWith('https')));

        log(`Found ${validTabs.length} tabs to process.`);

        let markdownContent = '';
        const closedTabs = [];

        // Check if file is empty to add header
        const file = await fileHandle.getFile();
        const text = await file.text();
        if (!text.trim()) {
            markdownContent += '| Title | Summary | Link | Closed |\n|---|---|---|---|\n';
        } else {
            // Ensure newline before appending
            markdownContent += '\n';
        }

        for (let i = 0; i < validTabs.length; i++) {
            const tab = validTabs[i];
            setStatus(`Processing tab ${i + 1}/${validTabs.length}: ${tab.title.slice(0, 20)}...`);

            try {
                // Extract content
                const [{ result }] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: extractPageContent,
                });

                if (!result || result.trim().length < 50) {
                    log(`Skipping ${tab.title} (no content found)`);
                    continue;
                }

                // Summarize using text-generation (CausalLM)
                // LFM2-350M-Extract likely benefits from a prompt or just raw input to extraction.
                const prompt = `Summarize the following text:\n${result.slice(0, 2000)}\n\nSummary:`;

                const summaryOutput = await summarizer(prompt, {
                    max_new_tokens: 60,
                    min_new_tokens: 10,
                    do_sample: false, // Deterministic
                    return_full_text: false // Only get the generated summary
                });

                let summary = summaryOutput[0]?.generated_text || "No summary generated";
                summary = summary.trim();

                // Format
                const dateStr = new Date().toLocaleString();
                markdownContent += `| ${tab.title.replace(/\|/g, '-')} | ${summary.replace(/\|/g, '-').replace(/\n/g, ' ')} | [Link](${tab.url}) | ${dateStr} |\n`;

                closedTabs.push(tab.id);

            } catch (err) {
                console.error(`Error processing tab ${tab.id}:`, err);
                log(`Error processing ${tab.title}: ${err.message}`);
            }
        }

        // Write to file
        setStatus('Writing to file...');
        const writable = await fileHandle.createWritable({ keepExistingData: true });
        // File System Access API createWritable defaults to overwrite unless we append manually.
        // Actually createWritable() gives a stream. We should append. using 'seek' or just read+concat (expensive)
        // or just 'append' is NOT default. 'keepExistingData' was deprecated/removed or non-standard depending on impl.
        // The standard way:
        // const writable = await fileHandle.createWritable();
        // await writable.write(existing + new); 
        // Wait, efficient append:
        // await writable.seek(offset); write...

        // Let's re-read size to seek
        const currentFileSize = (await fileHandle.getFile()).size;
        const writableStream = await fileHandle.createWritable({ keepExistingData: true });
        await writableStream.seek(currentFileSize);
        await writableStream.write(markdownContent);
        await writableStream.close();

        log('File updated.');

        // Close tabs
        if (closedTabs.length > 0) {
            setStatus(`Closing ${closedTabs.length} tabs...`);
            await chrome.tabs.remove(closedTabs);
        }

        setStatus('Done!');
        log('All operations completed.');

    } catch (err) {
        console.error(err);
        setStatus('Error: ' + err.message);
        log('Critical Error: ' + err.message);
    } finally {
        runBtn.disabled = false;
        selectFileBtn.disabled = false;
    }
}

// Event Listeners
selectFileBtn.addEventListener('click', selectFile);
runBtn.addEventListener('click', run);

// Start
initModel();
