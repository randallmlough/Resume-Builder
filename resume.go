package main

import (
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"os"
	"slices"
	"strings"
	"text/template"
)

func LoadResume(filePath string) (*Resume, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open resume file: %w", err)
	}
	defer file.Close()

	bytes, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("failed to read resume file: %w", err)
	}

	var resume Resume
	if err := json.Unmarshal(bytes, &resume); err != nil {
		return nil, fmt.Errorf("failed to unmarshal resume file: %w", err)
	}

	insertEnvDetails(&resume)

	return &resume, nil
}

func insertEnvDetails(resume *Resume) {
	phone := os.Getenv("PHONE_NUMBER")
	if phone != "" {
		resume.Contact.Phone = phone
	}
	email := os.Getenv("EMAIL")
	if email != "" {
		resume.Contact.Email = email
	}
}

type Resume struct {
	Name       string      `json:"name"`
	Contact    Contact     `json:"contact"`
	Summary    string      `json:"summary"`
	Skills     []Skill     `json:"skills"`
	Experience []Job       `json:"experience"`
	Education  []Education `json:"education"`
	Projects   []Project   `json:"projects,omitempty"`
	Awards     []string    `json:"awards,omitempty"`
	// private config field to hold configuration settings
	Config *Config `json:"-"`
}

type Contact struct {
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	LinkedIn string `json:"linkedin"`
	GitHub   string `json:"github"`
	Website  string `json:"website"`
}

type Skill struct {
	Name     string   `json:"name,omitempty"`
	Level    string   `json:"level,omitempty"`
	Years    string   `json:"years,omitempty"`
	Category string   `json:"category,omitempty"`
	Keywords []string `json:"keywords,omitempty"`
}

// UnmarshalJSON handles mixed skill formats
func (s *Skill) UnmarshalJSON(data []byte) error {
	// Try object format first
	type skillAlias Skill
	var obj skillAlias
	if err := json.Unmarshal(data, &obj); err == nil {
		*s = Skill(obj)
		return nil
	}

	// Try array format [name, years]
	var arr []string
	if err := json.Unmarshal(data, &arr); err == nil {
		if len(arr) >= 2 {
			s.Name = arr[0]
			s.Years = arr[1]
		} else if len(arr) == 1 {
			s.Name = arr[0]
		}
		return nil
	}

	// Try string format
	var str string
	if err := json.Unmarshal(data, &str); err == nil {
		s.Name = str
		return nil
	}

	return json.Unmarshal(data, s)
}

type Job struct {
	Company          string     `json:"company"`
	Location         string     `json:"location,omitempty"`
	Positions        []Position `json:"positions,omitempty"`
	StartDate        string     `json:"startDate,omitempty"`
	EndDate          string     `json:"endDate,omitempty"`
	Responsibilities []string   `json:"responsibilities,omitempty"`
}

type Position struct {
	Title            string   `json:"title"`
	Type             string   `json:"type,omitempty"` // e.g., Full-time, Internship
	StartDate        string   `json:"startDate"`
	EndDate          string   `json:"endDate"`
	Responsibilities []string `json:"responsibilities"`
}

type Education struct {
	Institution string `json:"institution"`
	College     string `json:"college,omitempty"`
	Degree      string `json:"degree"`
	StartDate   string `json:"startDate"`
	EndDate     string `json:"endDate"`
	Location    string `json:"location"`
	GPA         string `json:"gpa"`
}

type Project struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Link        string   `json:"link,omitempty"`
	Github      string   `json:"github,omitempty"`
	Technology  []string `json:"technologies,omitempty"`
	StartDate   string   `json:"startDate"`
	EndDate     string   `json:"endDate"`
	Items       []string `json:"items,omitempty"`
}

// GenerateLaTeX converts a Resume struct to LaTeX format
func (r *Resume) GenerateLaTeX(cfg *Config) (string, error) {
	templateFileName := fmt.Sprintf("%s.tmpl", cfg.TemplateName)
	templatePath := fmt.Sprintf("templates/%s", templateFileName)
	tmpl, err := template.New(templateFileName).Funcs(funcMap).ParseFiles(templatePath)
	if err != nil {
		return "", fmt.Errorf("failed to parse template: %w", err)
	}
	r.Config = cfg
	var result strings.Builder
	if err := tmpl.Execute(&result, r); err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return result.String(), nil
}

func skillsByCategory(skills []Skill) map[string][]Skill {
	categorized := make(map[string][]Skill)
	for _, skill := range skills {
		category := skill.Category
		if category == "" {
			category = "Other"
		}
		categorized[category] = append(categorized[category], skill)
	}
	return categorized
}

// latexEscape escapes special LaTeX characters and converts newlines
func latexEscape(s string) string {
	replacer := strings.NewReplacer(
		// "\\", "\\textbackslash{}",
		"{", "\\{",
		"}", "\\}",
		"$", "\\$",
		"&", "\\&",
		"%", "\\%",
		"#", "\\#",
		"^", "\\textasciicircum{}",
		"_", "\\_",
		"~", "\\textasciitilde{}",
		"\n", " \\\\ ", // Convert newlines to LaTeX line breaks
	)
	return replacer.Replace(s)
}

var funcMap = template.FuncMap{
	"skillsByCategory": skillsByCategory,
	"sortedKeys": func(m map[string][]Skill) []string {
		return slices.Sorted(maps.Keys(m))
	},
	"orderedSkills": orderedSkills,
	"join":          strings.Join,
	"latexEscape":   latexEscape,
}

type Category struct {
	Name   string
	Values []string
}

func orderedSkills(skills []Skill) []Category {
	// Define a custom order for skill levels
	data := []Category{}
	for _, skill := range skills {
		found := false
		for i, cat := range data {
			if cat.Name == skill.Category {
				data[i].Values = append(data[i].Values, skill.Name)
				found = true
				break
			}
		}
		if !found {
			data = append(data, Category{
				Name:   skill.Category,
				Values: []string{skill.Name},
			})
		}
	}
	return data

}
