#!/bin/bash

# Uniswap Fee Injector Extension Build Script
# This script packages the extension and runs basic validation

set -e

echo "🔥 Building Uniswap Fee Injector Extension..."

# Define directories
EXTENSION_DIR="."
BUILD_DIR="build"
DIST_DIR="dist"

# Create build directory if it doesn't exist
mkdir -p "$BUILD_DIR"
mkdir -p "$DIST_DIR"

# Function to validate files
validate_files() {
    echo "📋 Validating extension files..."
    
    # Check if all required files exist
    required_files=("manifest.json" "injector.js" "decode.js" "utils.js" "popup.html" "popup.css" "popup.js" "background.js" "README.md")
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            echo "❌ Missing required file: $file"
            exit 1
        else
            echo "✅ Found: $file"
        fi
    done
    
    # Validate manifest.json
    if command -v jq &> /dev/null; then
        echo "🔍 Validating manifest.json..."
        if jq empty manifest.json; then
            echo "✅ manifest.json is valid JSON"
        else
            echo "❌ manifest.json is invalid JSON"
            exit 1
        fi
    else
        echo "⚠️  jq not found, skipping JSON validation"
    fi
    
    # Check for required fields in manifest
    if grep -q "manifest_version" manifest.json && \
       grep -q "name" manifest.json && \
       grep -q "version" manifest.json; then
        echo "✅ manifest.json has required fields"
    else
        echo "❌ manifest.json missing required fields"
        exit 1
    fi
    
    echo "✅ All files validated successfully"
}

# Function to create distribution package
create_package() {
    echo "📦 Creating distribution package..."
    
    # Copy files to build directory
    cp -r ./* "$BUILD_DIR/" 2>/dev/null || true
    
    # Remove build script and other non-essential files from build
    rm -f "$BUILD_DIR/build.sh"
    rm -f "$BUILD_DIR/test-page.html"
    rm -rf "$BUILD_DIR/build"
    rm -rf "$BUILD_DIR/dist"
    
    # Create ZIP package
    cd "$BUILD_DIR"
    zip -r "../$DIST_DIR/uniswap-fee-injector.zip" ./*
    cd ..
    
    echo "✅ Package created: $DIST_DIR/uniswap-fee-injector.zip"
}

# Function to run syntax checks
run_syntax_checks() {
    echo "🔍 Running syntax checks..."
    
    # Check JavaScript syntax (if node is available)
    if command -v node &> /dev/null; then
        echo "Checking JavaScript syntax..."
        
        for js_file in *.js; do
            if [ -f "$js_file" ]; then
                echo "  Checking $js_file..."
                node -c "$js_file" && echo "  ✅ $js_file syntax OK" || echo "  ❌ $js_file syntax error"
            fi
        done
    else
        echo "⚠️  Node.js not found, skipping JavaScript syntax checks"
    fi
    
    echo "✅ Syntax checks completed"
}

# Function to show installation instructions
show_instructions() {
    echo ""
    echo "🎉 Extension built successfully!"
    echo ""
    echo "📋 Installation Instructions:"
    echo "1. Open Chrome and go to chrome://extensions/"
    echo "2. Enable 'Developer mode' (toggle in top right)"
    echo "3. Click 'Load unpacked'"
    echo "4. Select the '$EXTENSION_DIR' folder"
    echo "5. The extension should now be loaded and active"
    echo ""
    echo "🧪 Testing Instructions:"
    echo "1. Open extension/test-page.html in Chrome"
    echo "2. Run the extension tests to verify functionality"
    echo "3. Go to https://app.uniswap.org/ to test live"
    echo "4. Open Developer Tools (F12) to see console logs"
    echo ""
    echo "📦 Distribution:"
    echo "- Package: $DIST_DIR/uniswap-fee-injector.zip"
    echo "- Share this ZIP file for manual installation"
    echo ""
}

# Function to show file sizes
show_file_sizes() {
    echo "📏 File sizes:"
    for file in *.js *.json *.md; do
        if [ -f "$file" ]; then
            size=$(wc -c < "$file")
            echo "  $file: ${size} bytes"
        fi
    done
    echo ""
}

# Main execution
main() {
    echo "Starting build process..."
    
    # Change to extension directory
    cd "$EXTENSION_DIR" || exit 1
    
    # Run validation
    validate_files
    
    # Run syntax checks
    run_syntax_checks
    
    # Show file sizes
    show_file_sizes
    
    # Create package
    create_package
    
    # Show instructions
    show_instructions
    
    echo "🎉 Build completed successfully!"
}

# Run main function
main 