FROM node:18-bullseye-slim

# Install system dependencies including Tesseract OCR, Python3, and graphics libraries for Paddle/DeepFace
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set up directory structure
WORKDIR /app

# Copy lock files and packages
COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies for both frontend and backend
RUN npm run install-all

# Copy all source files
COPY . .

# Build frontend production files and download face-api models
RUN npm run build-all

# Expose backend API and frontend static server port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Command to run on start
CMD ["npm", "start"]
