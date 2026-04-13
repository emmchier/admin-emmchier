<!-- BEGIN:nextjs-agent-rules -->

# 🧠 AGENTS.md — emmchier-admin

## 🧭 Project Overview

`emmchier-admin` is a Next.js 16 application that starts as an **Image Uploader system** and evolves into a **multi-space CMS Dashboard**.

It acts as a **secure API layer** between the frontend and Contentful, automating image processing and enabling centralized content management.

---

## 🏗️ Architecture

### Core Flow

Frontend (Uploader UI)
→ Next.js API Routes (Backend)
→ Contentful CMA (3 spaces)

---

## 🌐 Ecosystem

This project manages content across three platforms:

### HUB

- Domain: emmchier.com
- Space: Hub Emmchier
- Content:
  - Contact
  - Resume

- Strategy:
  - Single fetch
  - Cached in Zustand per session

---

### ART

- Domain: art.emmchier.com
- Space: Art Emmchier
- Content:
  - Gallery (projects)
  - Making Of (blog)

- Contact/Resume reused from Hub

---

### DESIGN

- Domain: design.emmchier.com
- Space: Design Emmchier
- Content:
  - UX/UI Projects
  - Case studies

- Contact/Resume reused from Hub

---

## 🧩 Contentful Strategy

### Space Separation

- Hub → Static content (low updates)
- Art → Heavy image usage
- Design → Dynamic content

### Goals

- Maximize free plan limits
- Distribute asset load
- Optimize API usage

---

## 🖼️ Image Upload System (Core Feature)

### Purpose

Automate all image preparation before uploading to Contentful.

---

### Required Transformations

All uploaded images MUST:

- Resize to max width: 2400px
- Maintain aspect ratio
- Convert to `.webp`
- Optimize quality (80–90%)
- Normalize filename

---

### Output Requirements

Images must be:

- Production-ready
- Optimized for performance
- Ready for CDN usage
- Ready for SEO/social sharing

---

## 🔐 Backend Rules (CRITICAL)

- NEVER expose Contentful directly in frontend
- ALWAYS use API routes
- Store all tokens in `.env.local`

---

## ⚙️ API Design

### Endpoint

POST /api/upload

---

### Responsibilities

- Validate file
- Process image
- Select correct Contentful space
- Upload asset
- Publish asset
- Return asset URL + metadata

---

## 🧠 Multi-Space Support

```ts
type Space = 'hub' | 'art' | 'design';
```

```ts
const SPACE_CONFIG = {
  hub: {...},
  art: {...},
  design: {...}
}
```

---

## 🔄 Upload Pipeline

1. Receive file
2. Process image (sharp)
3. Convert to webp
4. Upload to Contentful
5. Publish asset
6. Return response

---

## 🖥️ Frontend (Uploader UI)

### MVP Features

- Drag & drop upload
- Image preview
- Space selector (Art / Design)
- Upload button

---

### Future Dashboard Features

- Asset grid
- Filters
- Tags
- CRUD operations
- Multi-space management

---

## ⚡ State Management

Use Zustand for:

- Session caching
- Avoiding unnecessary API calls

---

## 🔄 Data Fetching Strategy

### HUB

- Fetch once
- Cache in Zustand

### ART / DESIGN

- Fetch on demand
- Cache per navigation

---

## 🔐 Security Rules

- Do NOT expose:
  - Contentful Management Token

- Validate file types (images only)
- Limit file size
- Handle errors properly

---

## ⚙️ Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Zustand
- Sharp (image processing)
- Contentful CMA

---

## 🚀 Roadmap

### Phase 1 — Uploader

- API /upload
- Image processing
- Basic UI
- Contentful integration

---

### Phase 2 — Multi-Space Support

- Dynamic space selection
- Config abstraction

---

### Phase 3 — Dashboard

- Full CRUD
- Content editing UI
- Asset management

---

### Phase 4 — DevOps Integration

- Vercel deploy triggers
- GitHub integration

---

## 🧠 Development Principles (MANDATORY)

- Server-first approach (RSC)
- Strict TypeScript usage
- Clean architecture:
  - UI layer
  - Logic layer
  - Data layer

- Reusable code
- Scalable structure
- Security-first mindset

---

## 🚫 Forbidden Patterns

- Direct calls to Contentful from frontend
- Hardcoded space logic
- Uploading unprocessed images
- Ignoring error handling
- Weak typing

---

## 🧩 Long-Term Vision

This project will become:

admin.emmchier.com

A full CMS dashboard with:

- Authentication
- Multi-space management
- Deployment control
- Centralized content editing

---

## 🧠 Final Note for Agents

This is NOT just an uploader.

This is a scalable system designed to evolve into a full CMS layer.

All decisions must prioritize:

- scalability
- maintainability
- security
- abstraction

<!-- END:nextjs-agent-rules -->
