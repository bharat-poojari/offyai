<p align="center">
  <img
    src="https://raw.githubusercontent.com/bharat-poojari/offyai/main/offyai.png"
    alt="OffyAI"
    width="600"
  />
</p>

<h1 align="center">OffyAI</h1>

<p align="center">
  <strong>Private. Fast. Local. Yours.</strong>
</p>

<p align="center">
  A modern local-first AI desktop application for running and interacting with local Large Language Models.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/AI-Local-blue" alt="Local AI">
  <img src="https://img.shields.io/badge/Platform-Windows-lightgrey" alt="Windows">
  <img src="https://img.shields.io/badge/Status-Active%20Development-orange" alt="Active Development">
</p>

---
# OffyAI

> **Private. Fast. Local. Yours.**

OffyAI is a modern **local-first AI desktop application** that brings a ChatGPT-like experience to your computer while keeping your AI workloads close to you.

It is designed for users who want to **run, manage, and interact with local Large Language Models (LLMs)** through a clean desktop interface without depending entirely on cloud-based AI services.

---

## ✨ Highlights

- 🖥️ **Modern desktop AI interface**
- 🔒 **Local-first AI experience**
- 🤖 **Local LLM support**
- 📦 **Model management**
- 💬 **ChatGPT-like conversations**
- ⚡ **Performance monitoring**
- 🧠 **Configurable inference settings**
- 💾 **Local conversation/application data**
- 🧩 **Designed for extensibility**
- 🚀 **Standalone Windows application support**
- 🛠️ **Developer-friendly architecture**

---

## 🎯 Why OffyAI?

Cloud AI is powerful, but it is not always the right solution.

OffyAI focuses on giving users more control over their AI environment:

| Feature | OffyAI |
|---|---|
| Local AI models | ✅ |
| Cloud-independent inference | ✅ |
| Local-first workflow | ✅ |
| Chat interface | ✅ |
| Model management | ✅ |
| Performance visibility | ✅ |
| Desktop application | ✅ |
| Internet required for every chat | ❌ |
| Data-dependent on cloud inference | ❌ |

> **Your computer. Your models. Your conversations. Your control.**

---

## 🧠 Local AI

OffyAI is built around the concept of running AI models locally.

Depending on the model and runtime configuration, local inference can provide:

- Better privacy
- Offline usage
- Lower dependency on external APIs
- Greater control over models
- Predictable local resource usage
- Experimentation with different open models

### Model Selection

The performance of a local model depends heavily on:

- CPU
- GPU
- VRAM
- RAM
- Model architecture
- Quantization
- Context length
- Number of inference threads
- Runtime configuration

For the best experience, use a model appropriate for your system hardware.

---

# 🚀 Getting Started

## 1. Download OffyAI

Download the latest release from the project's GitHub Releases page.

After downloading the Windows executable:

1. Download the latest `.exe`.
2. Place it in a convenient location.
3. Launch OffyAI.
4. Configure your local model/runtime.
5. Start a conversation.

---

## 2. First Launch

On the first launch, OffyAI may initialize its local application environment.

Depending on the installed version, this can include:

- Application configuration
- Local storage
- Model configuration
- Conversation data
- Runtime settings
- Performance preferences

---

## 3. Select a Model

Choose a compatible local model from the model-management interface.

When selecting a model, consider:

### RAM

Larger models generally require more system memory.

### VRAM

GPU acceleration can significantly improve inference performance when supported.

### Quantization

Quantized models reduce memory requirements and can make larger models practical on consumer hardware.

Common quantization levels include:

- `Q2`
- `Q3`
- `Q4`
- `Q5`
- `Q6`
- `Q8`

The exact performance and quality trade-off depends on the model and runtime.

---

# 💻 System Requirements

Actual requirements depend on the model being used.

### Minimum

A practical minimum configuration may include:

- Windows 10/11
- 8 GB RAM
- Modern x64 CPU
- Sufficient storage for models

### Recommended

For a smoother local AI experience:

- Windows 11
- 16 GB+ RAM
- Modern multi-core CPU
- SSD
- Dedicated GPU when supported
- 20 GB+ available storage for multiple models

> **Important:** Model requirements can be substantially higher than application requirements. A model's size, quantization, context length, and runtime determine its actual resource consumption.

---

# ⚙️ Performance

OffyAI provides performance visibility so users can understand how their local AI workload is behaving.

Depending on the version, performance information may include:

