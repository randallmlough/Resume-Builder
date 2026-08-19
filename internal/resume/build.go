package resume

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/randallmlough/resume-builder/internal/config"
	"github.com/randallmlough/resume-builder/internal/util"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
)

type LatexTemplateData struct {
	Resume *PersonalDetail
	Config *config.Config
	Body   string
}

// CreateTexFile converts a PersonalDetail struct to LaTeX format
func CreateTexFile(templateName string, outputPath string, data LatexTemplateData) error {
	latexContent, err := GenerateLaTeX(templateName, funcMap, data)
	if err != nil {
		return fmt.Errorf("failed to generate resume latex file: %w", err)
	}

	if err := Write(outputPath, latexContent); err != nil {
		return err
	}
	return nil
}

/*
---- Behavior knob ----
If you want single newlines in Markdown to render as visible line breaks (\\),
set this to true. If you prefer normal prose (single newlines collapse to a space),
leave it false.
*/
const softBreakAsLineBreak = false

// GenerateLaTeX converts a PersonalDetail struct to LaTeX format
func GenerateLaTeX(templateName string, funcMap template.FuncMap, data any) (string, error) {
	templateFileName := fmt.Sprintf("%s.tmpl", templateName)
	dir, err := util.GetProjectPath()
	if err != nil {
		return "", err
	}
	templatePath := filepath.Join(filepath.Dir(dir), "templates", templateFileName)
	tmpl, err := template.New(templateFileName).Funcs(funcMap).ParseFiles(templatePath)
	if err != nil {
		return "", fmt.Errorf("failed to parse template: %w", err)
	}
	var result strings.Builder
	if err := tmpl.Execute(&result, data); err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return result.String(), nil
}

// Write the LaTeX content to a file
func Write(filepath string, data string) error {
	outputFile, err := os.Create(filepath)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer outputFile.Close()

	if _, err := outputFile.WriteString(data); err != nil {
		return fmt.Errorf("failed to write data to file: %w", err)
	}
	return nil
}

func LoadMarkdownFile(fileLocation string) (string, error) {
	dir, err := util.GetProjectPath()
	if err != nil {
		return "", err
	}
	md, err := os.Open(filepath.Join(filepath.Dir(dir), fileLocation))
	if err != nil {
		return "", err
	}
	defer md.Close()
	bytes, err := io.ReadAll(md)
	if err != nil {
		return "", err
	}

	bodyText, err := MarkdownToLaTeX(string(bytes))
	if err != nil {
		return "", err
	}
	return bodyText, nil
}

// Escape LaTeX specials in plain text nodes.
func escapeLaTeX(s string) string {
	// Order matters: handle double backslashes first, then single.
	replacer := strings.NewReplacer(
		`\\`, `\textbackslash{}\textbackslash{}`,
		`\`, `\textbackslash{}`,
		`#`, `\#`,
		`$`, `\$`,
		`%`, `\%`,
		`&`, `\&`,
		`_`, `\_`,
		`{`, `\{`,
		`}`, `\}`,
		`~`, `\textasciitilde{}`,
		`^`, `\textasciicircum{}`,
	)
	return replacer.Replace(s)
}

/*********** Markdown -> LaTeX ***********/
func MarkdownToLaTeX(md string) (string, error) {
	src := []byte(md)

	mdParser := goldmark.New(
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
	)

	root := mdParser.Parser().Parse(text.NewReader(src))

	var b bytes.Buffer
	write := func(s string) { b.WriteString(s) }

	// Inline renderer for typical inline containers
	var renderInlines func(n ast.Node)
	// Render a node "inline-ly" (used for tight list children that are Text/Emphasis/etc directly)
	var renderInlineNode func(n ast.Node)

	writeSoftBreak := func() {
		if softBreakAsLineBreak {
			write(`\\` + "\n")
		} else {
			write(" ")
		}
	}

	renderInlines = func(n ast.Node) {
		for c := n.FirstChild(); c != nil; c = c.NextSibling() {
			switch c.Kind() {
			case ast.KindText:
				t := c.(*ast.Text)
				write(escapeLaTeX(string(t.Segment.Value(src))))
				if t.HardLineBreak() {
					// Markdown hard break: two spaces + newline or <br>
					write(`\\` + "\n")
				} else if t.SoftLineBreak() {
					// Single newline in source
					writeSoftBreak()
				}
			case ast.KindEmphasis:
				em := c.(*ast.Emphasis)
				if em.Level == 2 {
					write(`\textbf{`)
					renderInlines(c)
					write(`}`)
				} else {
					write(`\emph{`)
					renderInlines(c)
					write(`}`)
				}
			case ast.KindCodeSpan:
				cs := c.(*ast.CodeSpan)
				write(`\texttt{` + escapeLaTeX(string(cs.Text(src))) + `}`)
			case ast.KindLink:
				l := c.(*ast.Link)
				write(`\href{` + escapeLaTeX(string(l.Destination)) + `}{`)
				renderInlines(c)
				write(`}`)
			default:
				// Fallback: descend into children
				renderInlines(c)
			}
		}
	}

	renderInlineNode = func(n ast.Node) {
		switch n.Kind() {
		case ast.KindText:
			t := n.(*ast.Text)
			write(escapeLaTeX(string(t.Segment.Value(src))))
			if t.HardLineBreak() {
				write(`\\` + "\n")
			} else if t.SoftLineBreak() {
				writeSoftBreak()
			}
		case ast.KindEmphasis, ast.KindCodeSpan, ast.KindLink:
			renderInlines(n)
		default:
			renderInlines(n)
		}
	}

	var renderBlock func(n ast.Node)
	renderBlock = func(n ast.Node) {
		switch n.Kind() {
		case ast.KindParagraph:
			renderInlines(n)
			write("\n\n") // paragraph break

		case ast.KindHeading:
			h := n.(*ast.Heading)
			switch h.Level {
			case 1:
				write(`\section*{`)
				renderInlines(n)
				write("}\n\n")
			case 2:
				write(`\subsection*{`)
				renderInlines(n)
				write("}\n\n")
			case 3:
				write(`\subsubsection*{`)
				renderInlines(n)
				write("}\n\n")
			default:
				write(`\paragraph*{`)
				renderInlines(n)
				write("}\n\n")
			}

		case ast.KindList:
			li := n.(*ast.List)
			if li.IsOrdered() {
				write(`\begin{enumerate}` + "\n")
			} else {
				write(`\begin{itemize}` + "\n")
			}
			for item := n.FirstChild(); item != nil; item = item.NextSibling() {
				write(`\item `)
				for c := item.FirstChild(); c != nil; c = c.NextSibling() {
					switch c.Kind() {
					case ast.KindParagraph:
						// Loose list: inline text lives inside a paragraph
						renderInlines(c)
					case ast.KindList:
						// Nested list
						write("\n")
						renderBlock(c)
					default:
						// Tight list: inline nodes directly under ListItem
						renderInlineNode(c)
					}
				}
				write("\n")
			}
			if li.IsOrdered() {
				write(`\end{enumerate}` + "\n\n")
			} else {
				write(`\end{itemize}` + "\n\n")
			}

		case ast.KindThematicBreak:
			write(`\medskip\hrule\medskip` + "\n\n")

		case ast.KindHTMLBlock:
			// ignore raw HTML for now

		default:
			// descend into container blocks
			for c := n.FirstChild(); c != nil; c = c.NextSibling() {
				renderBlock(c)
			}
		}
	}

	// Walk the document’s top-level nodes
	for c := root.FirstChild(); c != nil; c = c.NextSibling() {
		renderBlock(c)
	}

	return b.String(), nil
}
