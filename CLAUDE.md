# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an image viewer project that is currently in the initial setup phase. The repository has been configured for Node.js development using a devcontainer setup.

## Development Environment

The project uses a Node.js 18 development container as configured in `.devcontainer/devcontainer.json`. The container:
- Uses Node.js 18 slim image
- Mounts the workspace to `/workspace`
- Exposes port 3000 for potential web server usage
- Has git installed for version control

## Current State

The project is in its initial stage with only basic repository structure:
- README.md file exists but contains minimal content
- No source code files have been created yet
- No package.json or other build configuration files exist
- No test framework or linting setup is present

## Development Notes

Since this is a new project:
- When creating the initial project structure, consider the type of image viewer being built (web-based, electron app, CLI tool, etc.)
- No build, test, or lint commands are available until the project is properly initialized
- The Node.js environment suggests this may become a JavaScript/TypeScript project