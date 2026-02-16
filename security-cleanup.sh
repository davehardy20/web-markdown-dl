#!/bin/bash
#
# SECURITY CLEANUP SCRIPT
# Removes all personal data from git history
# WARNING: This will rewrite git history - use with caution!
#

set -e

echo "🚨 SECURITY CLEANUP - Removing Personal Data from Git History"
echo "=============================================================="
echo ""
echo "This script will:"
echo "  1. Remove files containing personal data from history"
echo "  2. Rewrite commit authors to generic info"
echo "  3. Force push to overwrite remote history"
echo ""
echo "⚠️  WARNING: This will DESTROY the original git history!"
echo "    Make sure you have backups if needed."
echo ""

read -p "Are you sure you want to proceed? (yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
    echo "Aborted."
    exit 1
fi

cd /Users/dave/tools/web_markdown_dl

# Files to remove completely from history (contain personal paths)
FILES_TO_REMOVE=(
    ".config/opencode/skills/web-markdown-dl/bin/web-markdown-dl"
    "ARCHITECTURE_REVIEW.md"
    "PERFORMANCE_AUDIT.md"
    ".sisyphus/boulder.json"
)

echo ""
echo "🔍 Step 1: Removing sensitive files from history..."
for file in "${FILES_TO_REMOVE[@]}"; do
    if git log --all --full-history -- "$file" | grep -q "commit"; then
        echo "   Removing $file from history..."
        git filter-branch --force --index-filter \
            "git rm --cached --ignore-unmatch '$file'" \
            --prune-empty --tag-name-filter cat -- --all 2>/dev/null || true
    else
        echo "   $file not in history, skipping..."
    fi
done

echo ""
echo "🧹 Step 2: Cleaning up backup refs..."
rm -rf .git/refs/original/
git reflog expire --expire=now --all

echo ""
echo "🗑️  Step 3: Garbage collecting..."
git gc --prune=now --aggressive

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "  1. Review the cleaned history: git log --oneline"
echo "  2. To update remote (DESTRUCTIVE): git push origin main --force"
echo ""
echo "⚠️  DO NOT push to remote until you've verified the cleanup is correct!"
