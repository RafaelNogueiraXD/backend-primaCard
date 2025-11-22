#!/bin/bash

# PrimaCard Backend - Quick Setup Script

echo "🚀 PrimaCard Backend - Quick Setup"
echo "=================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configurations before continuing!"
    echo ""
    read -p "Press enter after editing .env file..."
fi

# Generate Prisma Client
echo ""
echo "🔧 Generating Prisma Client..."
npm run prisma:generate

# Ask if user wants to run migrations
echo ""
read -p "Do you want to run database migrations? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗄️  Running database migrations..."
    npm run prisma:migrate
fi

# Ask if user wants to seed database
echo ""
read -p "Do you want to seed the database with initial data? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌱 Seeding database..."
    npm run prisma:seed
    
    echo ""
    echo "✅ Database seeded with test data:"
    echo "   Admin: admin@primacard.com / Admin123!@#"
    echo "   Professional: dra.silva@primacard.com / Dentista123!"
    echo "   Patient: joao.santos@email.com / Paciente123!"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the development server, run:"
echo "  npm run dev"
echo ""
echo "Then access:"
echo "  - API: http://localhost:3000"
echo "  - Swagger Docs: http://localhost:3000/api-docs"
echo "  - Health Check: http://localhost:3000/health"
echo ""