- CPU utilization
- RAM utilization
- GPU utilization
- VRAM usage
- Model loading state
- Generation speed
- Token throughput
- Response latency
- Runtime status

Performance varies significantly between hardware configurations.

---

# 🧩 Architecture

OffyAI is designed around a desktop application architecture with separate concerns for the user interface, application logic, local AI execution, storage, and system monitoring.

A simplified architecture:

```text
┌──────────────────────────────────────────────┐
│                  OffyAI UI                   │
│                                              │
│  Chat │ Models │ Settings │ Performance     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              Application Layer               │
│                                              │
│  Conversation Management                    │
│  Model Configuration                         │
│  Runtime Configuration                        │
│  Application Settings                         │
└──────────────────────┬───────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Local Model  │ │ Local Storage│ │ Performance  │
│ Runtime      │ │              │ │ Monitoring   │
└──────────────┘ └──────────────┘ └──────────────┘
          │
          ▼
┌──────────────────────────────────────────────┐
│              Local AI Models                 │
│                                              │
│          GGUF / Compatible Models            │
└──────────────────────────────────────────────┘
```

---

# 📦 Model Management

OffyAI is intended to simplify working with local AI models.

Typical model-management operations may include:

- Adding models
- Selecting models
- Removing models
- Switching between models
- Configuring model parameters
- Monitoring model loading
- Managing model storage

## GGUF Models

OffyAI can be used with compatible GGUF-based local models when supported by the configured inference runtime.

GGUF is commonly used for efficient local inference because it supports quantized model formats suitable for consumer hardware.

---

# 💬 Chat

OffyAI provides a conversational interface for interacting with local models.

Typical capabilities include:

- New conversations
- Conversation history
- User prompts
- Model responses
- Multi-turn conversations
- Configurable generation parameters
- Local conversation persistence

The quality of responses depends primarily on the selected model and inference configuration.

---

# 🔧 Configuration

Depending on the release, OffyAI may expose settings for:

- Model selection
- Temperature
- Context length
- Maximum output tokens
- CPU threads
- GPU layers
- Sampling parameters
- System prompts
- Interface preferences
- Storage configuration

### Temperature

Controls randomness in generated responses.

Lower values generally produce more deterministic responses.

Higher values generally produce more varied responses.

### Context Length

Determines how much conversation/context the model can process.

Larger context windows generally require more memory.

### CPU Threads

Controls the amount of CPU parallelism used during inference when supported by the runtime.

### GPU Layers

When GPU acceleration is supported, increasing GPU offload can improve performance but requires sufficient VRAM.

---

# 🔐 Privacy

Privacy is a core design principle of OffyAI.

The local-first architecture is intended to minimize the need to send prompts and conversations to external AI services.

When using a fully local model/runtime:

```text
User
  │
  ▼
OffyAI
  │
  ▼
Local Runtime
  │
  ▼
Local Model
  │
  ▼
Response
```

No external AI API is inherently required for the local inference path.

> **Important:** Privacy characteristics depend on the specific OffyAI version, enabled integrations, update mechanisms, and any external services configured by the user.

---

# 🌐 Internet Connectivity

OffyAI is designed primarily around local AI workloads.

An internet connection may still be useful or required for features such as:

- Downloading the application
- Downloading models
- Checking releases
- Updating the application
- Accessing external integrations
- Repository access

Once the required local model and runtime are available, local inference can operate without sending every prompt to a cloud AI provider.

---

# 🗂️ Local Data

OffyAI may maintain local application data such as:

- Conversations
- Preferences
- Model configuration
- Runtime settings
- Application state
- Cached information

The exact storage location and data structure depend on the application version.

---

# 🧹 Clearing Local Application Data

If OffyAI provides a reset or clear-data option, use that option when available.

For manual troubleshooting, application-local data may need to be removed from the application's configured storage directory.

> **Warning:** Clearing application data can permanently remove local conversations, preferences, cached information, or other stored state. Back up important data before deleting application files.

---

# 🛠️ Troubleshooting

## Application does not start

Try:

1. Restarting OffyAI.
2. Running the latest release.
3. Checking Windows security/antivirus notifications.
4. Verifying that required runtime files are present.
5. Checking application logs if available.
6. Reinstalling the application if necessary.

---

## Model does not load

Check:

- Model file integrity
- Available RAM
- Available VRAM
- Model compatibility
- Quantization
- Context length
- GPU configuration
- Runtime compatibility

Large models can fail to load when insufficient system memory is available.

