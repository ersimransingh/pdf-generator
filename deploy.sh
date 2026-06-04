#!/bin/bash

set -e

echo "Starting deployment..."

cd /root/pdf-generator

echo "Pulling latest code..."
git pull origin master

echo "Installing dependencies..."
yarn install

echo "Restarting PM2..."
pm2 restart pdfgenerator

echo "Deployment completed successfully!"