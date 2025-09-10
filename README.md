# Resume Builder

A modern resume builder that generates professional PDFs from structured JSON data using Go and LaTeX.

## Features

- **JSON-driven**: Define your resume data in a structured, version-controllable format
- **Professional typography**: Uses LuaTeX with Merriweather fonts for elegant output
- **Template-based**: Easily customizable LaTeX templates
- **Docker-powered**: Consistent PDF generation across environments
- **Schema validation**: JSON Schema ensures data integrity
- **Multiple fonts**: Support for serif headings and sans-serif body text

## Quick Start

1. **Edit your resume data**:
   ```bash
   # Edit resume.json with your information
   vim resume.json
   ```

2. **Generate PDF**:
   ```bash
   make build
   ```

Your PDF will be generated in `dist/resume.pdf`.

## Commands

```bash
make build          # Generate LaTeX and compile to PDF
make gen             # Generate LaTeX from JSON only  
make create_pdf      # Compile existing LaTeX to PDF only
make clean           # Remove generated files
make fonts           # List available fonts in Docker
make build_image     # Rebuild Docker image
```

## Resume Structure

The resume is defined in `resume.json` with the following sections:

- **Personal info**: Name, contact details
- **Summary**: Professional overview
- **Experience**: Work history with multiple positions per company
- **Projects**: Personal/professional projects with technologies
- **Education**: Academic background
- **Skills**: Technical skills organized by category

### Example Structure

```json
{
  "name": "Your Name",
  "contact": {
    "email": "you@example.com",
    "phone": "123-456-7890",
    "linkedin": "linkedin.com/in/yourprofile",
    "github": "github.com/yourusername"
  },
  "summary": "Professional summary...",
  "experience": [
    {
      "company": "Company Name",
      "location": "City, State",
      "positions": [
        {
          "title": "Job Title",
          "startDate": "Month Year",
          "endDate": "Month Year",
          "responsibilities": [
            "Responsibility 1",
            "Responsibility 2"
          ]
        }
      ]
    }
  ],
  "skills": [
    {
      "name": "JavaScript",
      "level": "Advanced",
      "years": "5 years",
      "category": "Programming Languages"
    }
  ]
}
```

## Customization

### Fonts

The system uses LuaTeX with fontspec for font management:
- **Headings**: Merriweather (serif)
- **Body text**: Merriweather Sans
- **Accent color**: `#1f79c7` (blue)

To change fonts, edit `templates/single-column.tmpl`:
```latex
\setmainfont{Your Font Name}
\newfontfamily\headingfont{Your Heading Font}
```

### Colors

Define custom colors in the template:
```latex
\definecolor{accentColor}{HTML}{1f79c7}
```

### Layout

Modify `templates/single-column.tmpl` to customize:
- Section formatting
- Spacing and margins
- Text sizes and styles

## Text Formatting

The system supports:
- **Line breaks**: Use `\n` in JSON strings
- **Special characters**: `%`, `&`, `$`, etc. are automatically escaped
- **LaTeX formatting**: Bold, italic, and other LaTeX commands work in templates

## Development

### Prerequisites

- Go 1.21+
- Docker
- Make

### Architecture

1. **JSON data** (`resume.json`) → Go structs
2. **Go template** (`templates/single-column.tmpl`) processes data
3. **LaTeX generation** with special character escaping
4. **Docker compilation** using LuaTeX
5. **PDF output** in `dist/` directory

### Adding New Features

1. Update Go structs in `resume.go`
2. Modify template in `templates/single-column.tmpl`
3. Update JSON schema in `resume.schema.json`
4. Test with `make build`

## Schema Validation

The project includes `resume.schema.json` for data validation. Most IDEs will automatically validate your `resume.json` file and provide:
- Autocomplete for field names
- Type checking
- Required field validation
- Enum value suggestions