#!/bin/bash
# chmod +x start.sh

echo "=========================================================="
echo "AIOM -- a platform of Markov Chain Monte Carlo with People"
echo "=========================================================="

# Make script terminate on errors
set -e

# Change to the script's directory
cd "$(dirname "$0")"

# Check if Node.js is installed
echo "Checking if Node.js is installed..."
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed or not in PATH. Please install Node.js."
    echo "Visit https://nodejs.org/en/download/ to download and install Node.js."
    read -p "Press Enter to exit..."
    exit 1
fi

echo "Node.js is installed:"
node --version

# Check if required npm packages are installed
echo "Checking required npm packages..."

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Please make sure you're running this script from the project root directory."
    read -p "Press Enter to exit..."
    exit 1
fi

# Install dependencies if node_modules doesn't exist or if force install is needed
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Failed to install dependencies."
        read -p "Press Enter to exit..."
        exit 1
    fi
else
    echo "Dependencies already installed. Checking for updates..."
    npm ci
fi

# Check if Docker is installed
echo "Checking if Docker is installed..."
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed or not in PATH. Please install Docker Desktop."
    echo "Visit https://www.docker.com/products/docker-desktop/ to download and install Docker Desktop."
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if Docker is running
echo "Checking if Docker is running..."
if ! docker info &> /dev/null; then
    echo "Docker is not running. Starting Docker Desktop..."
    
    # Different ways to start Docker depending on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        open -a Docker
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux - might need sudo
        if command -v systemctl &> /dev/null; then
            sudo systemctl start docker
        else
            echo "Could not automatically start Docker. Please start Docker manually."
            read -p "Press Enter when Docker is started..."
        fi
    fi
    
    # Wait for Docker to start
    echo "Waiting for Docker to start..."
    while ! docker info &> /dev/null; do
        echo "Waiting..."
        sleep 5
    done
    
    echo "Docker started successfully."
else
    echo "Docker is already running."
fi

echo "===================================================="
echo "All checks completed. Starting the Electron app..."
echo "===================================================="

# Start Electron app
# npx electron gui/GUI-main.js
nohup npx electron gui/GUI-main.js > /dev/null 2>&1 &

# Note: In Unix-like systems, the terminal window will stay open while the app is running
# The process is attached to the terminal, so closing the terminal will close the app
# If you want to detach it completely, you could use:
# nohup npx electron gui/GUI-main.js > /dev/null 2>&1 &