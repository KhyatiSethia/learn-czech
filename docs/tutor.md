---
title: How the tutor works
---

# How the tutor works

The tutor is a small language model that explains Czech to you in English. Open it with the **Tutor** button in the top bar, or from any exercise you miss.

It is meant for quick questions: *why is it "v kině" and not "do kina"?*, *break this sentence down*, *quiz me on this page*. It is not a replacement for a teacher or a textbook, and it will sometimes get a Czech form wrong. Treat the [grammar notes](/grammar/) as the reference and the tutor as a patient study partner.

## Two ways to run it

### In this browser (default)

The model runs on your computer's graphics chip through WebGPU. Nothing you type leaves your machine.

1. Open the tutor, pick a model and press **Download and start**.
2. The files are downloaded once and stored in your browser. After that the tutor starts from that copy, with no internet needed.
3. To use the whole site offline, visit it once while connected so the pages are saved too.

| Model | Good for | GPU memory |
| --- | --- | --- |
| Light (Gemma 3 1B) | Quick, short explanations on modest laptops | about 0.7 GB |
| Balanced (Gemma 2 2B) | Everyday use. The best place to start | about 1.9 GB |
| Strong (Qwen 2.5 3B) | Longer explanations, on a recent laptop with 8 GB of RAM or more | about 2.5 GB |

You need a browser with WebGPU: recent Chrome or Edge on Windows, macOS, Linux and ChromeOS work. Safari 26 and newer also has it. Firefox support depends on the version and platform, so if the tutor says WebGPU is missing, try Chrome or Edge, or use Ollama below.

### Ollama on your computer

If you already use [Ollama](https://ollama.com), the tutor can talk to it instead. This gives you access to larger models and works in any browser.

1. Install Ollama and download a model, for example `ollama pull gemma3:4b`.
2. Start Ollama so that this site is allowed to connect to it: `OLLAMA_ORIGINS="*" ollama serve`. On macOS and Windows, set the `OLLAMA_ORIGINS` environment variable and restart the Ollama app instead.
3. In the tutor, choose **Ollama**, check the address and model name, and press **Connect**.

## What it can and can't do

- It answers in English and shows Czech with its diacritics.
- It can read the grammar page you have open: use **Explain this page** or **Quiz me on this page**.
- It remembers the last few messages, not the whole conversation, because small models have a short memory.
- It can be confidently wrong. If an answer disagrees with the notes, trust the notes and check with your teacher.

## Troubleshooting

**"This browser does not offer WebGPU."** Use a current Chrome or Edge, or switch to Ollama.

**"The GPU ran out of memory."** Close other tabs and pick the Light model.

**The download stalls.** The first download is large. If your connection drops, press the button again: files already fetched are kept.

**Ollama says it can't be reached.** Check that it is running and that `OLLAMA_ORIGINS` includes this site's address.

**I want the disk space back.** Open the tutor, then the model settings, and choose **Delete downloaded models**.
