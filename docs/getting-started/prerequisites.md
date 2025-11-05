# Prerequisites

This guide covers all the tools and software you need to install before you can start developing with Hospeda.

---

## System Requirements

### Operating System

Hospeda is tested and supported on:

- **Linux**: Ubuntu 20.04+, Debian 11+, Fedora 36+
- **macOS**: 12 (Monterey) or later
- **Windows**: 10/11 with WSL 2

### Hardware

- **RAM**: 8GB minimum, 16GB recommended
- **Disk Space**: 10GB free space minimum
- **CPU**: 2 cores minimum, 4 cores recommended

---

## Required Tools

### 1. Node.js (≥18)

Node.js is required for running the development server, build tools, and package management.

#### Verify Node.js

```bash
node --version  # Should be ≥18.0.0
```

#### Install Node.js

##### macOS

```bash
brew install node@20
```

##### Ubuntu/Debian

```bash
# Install via NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

##### Fedora

```bash
sudo dnf install nodejs
```

##### Windows (Node.js)

1. Download installer from [nodejs.org](https://nodejs.org/)
2. Run installer and follow prompts
3. Restart terminal

##### Using nvm (Alternative)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js
nvm install 20
nvm use 20
```

---

### 2. pnpm (≥9)

pnpm is our package manager - faster and more efficient than npm.

#### Verify pnpm

```bash
pnpm --version  # Should be ≥9.0.0
```

#### Install pnpm

##### Via npm

```bash
npm install -g pnpm@latest
```

##### macOS (brew)

```bash
brew install pnpm
```

##### Linux/macOS

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

##### Windows (pnpm)

```powershell
iwr https://get.pnpm.io/install.ps1 -useb | iex
```

---

### 3. Docker & Docker Compose

Docker is used for running PostgreSQL and Redis in development.

#### Verify Docker

```bash
docker --version         # Should be ≥20.10
docker compose version   # Should be ≥2.0
```

#### Install Docker

##### macOS (Docker)

```bash
brew install --cask docker
```

Then start Docker Desktop from Applications.

##### Ubuntu/Debian (Docker)

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (avoid sudo)
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt-get install docker-compose-plugin

# Logout and login for group changes to take effect
```

##### Windows (Docker)

1. Download [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. Run installer
3. Enable WSL 2 integration when prompted
4. Restart computer

#### Verify Docker Installation

Verify Docker is running:

```bash
docker info
docker compose version
```

---

### 4. PostgreSQL

You have three options for PostgreSQL:

#### Option A: Docker (Recommended)

Already covered above - PostgreSQL will run in Docker.

**Pros:**

- Easy setup
- Isolated from system
- No conflicts with other projects

**Cons:**

- Requires Docker running
- Slightly more resource usage

#### Option B: Local Installation

##### macOS (PostgreSQL)

```bash
brew install postgresql@15
brew services start postgresql@15
```

##### Ubuntu/Debian (PostgreSQL)

```bash
sudo apt-get install postgresql-15
sudo systemctl start postgresql
```

##### Windows (PostgreSQL)

Download installer from [postgresql.org](https://www.postgresql.org/download/windows/)

#### Option C: Neon Cloud (For Remote Development)

1. Create account at [neon.tech](https://neon.tech/)
2. Create new project
3. Copy connection string
4. Update `.env.local` with your connection string

**Pros:**

- No local installation
- Accessible from anywhere
- Free tier available

**Cons:**

- Requires internet connection
- Potential latency

---

### 5. Git

Required for version control.

#### Verify Git

```bash
git --version  # Should be ≥2.30
```

#### Install Git

##### macOS (Git)

```bash
brew install git
```

##### Ubuntu/Debian (Git)

```bash
sudo apt-get install git
```

##### Windows (Git)

Download from [git-scm.com](https://git-scm.com/download/win)

#### Configure Git

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

### 6. Code Editor

#### VSCode (Recommended)

Download from [code.visualstudio.com](https://code.visualstudio.com/)

**Required Extensions:**

- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- Biome (`biomejs.biome`)
- Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`)

**Recommended Extensions:**

- GitLens (`eamodio.gitlens`)
- Error Lens (`usernamehw.errorlens`)
- Path Intellisense (`christian-kohler.path-intellisense`)
- Auto Rename Tag (`formulahendry.auto-rename-tag`)

**Install extensions via command line:**

```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension biomejs.biome
code --install-extension bradlc.vscode-tailwindcss
```

#### Alternative Editors

- **WebStorm**: Full support, built-in tools
- **Vim/Neovim**: Configure with LSP support
- **Sublime Text**: Install Package Control + packages

