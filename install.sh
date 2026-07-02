#!/bin/bash

# RaffleVault Installer — Linux / macOS

clear
echo ""
echo "  ================================================"
echo "        Welcome to RaffleVault Installer"
echo "  ================================================"
echo ""
echo "  This installer will set up RaffleVault on your"
echo "  computer. You only need to answer one question."
echo ""
echo "  Requirements: Docker must be installed and"
echo "  running before continuing."
echo ""
read -p "  Press Enter to continue..."

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo ""
    echo "  ERROR: Docker is not running."
    echo "  Please start Docker and run this installer again."
    echo ""
    exit 1
fi

echo ""
echo "  Docker is running."
echo ""

# Ask for email
while true; do
    read -p "  Enter your email address: " OWNER_EMAIL
    if [ -n "$OWNER_EMAIL" ]; then
        break
    fi
    echo "  Email address cannot be empty. Please try again."
done

echo ""
echo "  Generating secure passwords..."

# Generate random passwords
DB_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)

# Fallback if openssl not available
if [ -z "$DB_PASS" ]; then
    DB_PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 32)
fi
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 48)
fi

# Write .env file
cat > .env << EOF
POSTGRES_PASSWORD=$DB_PASS
JWT_SECRET=$JWT_SECRET
RAFFLEVAULT_OWNER_EMAIL=$OWNER_EMAIL
# Uncomment and set before going live:
# SITE_ORIGIN=https://rafflevault.yourdomain.com
EOF

echo "  Secure passwords generated and saved."
echo ""
echo "  Starting RaffleVault... this may take a few"
echo "  minutes the first time while Docker downloads"
echo "  everything it needs."
echo ""

docker compose up --build -d

if [ $? -ne 0 ]; then
    echo ""
    echo "  ERROR: Something went wrong starting RaffleVault."
    echo "  Please make sure Docker is running and try again."
    echo ""
    exit 1
fi

echo ""
echo "  ================================================"
echo "        RaffleVault is ready!"
echo "  ================================================"
echo ""
echo "  Open your web browser and go to:"
echo ""
echo "        http://localhost:3000"
echo ""
echo "  The setup wizard will walk you through the"
echo "  rest of the configuration."
echo ""
echo "  IMPORTANT: Bookmark http://localhost:3000/admin"
echo "  for the admin panel."
echo ""
echo "  ================================================"
echo ""
