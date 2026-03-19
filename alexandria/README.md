# Alexandria CMS

A full-featured content management system for the Alexandria journal. Built with Node.js, Express, SQLite, and EJS.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Seed the database (creates admin user + sample data)
npm run seed

# 3. Start the server
npm start
```

The site will be running at **http://localhost:3000**
The admin panel is at **http://localhost:3000/admin**

## Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@alexandria.org | admin123 |
| Managing Editor | editor@alexandria.org | editor123 |
| Head of History | history@alexandria.org | history123 |
| Regional Editor | regional@alexandria.org | regional123 |

**Change these immediately in production.**

## Role Permissions

| Permission | Admin | Managing Editor | Head of Subject | Regional Editor |
|-----------|-------|----------------|----------------|-----------------|
| Full system access | Yes | — | — | — |
| Publish any article | Yes | Yes | — | — |
| Publish own subject | Yes | Yes | Yes | — |
| Create/edit drafts | Yes | Yes | Yes | Yes |
| Manage users | Yes | — | — | — |
| Manage subjects | Yes | Yes | — | — |

## Project Structure

```
alexandria/
├── server.js              # Express app entry point
├── package.json
├── db/
│   ├── schema.sql         # Database schema
│   ├── seed.js            # Seed script with sample data
│   └── alexandria.db      # SQLite database (created by seed)
├── middleware/
│   └── auth.js            # Authentication & role-based access
├── routes/
│   ├── public.js          # Public pages (home, subjects, articles, search)
│   ├── admin.js           # Admin panel (CRUD, media, users)
│   └── api.js             # JSON API (search, analytics)
├── views/
│   ├── partials/          # Shared header, footer, admin layout
│   ├── public/            # Public page templates
│   └── admin/             # Admin panel templates
└── public/
    ├── css/               # Stylesheets (site + admin)
    ├── js/                # Frontend JavaScript
    └── uploads/           # Uploaded images
```

## Features

### Public Site
- Homepage with featured article, subject tiles, latest feed
- Subject pages with filters (newest/oldest/most read, long/short form)
- Article pages with Markdown rendering, footnotes, author bios, related articles
- Author pages with full article listing
- Full-text search across titles, subtitles, and body text
- Light/dark mode toggle (persists via localStorage)
- Fully responsive (mobile, tablet, desktop)
- SEO meta tags per article

### Admin Panel
- Dashboard with stats (published, drafts, authors, total views)
- Full article CRUD with Markdown editor
- Author management with headshots and social links
- Subject management
- Media library with image uploads
- User management with 4-tier role-based access
- Featured article controls (global + subject-specific)
- Post-publication management (retraction + correction notices)
- Tag management

### Backend
- SQLite database (portable, no external DB needed)
- Session-based authentication with bcrypt password hashing
- Role-based access control (admin, managing_editor, head_of_subject, regional_editor)
- Image upload with Multer
- Markdown to HTML rendering with `marked`
- View count tracking per article
- RESTful API endpoints for search and analytics

## Deployment

This runs anywhere that supports Node.js:

- **Vercel/Netlify**: Would need adapting to serverless (consider using Vercel's Node.js runtime)
- **Railway/Render/Fly.io**: Deploy as-is, just set `SESSION_SECRET` env var
- **DigitalOcean/AWS**: Run with PM2 or systemd
- **Any VPS**: `npm install && npm run seed && npm start`

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| SESSION_SECRET | (hardcoded) | **Set this in production** |
| NODE_ENV | development | Set to `production` for secure cookies |

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express 4
- **Database**: SQLite via better-sqlite3
- **Templates**: EJS
- **Markdown**: marked
- **Auth**: bcryptjs + express-session
- **Uploads**: Multer
- **Fonts**: Newsreader + Source Sans 3
