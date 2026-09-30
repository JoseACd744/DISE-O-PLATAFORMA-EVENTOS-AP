# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

React SPA to manage events and logistics for two brands, **D'Onofrio** and **Juguetón**; some sections are brand-specific (e.g. Inflables is Juguetón-only, guarded by `BrandGuard`). The frontend is deployed to Firebase Hosting; the backend is a separate REST API (repo `EVENTOS-AP-BACKEND`, Express + PostgreSQL) deployed on Railway.

## Gotchas

- `.env` points `VITE_API_BASE_URL` at the **production** API. For local testing start Vite with `VITE_API_BASE_URL=http://localhost:3001/api`, otherwise the dev server talks to production.
