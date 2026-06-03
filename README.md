# PDF Generator SaaS

A complete PDF generation service built with Node.js, Express, SQLite, and Puppeteer. Create HTML templates with dynamic placeholders, preview them in real-time, and generate professional PDFs with full CSS support.

## Features

- **Template Management**: Full CRUD API for HTML/CSS templates
- **Live Preview**: Split-screen editor with real-time preview
- **PDF Generation**: High-quality PDFs with Puppeteer (Chromium headless)
- **Template Variables**: Use `{{variable}}` placeholders and `{{#if variable}}` conditionals
- **CSS Support**: Full CSS3 including flexbox, grid, custom fonts, `@page` rules
- **API Access**: RESTful JSON API with CORS support
- **Logging**: SQLite-based PDF generation logs
- **No ORM**: Raw SQL with parameterized queries for performance

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or with auto-reload during development
npm run dev
```

The server will start on `http://localhost:3000`.

## Project Structure

```
├── src/
│   ├── app.js                 # Express app entry point
│   ├── config/
│   │   └── database.js        # SQLite connection & schema
│   ├── controllers/
│   │   ├── templateController.js
│   │   ├── pdfController.js
│   │   └── docsController.js
│   ├── models/
│   │   ├── templateModel.js
│   │   └── pdfLogModel.js
│   ├── routes/
│   │   ├── templateRoutes.js
│   │   └── pdfRoutes.js
│   ├── services/
│   │   └── pdfService.js      # Puppeteer PDF engine
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── validators.js
│   ├── utils/
│   │   ├── templateEngine.js  # {{var}} replacement engine
│   │   ├── seedData.js        # Sample templates
│   │   └── logger.js
├── public/
│   ├── css/admin.css
│   └── js/admin.js
├── views/
│   └── index.html             # Admin panel
├── uploads/                   # Generated PDFs (when using file mode)
├── data/
│   └── database.sqlite        # SQLite database
├── test.js                    # API test script
└── package.json
```

## Environment Variables

Copy `.env.example` to `.env` and adjust:

```env
PORT=3000
DB_PATH=./data/database.sqlite
NODE_ENV=development
```

## API Reference

All responses follow this format:
```json
{
  "success": true|false,
  "data": {},
  "error": ""
}
```

### Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/templates` | Create template |
| GET | `/api/templates` | List all templates |
| GET | `/api/templates/:id` | Get single template |
| PUT | `/api/templates/:id` | Update template |
| DELETE | `/api/templates/:id` | Delete template |

**Create Template Request:**
```json
{
  "name": "Invoice",
  "description": "Customer invoice",
  "html_content": "<h1>Invoice {{invoice_number}}</h1>",
  "css_content": "h1 { color: #333; }",
  "sample_data": { "invoice_number": "001" }
}
```

### PDF Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/generate-pdf` | Returns PDF as binary |
| POST | `/api/generate-pdf-file` | Saves PDF and returns download URL |

**Generate PDF Request:**
```json
{
  "template_id": 1,
  "data": {
    "customer_name": "John Doe",
    "amount": "150.00"
  },
  "options": {
    "pageSize": "A4",
    "orientation": "portrait",
    "margin": {
      "top": "20px",
      "right": "20px",
      "bottom": "20px",
      "left": "20px"
    }
  }
}
```

### Documentation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/docs` | JSON API documentation |

## Template Syntax

### Variables
```html
<h1>Hello {{customer_name}}</h1>
<p>Total: {{amount}}</p>
<p>Nested: {{user.name}}</p>
```

### Conditionals
```html
{{#if show_logo}}
  <img src="logo.png" alt="Logo">
{{/if}}
```

### CSS @page Rules
```css
@page {
  size: A4;
  margin: 30px;
}
```

## Admin Panel

Open `http://localhost:3000` in your browser to access the template editor.

Features:
- Split-screen HTML/CSS editor with live preview
- JSON sample data editor
- Template list with edit/delete
- Direct PDF generation test

## Testing

Run the test suite (server must be running):

```bash
npm test
```

The test script verifies:
1. API docs endpoint
2. Seeded templates exist
3. Template CRUD operations
4. PDF generation (binary and file modes)
5. Error handling for invalid template IDs

## Dependencies

- **express** - Web framework
- **better-sqlite3** - SQLite database (synchronous, fast)
- **puppeteer** - Headless Chrome for PDF generation
- **cors** - Cross-origin resource sharing
- **express-validator** - Input validation
- **dotenv** - Environment variables

## Notes

- Puppeteer launches with `--no-sandbox` flags for server compatibility
- Generated PDFs in `/uploads` persist on disk; set up a cleanup cron if needed
- All SQL queries use parameterized statements to prevent injection
- HTML/CSS inputs are sanitized to remove `<script>` tags and `@import` rules
- The admin panel is a vanilla JS SPA — no build step required

## License

MIT
