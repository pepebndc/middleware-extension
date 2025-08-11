#!/bin/bash

# Script to switch between production and development manifest files

set -e

PROD_MANIFEST="manifest.json"
DEV_MANIFEST="manifest-dev.json"
BACKUP_MANIFEST="manifest-backup.json"

echo "🔄 Manifest Switcher for Uniswap Fee Injector"
echo ""

# Function to show current manifest
show_current() {
    if [ -f "$PROD_MANIFEST" ]; then
        local name=$(grep '"name"' "$PROD_MANIFEST" | cut -d'"' -f4)
        echo "📄 Current manifest: $name"
    else
        echo "❌ No manifest.json found"
    fi
}

# Function to switch to development
switch_to_dev() {
    if [ ! -f "$DEV_MANIFEST" ]; then
        echo "❌ Development manifest not found: $DEV_MANIFEST"
        exit 1
    fi
    
    echo "🔄 Switching to DEVELOPMENT manifest..."
    
    # Backup current manifest
    if [ -f "$PROD_MANIFEST" ]; then
        cp "$PROD_MANIFEST" "$BACKUP_MANIFEST"
        echo "📋 Backed up current manifest to: $BACKUP_MANIFEST"
    fi
    
    # Switch to development
    cp "$DEV_MANIFEST" "$PROD_MANIFEST"
    echo "✅ Switched to development manifest"
    echo "🧪 Extension now supports:"
    echo "   - Local files (file:///*)"
    echo "   - Localhost testing"
    echo "   - Uniswap.org"
}

# Function to switch to production
switch_to_prod() {
    if [ -f "$BACKUP_MANIFEST" ]; then
        echo "🔄 Restoring PRODUCTION manifest from backup..."
        cp "$BACKUP_MANIFEST" "$PROD_MANIFEST"
        echo "✅ Restored production manifest"
    else
        echo "🔄 Creating PRODUCTION manifest..."
        cat > "$PROD_MANIFEST" << 'EOF'
{
  "manifest_version": 3,
  "name": "Uniswap 1% Fee Injection",
  "version": "1.0.0",
  "description": "Automatically adds 1% fee to Uniswap v4 Universal Router transactions",
  "permissions": [
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "https://app.uniswap.org/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://app.uniswap.org/*"],
      "js": ["utils.js", "decode.js", "injector.js"],
      "run_at": "document_start",
      "world": "MAIN"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["utils.js", "decode.js", "injector.js"],
      "matches": ["https://app.uniswap.org/*"]
    }
  ]
}
EOF
        echo "✅ Created production manifest"
    fi
    
    echo "🔒 Extension now restricted to:"
    echo "   - Uniswap.org ONLY"
}

# Function to show help
show_help() {
    echo "Usage: $0 [dev|prod|status|help]"
    echo ""
    echo "Commands:"
    echo "  dev     - Switch to development manifest (allows local testing)"
    echo "  prod    - Switch to production manifest (Uniswap only)"
    echo "  status  - Show current manifest status"
    echo "  help    - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 dev    # Enable local testing"
    echo "  $0 prod   # Restrict to Uniswap only"
    echo "  $0 status # Check current configuration"
}

# Parse command line arguments
case "${1:-status}" in
    "dev"|"development")
        switch_to_dev
        ;;
    "prod"|"production")
        switch_to_prod
        ;;
    "status")
        show_current
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac

echo ""
show_current
echo ""
echo "🔄 After switching, reload the extension in chrome://extensions/" 