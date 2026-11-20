package resume

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/randallmlough/resume-builder/internal/config"
	"github.com/randallmlough/resume-builder/internal/util"
)

type PersonalDetail struct {
	Name       string      `json:"name"`
	Contact    Contact     `json:"contact"`
	Summary    string      `json:"summary"`
	Skills     []Skill     `json:"skills"`
	Experience []Job       `json:"experience"`
	Education  []Education `json:"education"`
	Projects   []Project   `json:"projects,omitempty"`
	Awards     []string    `json:"awards,omitempty"`
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
	Company      string     `json:"company"`
	Hide         bool       `json:"hide,omitempty"`
	Location     string     `json:"location,omitempty"`
	Website      string     `json:"website,omitempty"`
	Overview     string     `json:"overview,omitempty"`
	Technologies []string   `json:"technologies,omitempty"`
	StartDate    string     `json:"startDate,omitempty"`
	EndDate      string     `json:"endDate,omitempty"`
	Positions    []Position `json:"positions,omitempty"`
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
	Hide        bool   `json:"hide,omitempty"`
	College     string `json:"college,omitempty"`
	Degree      string `json:"degree"`
	StartDate   string `json:"startDate"`
	EndDate     string `json:"endDate"`
	Location    string `json:"location"`
	GPA         string `json:"gpa"`
}

type Project struct {
	Name        string   `json:"name"`
	Hide        bool     `json:"hide,omitempty"`
	Description string   `json:"description"`
	Website     string   `json:"url,omitempty"`
	Github      string   `json:"github,omitempty"`
	Technology  []string `json:"technologies,omitempty"`
	StartDate   string   `json:"startDate"`
	EndDate     string   `json:"endDate"`
	Items       []string `json:"items,omitempty"`
}

func LoadPersonalDetails(filePath string) (*PersonalDetail, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open resume file: %w", err)
	}
	defer file.Close()

	bytes, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("failed to read resume file: %w", err)
	}

	var resume PersonalDetail
	if err := json.Unmarshal(bytes, &resume); err != nil {
		return nil, fmt.Errorf("failed to unmarshal resume file: %w", err)
	}

	insertEnvDetails(&resume)

	return &resume, nil
}

func insertEnvDetails(resume *PersonalDetail) {
	phone := os.Getenv("PHONE_NUMBER")
	if phone != "" {
		resume.Contact.Phone = phone
	}
	email := os.Getenv("EMAIL")
	if email != "" {
		resume.Contact.Email = email
	}
}

type Data struct {
	Resume *PersonalDetail
	Config *config.Config
}

// GenerateResume converts a PersonalDetail struct to LaTeX format
func GenerateResume(r *PersonalDetail, cfg *config.Config) error {
	latexContent, err := GenerateLaTeX(cfg.TemplateName, funcMap, Data{
		Resume: r,
		Config: cfg,
	})
	if err != nil {
		return fmt.Errorf("failed to generate resume latex file: %w", err)
	}

	dir, err := util.GetProjectPath()
	if err != nil {
		return err
	}
	filename := filepath.Join(filepath.Dir(dir), "resume.tex")
	if err := Write(filename, latexContent); err != nil {
		return err
	}
	return nil
}

var funcMap = template.FuncMap{
	"orderedSkills":     orderedSkills,
	"visibleEducation":  visibleEducation,
	"visibleExperience": visibleExperience,
	"visibleProjects":   visibleProjects,
	"join":              strings.Join,
	"latexEscape":       latexEscape,
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

func visibleExperience(jobs []Job) []Job {
	data := []Job{}
	for _, job := range jobs {
		if job.Hide {
			continue
		}
		data = append(data, job)
	}
	return data
}

func visibleProjects(projects []Project) []Project {
	data := []Project{}
	for _, project := range projects {
		if project.Hide {
			continue
		}
		data = append(data, project)
	}
	return data
}

func visibleEducation(education []Education) []Education {
	data := []Education{}
	for _, item := range education {
		if item.Hide {
			continue
		}
		data = append(data, item)
	}
	return data
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