---

## Optional Tools

### pgAdmin (Database GUI)

Graphical interface for PostgreSQL management.

```bash
# Will be available via Docker Compose
pnpm pgadmin:start
# Access at: http://localhost:8080
```

### Postman/Insomnia (API Testing)

For testing API endpoints during development.

- [Postman](https://www.postman.com/downloads/)
- [Insomnia](https://insomnia.rest/download)

### Redis CLI

For debugging Redis cache issues.

```bash
# macOS
brew install redis

# Linux
sudo apt-get install redis-tools
```

---

## Verification Checklist

Run these commands to verify everything is installed correctly:

```bash
# Node.js and pnpm
node --version        # ≥18.0.0
pnpm --version        # ≥9.0.0

# Docker
docker --version      # ≥20.10
docker compose version # ≥2.0
docker info           # Should show server running

# Git
git --version         # ≥2.30

# Editor
code --version        # VSCode version
```

**All green?** → Continue to [Installation](installation.md)

**Any red?** → See [Troubleshooting](#troubleshooting) below

---

## Troubleshooting

### Node.js Issues

**Problem**: `node: command not found`

**Solution**:

```bash
# Verify installation path
which node

# If using nvm, activate it
nvm use 20

# Add to PATH (Linux/macOS)
export PATH="$PATH:/usr/local/bin"
```

---

**Problem**: Wrong Node.js version

**Solution**:

```bash
# Using nvm
nvm install 20
nvm use 20
nvm alias default 20

# Or reinstall
```

---

### pnpm Issues

**Problem**: `pnpm: command not found`

**Solution**:

```bash
# Reinstall via npm
npm install -g pnpm@latest

# Verify pnpm directory is in PATH
echo $PATH | grep pnpm

# Add to PATH if needed (Linux/macOS)
export PATH="$HOME/.local/share/pnpm:$PATH"
```

---

**Problem**: Permission errors on Linux

**Solution**:

```bash
# Use npm to install globally without sudo
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
npm install -g pnpm
```

---

### Docker Issues

**Problem**: `Cannot connect to Docker daemon`

**Solution**:

```bash
# Start Docker Desktop (macOS/Windows)
# Or start Docker service (Linux)
sudo systemctl start docker

# Verify
docker info
```

---

**Problem**: Permission denied (Linux)

**Solution**:

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login, or use:
newgrp docker
```

---

**Problem**: Port conflicts (5432, 6379)

**Solution**:

```bash
# Check what's using the port
sudo lsof -i :5432
sudo lsof -i :6379

# Stop conflicting service
sudo systemctl stop postgresql
sudo systemctl stop redis

# Or modify docker-compose.yml ports
```

---

### Git Issues

**Problem**: Git authentication fails

**Solution**:

```bash
# Set up SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"
cat ~/.ssh/id_ed25519.pub  # Add to GitHub

# Or use HTTPS with token
git config --global credential.helper store
```

---

### VSCode Issues

**Problem**: Extensions not working

**Solution**:

1. Reload VSCode: `Cmd/Ctrl + Shift + P` → "Reload Window"
2. Check extension compatibility
3. Update VSCode to latest version

---

**Problem**: TypeScript errors in editor

**Solution**:

1. Select TypeScript version: `Cmd/Ctrl + Shift + P` → "TypeScript: Select TypeScript Version"
2. Choose "Use Workspace Version"
3. Restart VSCode

---

### Platform-Specific Issues

#### Windows/WSL

**Problem**: Line endings (CRLF vs LF)

**Solution**:

```bash
# Configure Git
git config --global core.autocrlf input

# Convert existing files
dos2unix file.txt
```

---

**Problem**: Slow file operations in WSL

**Solution**:

- Keep project files inside WSL filesystem (`~/projects/`)
- Don't work on Windows drives (`/mnt/c/`)

---

#### macOS Issues

**Problem**: Homebrew not found

**Solution**:

```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Add to PATH
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
```

---

#### Linux Issues

**Problem**: Snap packages conflict

**Solution**:

```bash
# Remove snap version
sudo snap remove node

# Install via NodeSource instead
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## Getting Help

If you're still having issues after trying the troubleshooting steps:

1. Check [Common Issues](../resources/troubleshooting.md)
2. Search [GitHub Discussions](https://github.com/qazuor/hospeda/discussions)
3. Ask in [GitHub Discussions Q&A](https://github.com/qazuor/hospeda/discussions/categories/q-a)
4. [Open an issue](https://github.com/qazuor/hospeda/issues/new) if you found a bug

---

**Everything working?** → Continue to [Installation](installation.md)
