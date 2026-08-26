# OffyAI - Modern AI Web UI with llama.cpp

![OffyAI](https://img.shields.io/badge/OffyAI-v1.0.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-16%2B-green)
![React](https://img.shields.io/badge/React-18-blue)
![llama.cpp](https://img.shields.io/badge/llama.cpp-compatible-orange)

A complete, production-ready AI web interface with real-time monitoring, chat history, and seamless integration with llama.cpp. OffyAI provides a ChatGPT-like experience with advanced performance metrics and a beautiful, responsive interface.

![OffyAI Demo](https://via.placeholder.com/800x400/1f2937/ffffff?text=OffyAI+Demo+Screenshot)

## ✨ Features

- **🤖 AI Chat Interface**: ChatGPT-like conversation experience
- **📊 Real-time Monitoring**: CPU, Memory, GPU, Tokens/sec, Response time
- **📈 Interactive Charts**: Live performance metrics and token distribution
- **💾 Persistent History**: LocalStorage-based chat history with multiple sessions
- **🎨 Modern UI**: Clean, responsive design with Tailwind CSS
- **🔌 llama.cpp Integration**: Seamless integration with local AI models
- **📱 Mobile Responsive**: Works perfectly on desktop and mobile devices
- **⚡ Fast & Lightweight**: Optimized for performance

## 🏗️ Architecture

```
OffyAI/
├── 🖥️ Frontend (Next.js + React + Tailwind)
├── 🔧 Backend (Node.js + Express)
├── 🤖 Llama Server (llama.cpp)
└── 🗃️ Local Storage (Chat History)
```

## 📋 Prerequisites

- **Node.js** 16.0 or higher
- **npm** or **yarn**
- **llama.cpp** server binary
- **AI Model** (GGUF format) in `./models/` directory

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# 1. Clone or download OffyAI
# 2. Navigate to the project directory
cd offyai

# 3. Install dependencies
./install-offyai.sh

# 4. Start all servers
npm start
```

### Option 2: Manual Setup

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Install frontend dependencies  
cd ../frontend
npm install

# 3. Start llama server (in separate terminal)
./llama-server -m ./models/your-model.gguf -c 4096 --port 8080 --api-key your-key

# 4. Start backend (in separate terminal)
cd backend
npm run dev

# 5. Start frontend (in separate terminal)
cd frontend
npm run dev
```

## 🎯 Usage

### Starting the Application

```bash
# Using Node.js script (Cross-platform)
npm start

# Using Bash script (Linux/Mac)
./start-offyai.sh

# Using Batch script (Windows)
start-offyai.bat
```

### Access Points

- **🌐 Web Interface**: http://localhost:3000
- **🔧 API Backend**: http://localhost:3001
- **🤖 Llama Server**: http://localhost:8080

### Stopping Servers

Press `Ctrl+C` in the terminal where servers are running.

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
PORT=3001
LLAMA_SERVER_URL=http://localhost:8080
LLAMA_API_KEY=your-secret-key
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### Model Configuration

Place your GGUF model files in the `./models/` directory:

```bash
# Example model structure
models/
└── gpt2-124m-fresh-Q8_0.gguf
```

### Llama Server Command

```bash
./llama-server \
  -m ./models/your-model.gguf \
  -c 4096 \               # Context length
  --port 8080 \           # Server port
  --api-key your-key \    # Authentication key
  --no-warmup            # Disable warmup for faster startup
```

## 🎨 UI Overview

### Chat Interface
- 💬 Conversation panel with message history
- ⌨️ Message input with keyboard shortcuts
- ⚡ Real-time typing indicators
- 🗑️ Individual message management

### Monitoring Dashboard
- 📊 Live performance metrics (CPU, Memory, GPU)
- ⏱️ Response time and token statistics
- 📈 Interactive charts and graphs
- 🔄 Auto-refresh every 3 seconds

### Sidebar Features
- ➕ New chat creation
- 📋 Chat history with search
- 🗂️ Multiple conversation sessions
- ⚙️ Settings and configuration
- 📱 Responsive collapsible design

## 🔧 API Endpoints

### Chat API
- `POST /api/chat` - Send message to AI
- `GET /api/chat/history` - Get chat history
- `DELETE /api/chat/history` - Clear history

### Metrics API
- `GET /api/metrics/realtime` - Real-time system metrics
- `GET /api/metrics/history` - Historical metrics data

### Models API
- `GET /api/models` - List available models
- `POST /api/models/active` - Set active model

## 🗃️ Data Storage

### Chat History Storage
```javascript
// LocalStorage structure
{
  "offyai_chat_sessions": [
    {
      "id": 1234567890,
      "title": "Conversation about AI",
      "messages": [...],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:30:00.000Z"
    }
  ]
}
```

### Settings Storage
```javascript
{
  "offyai_settings": {
    "apiKey": "your-api-key",
    "model": "gpt2-124m-fresh-Q8_0",
    "serverUrl": "http://localhost:8080"
  }
}
```

## 🛠️ Development

### Project Structure

```
offyai/
├── 📁 frontend/                 # Next.js React application
│   ├── 📁 components/           # React components
│   ├── 📁 pages/               # Next.js pages
│   ├── 📁 hooks/               # Custom React hooks
│   ├── 📁 utils/               # Utility functions
│   └── 📁 styles/              # CSS/Tailwind styles
├── 📁 backend/                  # Express.js API server
│   ├── 📁 routes/              # API routes
│   ├── 📁 middleware/          # Express middleware
│   └── 📁 utils/               # Server utilities
├── 📄 start-offyai.js          # Main startup script
├── 📄 start-offyai.sh          # Bash startup script
├── 📄 start-offyai.bat         # Windows startup script
└── 📄 install-offyai.sh        # Dependency installer
```

### Building for Production

```bash
# Build frontend
cd frontend
npm run build

# Start production backend
cd ../backend
npm start
```

### Customization

#### Adding New Models
1. Add model to `frontend/utils/constants.js`
2. Update model selection in Settings modal
3. Add model-specific configuration if needed

#### Modifying UI
- Edit components in `frontend/components/`
- Modify styles in `frontend/styles/globals.css`
- Update Tailwind config in `frontend/tailwind.config.js`

#### API Extensions
- Add new routes in `backend/routes/`
- Update API client in `frontend/utils/api.js`

## 🐛 Troubleshooting

### Common Issues

**Llama server not starting:**
```bash
# Check if binary is executable
chmod +x llama-server

# Check model file exists
ls -la ./models/
```

**Port already in use:**
```bash
# Find processes using ports
lsof -i :3000 # Frontend
lsof -i :3001 # Backend  
lsof -i :8080 # Llama
```

**Dependency issues:**
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Debug Mode

Enable debug logging by setting environment variable:
```bash
DEBUG=offyai:* npm start
```

## 📊 Performance Tips

1. **Use quantized models** (Q4_K_M, Q8_0) for better performance
2. **Adjust context length** based on available memory
3. **Enable GPU acceleration** if available
4. **Monitor memory usage** with large models
5. **Use `--no-warmup`** for faster server startup

## 🔒 Security

- API key authentication for llama.cpp
- CORS protection for cross-origin requests
- Rate limiting on API endpoints
- Input sanitization and validation
- Secure LocalStorage usage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [llama.cpp](https://github.com/ggerganov/llama.cpp) - AI inference engine
- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [React](https://reactjs.org/) - UI library
- [Express.js](https://expressjs.com/) - Web framework

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Search existing [GitHub Issues](https://github.com/your-username/offyai/issues)
3. Create a new issue with detailed information

## 🚀 Future Roadmap

- [ ] Multi-user support
- [ ] Model fine-tuning interface
- [ ] Plugin system for extensions
- [ ] Advanced prompt engineering tools
- [ ] Cloud synchronization
- [ ] Voice input/output support
- [ ] Multi-modal capabilities (images, audio)

---

**OffyAI** - Making AI accessible and monitorable for everyone. 🚀

*Built with ❤️ using modern web technologies and llama.cpp*