---

## Generation is slow

Possible causes include:

- CPU-only inference
- Insufficient GPU acceleration
- Large model size
- High context length
- High output length
- Low CPU thread utilization
- Insufficient RAM/VRAM
- Model quantization

Try a smaller or more aggressively quantized model if hardware resources are limited.

---

## High memory usage

Large language models can consume substantial amounts of RAM and VRAM.

Consider:

- Using a smaller model
- Using a lower quantization
- Reducing context length
- Reducing concurrent workloads
- Closing unnecessary applications
- Using GPU offloading where supported

---

# 🧪 Development

If you want to contribute to OffyAI, clone the repository and follow the project's development instructions.

```bash
git clone <YOUR_REPOSITORY_URL>
cd OffyAI
```

Install the project's dependencies according to the technology stack used by the current release.

Then start the development environment using the project's configured development command.

> Development commands may change between releases. Refer to the repository configuration and project documentation for the current commands.

---

# 🏗️ Building OffyAI

The release process generally consists of:

```text
Source Code
     │
     ▼
Dependency Installation
     │
     ▼
Application Build
     │
     ▼
Packaging
     │
     ▼
Windows Executable
     │
     ▼
GitHub Release
```

Before publishing a release, verify:

- Application starts correctly
- Models load correctly
- Chat functionality works
- Settings persist correctly
- Local storage works
- Performance monitoring works
- No development-only files are included
- Required runtime files are packaged
- Windows executable launches on a clean system

---

# 📋 Release Checklist

Use this checklist before publishing a new OffyAI release:

```text
[ ] Update application version
[ ] Test application startup
[ ] Test model loading
[ ] Test chat generation
[ ] Test conversation persistence
[ ] Test settings
[ ] Test model management
[ ] Test performance monitoring
[ ] Test application reset/clear-data behavior
[ ] Build production executable
[ ] Test executable on a clean Windows environment
[ ] Update release notes
[ ] Create GitHub release
[ ] Upload executable
[ ] Verify download
```

---

# 🗺️ Roadmap

Potential future improvements include:

- [ ] Improved model discovery
- [ ] One-click model installation
- [ ] More inference runtimes
- [ ] Better GPU acceleration
- [ ] Advanced performance analytics
- [ ] Conversation search
- [ ] Conversation export/import
- [ ] Custom system prompts
- [ ] Model benchmarking
- [ ] Model comparison
- [ ] Plugin/integration architecture
- [ ] Improved model metadata
- [ ] Automatic update support
- [ ] Cross-platform support

> The roadmap is subject to change based on development priorities.

---

# 🤝 Contributing

Contributions are welcome.

Before submitting a pull request:

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Test the changes locally.
5. Keep commits focused.
6. Update documentation where necessary.
7. Submit a pull request.

Example:

```bash
git checkout -b feature/my-feature
git add .
git commit -m "Add my feature"
git push origin feature/my-feature
```

Then open a pull request against the main development branch.

---

# 🐛 Bug Reports

When reporting a bug, include as much useful information as possible.

### Recommended information

- OffyAI version
- Windows version
- CPU
- GPU
- RAM
- Model name
- Model quantization
- Runtime configuration
- Steps to reproduce
- Expected behavior
- Actual behavior
- Error message
- Relevant logs/screenshots

A good bug report makes the issue easier to reproduce and resolve.

---

# 🔒 Security

If you discover a security vulnerability, avoid publicly posting sensitive exploit details before the issue can be assessed.

Report security issues through the project's designated security contact or GitHub Security Advisory process.

---

# 📄 License

This project is distributed under the license specified in the repository.

See the [`LICENSE`](LICENSE) file for the complete license terms.

---

# 👨‍💻 Author

**OffyAI**

A local-first AI desktop application focused on:

> **Privacy • Performance • Control • Simplicity**

---

# ⭐ Support the Project

If you find OffyAI useful:

- ⭐ Star the repository
- 🐛 Report bugs
- 💡 Suggest features
- 🔧 Contribute improvements
- 📢 Share the project

Every contribution helps improve the project.

---

# 📌 Project Status

**Status:** Active Development

OffyAI is continuously evolving. Features, interfaces, model compatibility, and system requirements may change between releases.

For the latest information, always refer to the current GitHub repository and release notes.

---

## OffyAI

**Local AI. Simplified.**

> Run AI locally.  
> Keep control locally.  
> Build without unnecessary cloud dependency.
