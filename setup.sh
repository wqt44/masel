#!/bin/bash
# MASEL Setup Script
# Run this to initialize MASEL skill

echo "🚀 MASEL - Multi-Agent System with Error Learning"
echo "=================================================="
echo ""

# Check directory structure
echo "📁 Checking directory structure..."

DIRS=(
  "src/agency"
  "src/workflow/nodes"
  "src/workflow/templates"
  "src/self-improving"
  "src/memory"
  "src/tools"
  "souls/coder"
  "souls/researcher"
  "souls/reviewer"
)

for dir in "${DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "  ✓ $dir"
  else
    echo "  ✗ $dir (missing)"
    mkdir -p "$dir"
    echo "    Created $dir"
  fi
done

echo ""
echo "📄 Checking core files..."

FILES=(
  "SKILL.md"
  "openclaw.plugin.json"
  "souls/coder/soul.md"
  "souls/researcher/soul.md"
  "souls/reviewer/soul.md"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file (missing)"
  fi
done

echo ""
echo "🔧 Next steps:"
echo "  1. Implement core tools in src/tools/"
echo "  2. Create workflow nodes in src/workflow/nodes/"
echo "  3. Implement memory system in src/memory/"
echo "  4. Test with: openclaw tools call masel_plan"
echo ""
echo "✨ MASEL is ready for development!"
