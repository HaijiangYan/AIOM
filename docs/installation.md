# Installation

## System Requirements

AIOM requires the following software to be installed on your system:

- **Node.js**: Version 16.0 or higher
- **npm**: Version 7.0 or higher (or yarn 1.20+)
- **Git**: For version control and deployment
- **Operating System**: Windows 10+, macOS 10.15+, or Linux

## Installation Methods

### NPM Installation (Recommended)

Install AIOM globally for CLI access:

```bash
npm install -g aiom
```

Or install locally for your project:

```bash
npm install aiom
```

### Yarn Installation

```bash
# Global installation
yarn global add aiom

# Local installation
yarn add aiom
```

### Development Installation

For contributing to AIOM or using the latest features:

```bash
# Clone the repository
git clone https://github.com/HaijiangYan/AIOM.git
cd AIOM

# Install dependencies
npm install

# Build the project
npm run build

# Link for global use
npm link
```

## Verification

Verify your installation:

```bash
# Check AIOM version
aiom --version

# Test basic functionality
aiom init test-experiment
cd test-experiment
aiom serve
```

Expected output:
```
AIOM v1.0.0
Creating new experiment: test-experiment
✓ Project structure created
✓ Dependencies installed
✓ Development server started at http://localhost:3000
```

## Additional Dependencies

### For Advanced Features

```bash
# For advanced statistical analysis
npm install -g r-script python

# For video/audio processing
npm install ffmpeg-static

# For advanced visualizations
npm install d3 chart.js
```

### Platform-Specific Setup

#### Windows
```bash
# Install Windows Build Tools
npm install -g windows-build-tools
```

#### macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install
```

#### Linux (Ubuntu/Debian)
```bash
# Install build essentials
sudo apt-get install build-essential
```

## Configuration

### Global Configuration

Create a global configuration file:

```bash
aiom config init
```

This creates `~/.aiom/config.json`:

```json
{
  "defaultPlatform": "local",
  "dataDirectory": "~/aiom-data",
  "backupEnabled": true,
  "analytics": {
    "enabled": true,
    "anonymous": true
  },
  "deployment": {
    "defaultRegion": "us-east-1",
    "autoSSL": true
  }
}
```

### Project Configuration

For each experiment project, AIOM creates `aiom.config.js`:

```javascript
module.exports = {
  experiment: {
    title: "My Experiment",
    version: "1.0.0",
    description: "A behavioral experiment using AIOM"
  },
  server: {
    port: 3000,
    host: "localhost"
  },
  data: {
    format: "json",
    backup: true,
    encryption: true
  },
  deployment: {
    platform: "heroku",
    domain: null,
    ssl: true
  }
};
```

## Troubleshooting

### Common Installation Issues

#### Node.js Version Issues
```bash
# Check your Node.js version
node --version

# Use Node Version Manager to switch versions
nvm install 18
nvm use 18
```

#### Permission Issues (macOS/Linux)
```bash
# Fix npm permissions
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
```

#### Network/Firewall Issues
```bash
# Configure npm registry
npm config set registry https://registry.npmjs.org/

# Use alternative registry if needed
npm config set registry https://registry.npm.taobao.org/
```

#### Windows PowerShell Issues
```powershell
# Enable script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Verification Commands

```bash
# Test all components
aiom doctor

# Check system compatibility
aiom system-check

# Test deployment capabilities
aiom deploy --dry-run
```

## Next Steps

After installation:

1. [Create your first experiment](quick-start.md)
2. [Explore example experiments](examples/basic.md)
3. [Learn about deployment options](guides/deployment.md)
4. [Set up data collection](guides/data-management.md)

## Getting Help

If you encounter issues:

1. Check the [Troubleshooting Guide](guides/troubleshooting.md)
2. Search [existing issues](https://github.com/HaijiangYan/AIOM/issues)
3. Join our [Discord community](https://discord.gg/aiom)
4. Email support: [support@aiom.dev](mailto:support@aiom.dev)